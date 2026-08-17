import * as THREE from 'three';

interface PlanetDefinition {
  readonly radius: number;
  readonly size: number;
  readonly speed: number;
  readonly phase: number;
  readonly height: number;
  readonly tilt: number;
  readonly color: THREE.ColorRepresentation;
  readonly emissive: THREE.ColorRepresentation;
  readonly ring?: boolean;
}

interface PlanetRecord {
  readonly pivot: THREE.Object3D;
  readonly holder: THREE.Group;
  readonly surface: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  readonly atmosphere: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  readonly orbit: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  readonly ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null;
  readonly definition: PlanetDefinition;
}

const PLANETS: readonly PlanetDefinition[] = [
  { radius: 4.1, size: 0.28, speed: 0.19, phase: 0.3, height: 0.08, tilt: -0.08, color: '#8be8ff', emissive: '#156b91' },
  { radius: 6.2, size: 0.46, speed: -0.125, phase: 2.2, height: -0.16, tilt: 0.12, color: '#9c83ff', emissive: '#322178' },
  { radius: 8.6, size: 0.62, speed: 0.082, phase: 4.4, height: 0.23, tilt: -0.15, color: '#e0f7ff', emissive: '#368ca8', ring: true },
  { radius: 11.1, size: 0.38, speed: -0.058, phase: 1.1, height: -0.1, tilt: 0.18, color: '#67c6ff', emissive: '#164b9b' },
  { radius: 13.7, size: 0.76, speed: 0.037, phase: 3.25, height: 0.28, tilt: -0.1, color: '#ffb8e7', emissive: '#7b296c' },
];

function createOrbitGeometry(radius: number): THREE.BufferGeometry {
  const segments = 160;
  const positions = new Float32Array(segments * 3);

  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const offset = index * 3;
    positions[offset] = Math.cos(angle) * radius;
    positions[offset + 1] = 0;
    positions[offset + 2] = Math.sin(angle) * radius;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

export class PlanetarySystem {
  public readonly group = new THREE.Group();

  private readonly sphereGeometry = new THREE.SphereGeometry(1, 28, 18);
  private readonly records: PlanetRecord[] = [];
  private visibility = 0;

  public constructor() {
    this.group.name = 'planetary-system';
    this.group.visible = false;

    for (const definition of PLANETS) {
      const plane = new THREE.Group();
      plane.rotation.z = definition.tilt;

      const orbitMaterial = new THREE.LineBasicMaterial({
        color: '#8bdfff',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const orbit = new THREE.LineLoop(createOrbitGeometry(definition.radius), orbitMaterial);
      plane.add(orbit);

      const pivot = new THREE.Object3D();
      const holder = new THREE.Group();
      holder.position.set(definition.radius, definition.height, 0);

      const surfaceMaterial = new THREE.MeshStandardMaterial({
        color: definition.color,
        emissive: definition.emissive,
        emissiveIntensity: 0.5,
        metalness: 0.3,
        roughness: 0.58,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const surface = new THREE.Mesh(this.sphereGeometry, surfaceMaterial);
      surface.scale.setScalar(definition.size);

      const atmosphereMaterial = new THREE.MeshBasicMaterial({
        color: definition.color,
        transparent: true,
        opacity: 0,
        wireframe: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const atmosphere = new THREE.Mesh(this.sphereGeometry, atmosphereMaterial);
      atmosphere.scale.setScalar(definition.size * 1.12);

      let ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null;
      if (definition.ring) {
        const ringGeometry = new THREE.RingGeometry(definition.size * 1.35, definition.size * 2.15, 72);
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: '#a7e7ff',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI * 0.44;
        ring.rotation.z = Math.PI * 0.13;
        holder.add(ring);
      }

      holder.add(surface, atmosphere);
      pivot.add(holder);
      plane.add(pivot);
      this.group.add(plane);
      this.records.push({ pivot, holder, surface, atmosphere, orbit, ring, definition });
    }
  }

  public update(elapsedSeconds: number, targetVisibility: number, zoom: number, deltaSeconds: number): void {
    this.visibility = THREE.MathUtils.damp(this.visibility, targetVisibility, 7, Math.min(deltaSeconds, 0.1));
    this.group.visible = this.visibility > 0.004;
    if (!this.group.visible) return;

    const reveal = THREE.MathUtils.smoothstep(this.visibility, 0, 1);
    this.group.rotation.y = elapsedSeconds * 0.006;

    for (let index = 0; index < this.records.length; index += 1) {
      const record = this.records[index];
      if (!record) continue;

      const stagger = THREE.MathUtils.smoothstep(reveal, index * 0.075, 0.52 + index * 0.07);
      const pulse = 1 + Math.sin(elapsedSeconds * 0.7 + record.definition.phase) * 0.025;
      record.pivot.rotation.y = record.definition.phase + elapsedSeconds * record.definition.speed;
      record.holder.rotation.y = -record.pivot.rotation.y * 0.35 + elapsedSeconds * 0.08;
      record.holder.scale.setScalar((0.68 + stagger * 0.32 + zoom * 0.08) * pulse);
      record.orbit.material.opacity = stagger * (0.075 + zoom * 0.1);
      record.surface.material.opacity = stagger * 0.96;
      record.surface.material.emissiveIntensity = 0.45 + zoom * 0.95;
      record.atmosphere.material.opacity = stagger * (0.08 + zoom * 0.14);
      record.atmosphere.rotation.y = elapsedSeconds * (0.05 + index * 0.012);
      if (record.ring) record.ring.material.opacity = stagger * (0.34 + zoom * 0.18);
    }
  }

  public dispose(): void {
    this.sphereGeometry.dispose();
    for (const record of this.records) {
      record.orbit.geometry.dispose();
      record.orbit.material.dispose();
      record.surface.material.dispose();
      record.atmosphere.material.dispose();
      record.ring?.geometry.dispose();
      record.ring?.material.dispose();
    }
  }
}
