import * as THREE from 'three';
import { GALAXY } from '../config/constants';

export interface GalaxyData {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  randomness: Float32Array;
  radialFactors: Float32Array;
}

export function getAdaptiveParticleCount(): number {
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const isSmallScreen = window.innerWidth < 700;

  if (isSmallScreen || cores <= 4 || memory <= 4) return GALAXY.minParticles;
  if (cores >= 10 && memory >= 8) return GALAXY.maxParticles;
  return GALAXY.defaultParticles;
}

function randomGaussian(): number {
  const u = Math.max(Math.random(), Number.EPSILON);
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

export function generateGalaxy(count: number): GalaxyData {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const randomness = new Float32Array(count);
  const radialFactors = new Float32Array(count);

  const coreColor = new THREE.Color('#fff8e8');
  const blueColor = new THREE.Color('#74d9ff');
  const violetColor = new THREE.Color('#8d77ff');
  const edgeColor = new THREE.Color('#b9d9ff');
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const i3 = index * 3;
    const radialFactor = Math.random() < 0.18
      ? Math.pow(Math.random(), 2.2)
      : Math.pow(Math.random(), 0.72);
    const radius = Math.max(0.045, radialFactor * GALAXY.radius);
    const branchAngle = ((index % GALAXY.branches) / GALAXY.branches) * Math.PI * 2;
    const spiralAngle = branchAngle + radialFactor * GALAXY.spin * Math.PI * 2;
    const spread = (0.13 + radialFactor * GALAXY.randomness) * Math.pow(Math.random(), 0.72);
    const angularScatter = randomGaussian() * spread;
    const angle = spiralAngle + angularScatter;
    const radialScatter = randomGaussian() * GALAXY.randomness * (0.15 + radialFactor * 0.52);
    const finalRadius = Math.max(0.03, radius + radialScatter);
    const verticalSpread = (0.08 + radialFactor * 0.5) * (1 - radialFactor * 0.28);

    positions[i3] = Math.cos(angle) * finalRadius;
    positions[i3 + 1] = randomGaussian() * verticalSpread;
    positions[i3 + 2] = Math.sin(angle) * finalRadius;

    const colorChoice = Math.random();
    if (radialFactor < 0.11) {
      color.copy(coreColor).lerp(blueColor, radialFactor * 3.5);
    } else if (colorChoice < 0.48) {
      color.copy(blueColor).lerp(edgeColor, radialFactor * 0.55);
    } else {
      color.copy(violetColor).lerp(blueColor, Math.random() * 0.5);
    }

    const intensity = 0.92 + Math.random() * 0.5;
    colors[i3] = color.r * intensity;
    colors[i3 + 1] = color.g * intensity;
    colors[i3 + 2] = color.b * intensity;
    sizes[index] = radialFactor < 0.08
      ? 1.5 + Math.random() * 2.8
      : 0.72 + Math.pow(Math.random(), 3) * 2.9;
    randomness[index] = Math.random();
    radialFactors[index] = radialFactor;
  }

  return { positions, colors, sizes, randomness, radialFactors };
}

export function generateDistantStars(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const i3 = index * 3;
    const radius = 42 + Math.random() * 52;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.cos(phi) * 0.72;
    positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}
