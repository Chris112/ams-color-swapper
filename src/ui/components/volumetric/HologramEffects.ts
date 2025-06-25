import * as THREE from 'three';
import { VolumetricData } from './types';

export class HologramEffects {
  private scene: THREE.Scene;
  private particleSystem: THREE.Points | null = null;
  private scanlinesMesh: THREE.Mesh | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private ambientParticles: THREE.Points | null = null;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  
  public createScanlines(dimensions: THREE.Vector3): void {
    const geometry = new THREE.PlaneGeometry(
      dimensions.x * 2,
      dimensions.y * 2,
      1,
      50
    );
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        opacity: { value: 0.1 }
      },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          vec3 pos = position;
          pos.y += sin(position.y * 10.0 + time) * 0.5;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float opacity;
        varying vec2 vUv;
        
        void main() {
          float scanline = sin(vUv.y * 200.0 + time * 10.0) * 0.5 + 0.5;
          vec3 color = vec3(0.0, 1.0, 1.0);
          gl_FragColor = vec4(color, scanline * opacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    
    this.scanlinesMesh = new THREE.Mesh(geometry, material);
    this.scanlinesMesh.rotation.y = Math.PI / 2;
    this.scene.add(this.scanlinesMesh);
  }
  
  public createAmbientParticles(dimensions: THREE.Vector3, count: number = 1000): void {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * dimensions.x * 2;
      positions[i3 + 1] = Math.random() * dimensions.y;
      positions[i3 + 2] = (Math.random() - 0.5) * dimensions.z * 2;
      
      // Cyan-ish color for holographic feel
      colors[i3] = 0.0;
      colors[i3 + 1] = 0.5 + Math.random() * 0.5;
      colors[i3 + 2] = 0.8 + Math.random() * 0.2;
      
      sizes[i] = Math.random() * 2 + 0.5;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float time;
        
        void main() {
          vColor = color;
          vec3 pos = position;
          pos.y += sin(time + position.x * 0.1) * 2.0;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        
        void main() {
          float dist = length(gl_PointCoord - 0.5) * 2.0;
          if (dist > 1.0) discard;
          float alpha = smoothstep(1.0, 0.0, dist) * 0.3;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      vertexColors: true,
      depthWrite: false
    });
    
    this.ambientParticles = new THREE.Points(geometry, material);
    this.scene.add(this.ambientParticles);
  }
  
  public createGrid(dimensions: THREE.Vector3): void {
    this.gridHelper = new THREE.GridHelper(
      Math.max(dimensions.x, dimensions.z),
      20,
      0x00ffff,
      0x004444
    );
    this.gridHelper.material.opacity = 0.2;
    this.gridHelper.material.transparent = true;
    this.scene.add(this.gridHelper);
  }
  
  public createPrintHeadParticles(position: THREE.Vector3): THREE.Points {
    const geometry = new THREE.BufferGeometry();
    const particleCount = 50;
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = position.x;
      positions[i3 + 1] = position.y;
      positions[i3 + 2] = position.z;
      
      // Random velocities for burst effect
      velocities[i3] = (Math.random() - 0.5) * 0.2;
      velocities[i3 + 1] = Math.random() * 0.2;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.2;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0x00ff00,
      size: 3,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    
    const particles = new THREE.Points(geometry, material);
    this.scene.add(particles);
    
    return particles;
  }
  
  public update(time: number): void {
    // Update scanlines
    if (this.scanlinesMesh) {
      (this.scanlinesMesh.material as THREE.ShaderMaterial).uniforms.time.value = time;
    }
    
    // Update ambient particles
    if (this.ambientParticles) {
      (this.ambientParticles.material as THREE.ShaderMaterial).uniforms.time.value = time;
    }
  }
  
  public dispose(): void {
    if (this.scanlinesMesh) {
      this.scene.remove(this.scanlinesMesh);
      this.scanlinesMesh.geometry.dispose();
      (this.scanlinesMesh.material as THREE.Material).dispose();
    }
    
    if (this.ambientParticles) {
      this.scene.remove(this.ambientParticles);
      this.ambientParticles.geometry.dispose();
      (this.ambientParticles.material as THREE.Material).dispose();
    }
    
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.geometry.dispose();
      (this.gridHelper.material as THREE.Material).dispose();
    }
    
    if (this.particleSystem) {
      this.scene.remove(this.particleSystem);
      this.particleSystem.geometry.dispose();
      (this.particleSystem.material as THREE.Material).dispose();
    }
  }
}