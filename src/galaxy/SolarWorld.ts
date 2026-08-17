import * as THREE from 'three';

const SOLAR_POSITION = new THREE.Vector3(3.8, 1.15, -1.2);
const ORANGE = '#ff8a18';
const GOLD = '#ffc24a';
const HOT = '#fff4ad';

function createSolarGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create solar glow texture');

  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255, 255, 224, 1)');
  gradient.addColorStop(0.08, 'rgba(255, 224, 92, .98)');
  gradient.addColorStop(0.25, 'rgba(255, 132, 20, .72)');
  gradient.addColorStop(0.55, 'rgba(255, 70, 8, .2)');
  gradient.addColorStop(1, 'rgba(255, 35, 0, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createBeamGeometry(): THREE.BufferGeometry {
  const beamCount = 14;
  const positions = new Float32Array(beamCount * 6);

  for (let index = 0; index < beamCount; index += 1) {
    const phi = Math.acos(1 - (2 * (index + 0.5)) / beamCount);
    const theta = Math.PI * (1 + Math.sqrt(5)) * index;
    const direction = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
    );
    const innerRadius = 0.48 + (index % 3) * 0.04;
    const outerRadius = 2.4 + (index % 5) * 0.36;
    const offset = index * 6;
    positions[offset] = direction.x * innerRadius;
    positions[offset + 1] = direction.y * innerRadius;
    positions[offset + 2] = direction.z * innerRadius;
    positions[offset + 3] = direction.x * outerRadius;
    positions[offset + 4] = direction.y * outerRadius;
    positions[offset + 5] = direction.z * outerRadius;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function createSparkGeometry(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const fraction = (index + 0.5) / count;
    const theta = index * 2.399963229728653;
    const phi = Math.acos(1 - 2 * fraction);
    const noise = Math.sin(index * 91.73) * 0.5 + 0.5;
    const radius = 1.3 + noise * 1.55;
    const offset = index * 3;
    positions[offset] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[offset + 1] = Math.cos(phi) * radius * (0.7 + noise * 0.3);
    positions[offset + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

export class SolarWorld {
  public readonly group = new THREE.Group();

  private readonly visual = new THREE.Group();
  private readonly glowTexture = createSolarGlowTexture();
  private readonly sphereGeometry = new THREE.SphereGeometry(1, 32, 22);
  private readonly coreMaterial = new THREE.MeshBasicMaterial({
    color: HOT,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  private readonly energyMaterial = new THREE.MeshBasicMaterial({
    color: ORANGE,
    transparent: true,
    opacity: 0,
    wireframe: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  private readonly shellMaterial = new THREE.MeshBasicMaterial({
    color: GOLD,
    transparent: true,
    opacity: 0,
    wireframe: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  private readonly beamMaterial = new THREE.LineBasicMaterial({
    color: ORANGE,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  private readonly sparkMaterial = new THREE.PointsMaterial({
    color: GOLD,
    size: 0.075,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  private readonly glowMaterials: THREE.SpriteMaterial[] = [];
  private readonly orbitMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly orbitRings: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly beams: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly sparks: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly light = new THREE.PointLight(ORANGE, 0, 16, 1.8);
  private scale = 0;
  private energy = 0;

  public constructor() {
    this.group.name = 'solar-world';
    this.group.position.copy(SOLAR_POSITION);
    this.group.visible = false;
    this.group.add(this.visual);

    const core = new THREE.Mesh(this.sphereGeometry, this.coreMaterial);
    core.scale.setScalar(0.55);
    const energySphere = new THREE.Mesh(this.sphereGeometry, this.energyMaterial);
    energySphere.scale.setScalar(0.96);
    const shell = new THREE.Mesh(this.sphereGeometry, this.shellMaterial);
    shell.scale.setScalar(1.24);
    shell.rotation.set(0.2, 0.35, -0.15);
    this.visual.add(core, energySphere, shell);

    const orbitDefinitions = [
      { radius: 1.55, tube: 0.018, rotation: [0.22, 0.08, 0.35] },
      { radius: 1.92, tube: 0.024, rotation: [1.02, 0.34, -0.18] },
      { radius: 2.28, tube: 0.015, rotation: [0.58, 1.05, 0.7] },
      { radius: 2.62, tube: 0.012, rotation: [1.36, -0.52, 0.18] },
    ] as const;

    for (const definition of orbitDefinitions) {
      const material = new THREE.MeshBasicMaterial({
        color: GOLD,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(definition.radius, definition.tube, 8, 128),
        material,
      );
      ring.rotation.set(definition.rotation[0], definition.rotation[1], definition.rotation[2]);
      this.orbitMaterials.push(material);
      this.orbitRings.push(ring);
      this.visual.add(ring);
    }

    this.beams = new THREE.LineSegments(createBeamGeometry(), this.beamMaterial);
    this.sparks = new THREE.Points(createSparkGeometry(840), this.sparkMaterial);
    this.visual.add(this.beams, this.sparks);

    const glowDefinitions = [
      { color: HOT, scale: 2.3, opacity: 0.94 },
      { color: ORANGE, scale: 5.8, opacity: 0.55 },
      { color: '#ff4815', scale: 9.2, opacity: 0.22 },
    ] as const;
    for (const definition of glowDefinitions) {
      const material = new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: definition.color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.setScalar(definition.scale);
      sprite.userData.baseOpacity = definition.opacity;
      this.glowMaterials.push(material);
      this.visual.add(sprite);
    }

    this.light.position.set(0, 0, 0);
    this.group.add(this.light);
  }

  public update(
    elapsedSeconds: number,
    targetPresence: number,
    openness: number,
    zoom: number,
    handX: number,
    handY: number,
    deltaSeconds: number,
  ): void {
    const openAmount = THREE.MathUtils.smoothstep(openness, 0.04, 0.68);
    const targetScale = targetPresence * THREE.MathUtils.lerp(0.025, 1, openAmount);
    const targetEnergy = targetPresence * THREE.MathUtils.smoothstep(openness, 0.08, 0.5);
    const delta = Math.min(deltaSeconds, 0.1);
    this.scale = THREE.MathUtils.damp(this.scale, targetScale, 8.5, delta);
    this.energy = THREE.MathUtils.damp(this.energy, targetEnergy, 7.4, delta);
    this.group.visible = this.scale > 0.003 || this.energy > 0.003;
    if (!this.group.visible) return;

    const pulse = 1 + Math.sin(elapsedSeconds * 2.15) * 0.035;
    this.group.scale.setScalar(this.scale * pulse);
    this.visual.rotation.y = elapsedSeconds * 0.12 + (handX - 0.5) * 0.35;
    this.visual.rotation.x = (0.5 - handY) * 0.18;

    for (let index = 0; index < this.orbitRings.length; index += 1) {
      const ring = this.orbitRings[index];
      if (!ring) continue;
      ring.rotation.z += deltaSeconds * (0.11 + index * 0.055) * (index % 2 === 0 ? 1 : -1);
      ring.rotation.y += deltaSeconds * (0.035 + index * 0.012);
      ring.material.opacity = this.energy * (0.38 + zoom * 0.34 - index * 0.045);
    }

    this.beams.rotation.y = -elapsedSeconds * 0.085;
    this.beams.rotation.z = elapsedSeconds * 0.035;
    this.sparks.rotation.y = elapsedSeconds * 0.16;
    this.sparks.rotation.x = Math.sin(elapsedSeconds * 0.22) * 0.16;
    this.coreMaterial.opacity = this.energy;
    this.energyMaterial.opacity = this.energy * (0.54 + zoom * 0.22);
    this.shellMaterial.opacity = this.energy * (0.34 + zoom * 0.24);
    this.beamMaterial.opacity = this.energy * (0.48 + zoom * 0.42);
    this.sparkMaterial.opacity = this.energy * (0.68 + zoom * 0.28);
    this.sparkMaterial.size = 0.075 + zoom * 0.05;
    this.light.intensity = this.energy * (13 + zoom * 20);

    for (let index = 0; index < this.glowMaterials.length; index += 1) {
      const material = this.glowMaterials[index];
      if (!material) continue;
      const baseOpacity = index === 0 ? 0.94 : index === 1 ? 0.55 : 0.22;
      material.opacity = this.energy * baseOpacity * (1 + zoom * (0.25 - index * 0.05));
    }
  }

  public getFocusPosition(target: THREE.Vector3): THREE.Vector3 {
    return target.copy(this.group.position);
  }

  public dispose(): void {
    this.sphereGeometry.dispose();
    this.beams.geometry.dispose();
    this.beamMaterial.dispose();
    this.sparks.geometry.dispose();
    this.sparkMaterial.dispose();
    this.coreMaterial.dispose();
    this.energyMaterial.dispose();
    this.shellMaterial.dispose();
    for (const ring of this.orbitRings) ring.geometry.dispose();
    for (const material of this.orbitMaterials) material.dispose();
    for (const material of this.glowMaterials) material.dispose();
    this.glowTexture.dispose();
    this.light.dispose();
  }
}
