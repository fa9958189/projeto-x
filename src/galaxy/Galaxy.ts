import * as THREE from 'three';
import { GALAXY } from '../config/constants';
import type { InteractionSnapshot } from '../interaction/InteractionState';
import { generateDistantStars, generateGalaxy, getAdaptiveParticleCount } from './galaxyGenerator';
import { SolarWorld } from './SolarWorld';

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpenness;
  uniform float uPixelRatio;

  attribute float aSize;
  attribute float aRandom;
  attribute float aRadialFactor;
  attribute vec3 aColor;

  varying vec3 vColor;
  varying float vIntensity;

  void main() {
    float easedOpen = smoothstep(0.0, 1.0, uOpenness);
    float compression = 1.0 - easedOpen;
    float stagger = smoothstep(aRandom * 0.08, 0.94, compression);
    float radialScale = mix(0.15 + aRandom * 0.035, 1.15, easedOpen);
    float verticalScale = mix(0.12, 1.0, easedOpen);
    float vortex = stagger * (1.12 + (1.0 - aRadialFactor) * 1.45 + aRandom * 0.25);

    float cosine = cos(vortex);
    float sine = sin(vortex);
    vec3 transformed = position;
    transformed.xz = mat2(cosine, -sine, sine, cosine) * transformed.xz;
    transformed.xz *= radialScale;
    transformed.y *= verticalScale;

    float pulse = sin(uTime * (0.8 + aRandom) + aRandom * 31.4) * 0.5 + 0.5;
    float coreEnergy = compression * (1.0 - aRadialFactor);
    transformed.y += sin(uTime * 0.7 + aRandom * 18.0) * 0.018 * easedOpen;

    vec4 modelPosition = modelMatrix * vec4(transformed, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;

    float perspective = 72.0 / max(-viewPosition.z, 1.0);
    gl_PointSize = clamp(aSize * uPixelRatio * perspective * (1.0 + coreEnergy * 1.7), 1.0, 16.0);
    vColor = aColor * (0.78 + pulse * 0.28 + coreEnergy * 0.58);
    vIntensity = 0.72 + aRandom * 0.28;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vIntensity;

  void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float softDisc = 1.0 - smoothstep(0.05, 0.5, distanceToCenter);
    float hotCore = 1.0 - smoothstep(0.0, 0.13, distanceToCenter);
    float alpha = softDisc * vIntensity;
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(vColor + hotCore * 0.7, alpha);
  }
`;

function damp(current: number, target: number, lambda: number, deltaSeconds: number): number {
  return THREE.MathUtils.damp(current, target, lambda, Math.min(deltaSeconds, 0.1));
}

function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create galaxy glow texture');

  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.06, 'rgba(225, 250, 255, .96)');
  gradient.addColorStop(0.2, 'rgba(98, 207, 255, .62)');
  gradient.addColorStop(0.48, 'rgba(74, 102, 255, .2)');
  gradient.addColorStop(1, 'rgba(26, 18, 92, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);

  return new THREE.CanvasTexture(canvas);
}

export class Galaxy {
  private readonly root: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly galaxyGroup = new THREE.Group();
  private readonly particles: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly distantStars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly coreSprites: THREE.Sprite[] = [];
  private readonly glowTexture: THREE.CanvasTexture;
  private readonly solarWorld = new SolarWorld();
  private readonly lookTarget = new THREE.Vector3();
  private readonly solarFocusTarget = new THREE.Vector3();
  private frameId = 0;
  private previousTime = performance.now();
  private openness = 0.72;
  private rotationX = -0.08;
  private rotationY = 0;
  private cameraZoom = 0;
  private cameraFocusX = 0.5;
  private cameraFocusY = 0.5;
  private elapsedTime = 0;
  private updateCallback: ((deltaSeconds: number, timestampMs: number) => InteractionSnapshot) | null = null;

  public readonly particleCount: number;

  public constructor(root: HTMLElement) {
    this.root = root;
    this.particleCount = getAdaptiveParticleCount();

    this.renderer = new THREE.WebGLRenderer({
      antialias: window.devicePixelRatio <= 1.5,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.domElement.className = 'galaxy-canvas';
    this.root.append(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 180);
    this.camera.position.set(0, 13.5, 27.5);
    this.camera.lookAt(0, 0, 0);

    const data = generateGalaxy(this.particleCount);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(data.colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(data.sizes, 1));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(data.randomness, 1));
    geometry.setAttribute('aRadialFactor', new THREE.BufferAttribute(data.radialFactors, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpenness: { value: this.openness },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
    });

    this.particles = new THREE.Points(geometry, material);
    this.particles.frustumCulled = false;
    this.galaxyGroup.add(this.particles);
    this.scene.add(this.galaxyGroup);
    this.scene.add(this.solarWorld.group);

    const ambientLight = new THREE.AmbientLight('#79b8d4', 0.5);
    const coreLight = new THREE.PointLight('#a8ecff', 32, 34, 1.7);
    coreLight.position.set(0, 1.2, 0);
    this.scene.add(ambientLight, coreLight);

    const distantGeometry = generateDistantStars(GALAXY.distantStars);
    const distantMaterial = new THREE.PointsMaterial({
      color: '#8ebbd7',
      size: 0.085,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.distantStars = new THREE.Points(distantGeometry, distantMaterial);
    this.scene.add(this.distantStars);

    this.glowTexture = createGlowTexture();
    this.createCore();
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize, { passive: true });
  }

  public start(
    updateCallback: (deltaSeconds: number, timestampMs: number) => InteractionSnapshot,
  ): void {
    this.updateCallback = updateCallback;
    this.previousTime = performance.now();
    this.elapsedTime = 0;
    this.frameId = requestAnimationFrame(this.animate);
  }

  public dispose(): void {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.onResize);
    this.particles.geometry.dispose();
    this.particles.material.dispose();
    this.distantStars.geometry.dispose();
    this.distantStars.material.dispose();
    this.solarWorld.dispose();
    for (const sprite of this.coreSprites) sprite.material.dispose();
    this.glowTexture.dispose();
    this.renderer.dispose();
  }

  private readonly animate = (timestampMs: number): void => {
    this.frameId = requestAnimationFrame(this.animate);
    const deltaSeconds = Math.min((timestampMs - this.previousTime) / 1000, 0.1);
    this.previousTime = timestampMs;

    const interaction = this.updateCallback?.(deltaSeconds, timestampMs);
    if (interaction) this.applyInteraction(interaction, deltaSeconds);

    this.elapsedTime += deltaSeconds;
    const elapsed = this.elapsedTime;
    this.particles.material.uniforms.uTime!.value = elapsed;
    this.particles.material.uniforms.uOpenness!.value = this.openness;
    this.galaxyGroup.rotation.y += deltaSeconds * (0.018 + (1 - this.openness) * 0.15);
    this.distantStars.rotation.y = elapsed * 0.0025;
    this.distantStars.rotation.x = Math.sin(elapsed * 0.035) * 0.018;
    if (interaction) {
      this.solarWorld.update(
        elapsed,
        interaction.solarPresence,
        interaction.left.openness,
        this.cameraZoom,
        this.cameraFocusX,
        this.cameraFocusY,
        deltaSeconds,
      );
    }

    const compression = 1 - this.openness;
    for (let index = 0; index < this.coreSprites.length; index += 1) {
      const sprite = this.coreSprites[index];
      if (!sprite) continue;
      const baseScale = 3.5 + index * 4.4;
      const pulse = 1 + Math.sin(elapsed * (1.1 + index * 0.17)) * 0.025;
      sprite.scale.setScalar(baseScale * pulse * (1 + compression * (0.22 - index * 0.04)));
      sprite.material.opacity = (0.86 - index * 0.2) * (1 + compression * 0.3);
    }

    this.renderer.render(this.scene, this.camera);
  };

  private applyInteraction(interaction: InteractionSnapshot, deltaSeconds: number): void {
    this.openness = damp(this.openness, interaction.right.openness, 11, deltaSeconds);
    const targetRotationY = (interaction.right.x - 0.5) * 0.32;
    const targetRotationX = -0.08 + (interaction.right.y - 0.5) * 0.2;
    this.rotationY = damp(this.rotationY, targetRotationY, 3.8, deltaSeconds);
    this.rotationX = damp(this.rotationX, targetRotationX, 3.8, deltaSeconds);
    this.galaxyGroup.rotation.x = this.rotationX;
    this.galaxyGroup.rotation.z = this.rotationY * 0.16;

    this.cameraZoom = damp(this.cameraZoom, interaction.zoom, 6.8, deltaSeconds);
    this.cameraFocusX = damp(this.cameraFocusX, interaction.left.x, 4.2, deltaSeconds);
    this.cameraFocusY = damp(this.cameraFocusY, interaction.left.y, 4.2, deltaSeconds);
    const solarOpen = THREE.MathUtils.smoothstep(interaction.left.openness, 0.12, 0.55);
    const focusStrength = this.cameraZoom * interaction.solarPresence * solarOpen;
    this.solarWorld.getFocusPosition(this.solarFocusTarget);
    this.solarFocusTarget.x += (this.cameraFocusX - 0.5) * 1.5;
    this.solarFocusTarget.y += (0.5 - this.cameraFocusY) * 1.1;

    this.camera.position.x = damp(
      this.camera.position.x,
      this.solarFocusTarget.x * focusStrength * 0.42,
      4.6,
      deltaSeconds,
    );
    this.camera.position.y = damp(this.camera.position.y, 13.5 - focusStrength * 5.3, 4.6, deltaSeconds);
    this.camera.position.z = damp(this.camera.position.z, 27.5 - focusStrength * 15.2, 4.6, deltaSeconds);
    this.lookTarget.copy(this.solarFocusTarget).multiplyScalar(focusStrength);
    this.camera.lookAt(this.lookTarget);
  }

  private createCore(): void {
    const colors = ['#dffaff', '#78cfff', '#5b5cff'];
    for (let index = 0; index < 3; index += 1) {
      const material = new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: colors[index],
        transparent: true,
        opacity: 0.86 - index * 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.setScalar(3.5 + index * 4.4);
      this.coreSprites.push(sprite);
      this.galaxyGroup.add(sprite);
    }
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.particles.material.uniforms.uPixelRatio!.value = this.renderer.getPixelRatio();
  }
}
