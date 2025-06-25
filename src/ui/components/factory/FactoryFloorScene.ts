import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EventEmitter } from '../../../core/EventEmitter';

export interface FactoryFloorEvents {
  printClicked: (printId: string) => void;
  sceneReady: () => void;
  animationProgress: (progress: number) => void;
}

export interface PrintObject {
  id: string;
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  metadata: {
    filename: string;
    layers: number;
    colors: string[];
    printTime?: string;
  };
}

export class FactoryFloorScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private eventEmitter: EventEmitter<FactoryFloorEvents>;
  
  private container: HTMLElement;
  private animationId: number | null = null;
  private prints: Map<string, PrintObject> = new Map();
  private gridHelper: THREE.GridHelper;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  
  // Fog and atmosphere settings
  private fog: THREE.Fog;
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;
  private spotLight: THREE.SpotLight;
  
  // Floor settings (scaled to match print dimensions)
  // Typical print bed: 220x220mm -> 22x22 units after scaling
  private readonly FLOOR_SIZE = 50;  // Reduced from 200
  private readonly GRID_DIVISIONS = 50; // Reduced proportionally
  private readonly PRINT_SPACING = 3;   // Reduced spacing
  
  constructor(container: HTMLElement) {
    // FactoryFloorScene constructor called
    this.container = container;
    this.eventEmitter = new EventEmitter();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Initializing Three.js scene...
    this.initializeScene();
    this.setupLighting();
    this.setupFloor();
    this.setupControls();
    this.setupEventListeners();
    this.startRenderLoop();
    
    // FactoryFloorScene initialization complete
    this.eventEmitter.emit('sceneReady');
  }

  private initializeScene(): void {
    // Setting up Three.js scene...
    
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0a);
    // Scene created
    
    // Camera setup
    const containerWidth = this.container.clientWidth || 800;
    const containerHeight = this.container.clientHeight || 600;
    // Container dimensions calculated
    
    this.camera = new THREE.PerspectiveCamera(
      75,
      containerWidth / containerHeight,
      0.1,
      1000
    );
    this.camera.position.set(20, 15, 20);
    this.camera.lookAt(0, 0, 0);
    // Camera created and positioned
    
    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(containerWidth, containerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    
    // Renderer created, adding to container...
    
    // Style the canvas to ensure it's visible
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    
    this.container.appendChild(canvas);
    // Canvas added to container with styling
    
    // Atmospheric fog - scaled for smaller scene
    this.fog = new THREE.Fog(0x0a0a0a, 20, 80); // Reduced distances
    this.scene.fog = this.fog;
    
    // Scene initialization complete
  }

  private setupLighting(): void {
    // Ambient light for general illumination
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(this.ambientLight);
    
    // Directional light (sun-like) - scaled for smaller scene
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.directionalLight.position.set(25, 40, 25); // Reduced scale
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.near = 0.1;
    this.directionalLight.shadow.camera.far = 100; // Reduced
    this.directionalLight.shadow.camera.left = -30; // Reduced
    this.directionalLight.shadow.camera.right = 30;
    this.directionalLight.shadow.camera.top = 30;
    this.directionalLight.shadow.camera.bottom = -30;
    this.scene.add(this.directionalLight);
    
    // Spot light for dramatic effect - scaled
    this.spotLight = new THREE.SpotLight(0x4080ff, 1, 60, Math.PI / 6, 0.3); // Reduced distance
    this.spotLight.position.set(0, 30, 0); // Reduced height
    this.spotLight.target.position.set(0, 0, 0);
    this.spotLight.castShadow = true;
    this.scene.add(this.spotLight);
    this.scene.add(this.spotLight.target);
  }

  private setupFloor(): void {
    // Setting up floor...
    
    // Grid helper for factory floor
    this.gridHelper = new THREE.GridHelper(
      this.FLOOR_SIZE, 
      this.GRID_DIVISIONS, 
      0x333333, 
      0x1a1a1a
    );
    this.gridHelper.material.opacity = 0.3;
    this.gridHelper.material.transparent = true;
    this.scene.add(this.gridHelper);
    // Grid helper added
    
    // Reflective floor plane
    const floorGeometry = new THREE.PlaneGeometry(this.FLOOR_SIZE, this.FLOOR_SIZE);
    const floorMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x111111,
      transparent: true,
      opacity: 0.8
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    // Floor plane added
    
    // Factory floor setup complete
  }

  private setupControls(): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    
    // Restrict camera movement to keep model visible
    this.controls.minDistance = 2;
    this.controls.maxDistance = 50;
    this.controls.maxPolarAngle = Math.PI / 2.2; // Don't let camera go below ground
    this.controls.minPolarAngle = Math.PI / 6;   // Don't let camera go too high above
    
    // Limit horizontal rotation to prevent disorientation
    this.controls.minAzimuthAngle = -Math.PI / 2; // 90 degrees left
    this.controls.maxAzimuthAngle = Math.PI / 2;  // 90 degrees right
    
    // Set initial target
    this.controls.target.set(0, 2, 0); // Look slightly up from center
    
    // Reduce sensitivity to prevent jumpy movement
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 0.8;
    this.controls.panSpeed = 0.3;
    
    // Prevent camera target from changing unexpectedly
    this.controls.enablePan = false; // Disable panning to prevent camera jumping
    
    // Auto-rotate option (disabled by default, could be user preference)
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0.5;
  }

  private setupEventListeners(): void {
    let mouseDownTime = 0;
    let mouseDownPosition = { x: 0, y: 0 };
    
    // Track mouse down to distinguish between click and drag
    this.renderer.domElement.addEventListener('mousedown', (event) => {
      mouseDownTime = Date.now();
      mouseDownPosition = { x: event.clientX, y: event.clientY };
    });
    
    // Only handle clicks that aren't drags (for print selection)
    this.renderer.domElement.addEventListener('mouseup', (event) => {
      const mouseUpTime = Date.now();
      const timeDiff = mouseUpTime - mouseDownTime;
      const distance = Math.sqrt(
        Math.pow(event.clientX - mouseDownPosition.x, 2) + 
        Math.pow(event.clientY - mouseDownPosition.y, 2)
      );
      
      // Only treat as a click if it was quick and didn't move much
      if (timeDiff < 200 && distance < 5) {
        this.onMouseClick(event);
      }
    });
    
    // Window resize handling
    window.addEventListener('resize', () => {
      this.onWindowResize();
    });
  }

  private onMouseClick(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const clickableObjects = Array.from(this.prints.values()).map(p => p.mesh);
    const intersects = this.raycaster.intersectObjects(clickableObjects, true);
    
    if (intersects.length > 0) {
      const clickedObject = intersects[0].object;
      // Find the print that contains this mesh
      for (const [id, printObj] of this.prints) {
        if (this.isChildOf(clickedObject, printObj.mesh)) {
          this.eventEmitter.emit('printClicked', id);
          break;
        }
      }
    }
  }

  private isChildOf(child: THREE.Object3D, parent: THREE.Object3D): boolean {
    let current = child;
    while (current.parent) {
      if (current.parent === parent) return true;
      current = current.parent;
    }
    return false;
  }

  private onWindowResize(): void {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  private startRenderLoop(): void {
    let frameCount = 0;
    const render = () => {
      this.animationId = requestAnimationFrame(render);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      
      // Debug: first few frames rendered
      if (frameCount < 5) {
        frameCount++;
      }
    };
    // Starting render loop...
    render();
  }

  public addPrint(printObject: PrintObject): void {
    if (this.prints.has(printObject.id)) {
      this.removePrint(printObject.id);
    }
    
    // Position the print on the factory floor
    const position = this.findNextPosition();
    printObject.mesh.position.copy(position);
    printObject.position = position;
    
    // Enable shadows
    printObject.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    this.scene.add(printObject.mesh);
    this.prints.set(printObject.id, printObject);
    
    // Auto-fit camera to show the print properly
    if (this.prints.size === 1) {
      // First print - adjust camera to fit the model and update controls target
      this.fitCameraToObject(printObject.mesh);
      // Update controls target to center on the print
      this.controls.target.copy(printObject.position);
      this.controls.target.y += 2; // Look slightly above the print
      this.controls.update();
    }
    
    // Animate the print appearing
    this.animatePrintAppearance(printObject.mesh);
  }

  public removePrint(printId: string): void {
    const printObject = this.prints.get(printId);
    if (printObject) {
      this.scene.remove(printObject.mesh);
      this.prints.delete(printId);
    }
  }

  public focusOnPrint(printId: string): void {
    const printObject = this.prints.get(printId);
    if (printObject) {
      const target = printObject.position.clone();
      const offset = new THREE.Vector3(10, 8, 10);
      const newPosition = target.clone().add(offset);
      
      this.animateCameraTo(newPosition, target);
    }
  }

  public resetCamera(): void {
    const defaultPosition = new THREE.Vector3(20, 15, 20);
    const defaultTarget = new THREE.Vector3(0, 2, 0); // Look slightly above center
    this.animateCameraTo(defaultPosition, defaultTarget);
  }

  public lockCameraTarget(): void {
    // Lock the camera target to prevent unexpected jumping
    const currentTarget = this.controls.target.clone();
    this.controls.target.copy(currentTarget);
    this.controls.update();
  }

  private findNextPosition(): THREE.Vector3 {
    const positions = Array.from(this.prints.values()).map(p => p.position);
    
    // Simple grid positioning algorithm
    for (let x = -this.FLOOR_SIZE / 2 + this.PRINT_SPACING; x < this.FLOOR_SIZE / 2; x += this.PRINT_SPACING) {
      for (let z = -this.FLOOR_SIZE / 2 + this.PRINT_SPACING; z < this.FLOOR_SIZE / 2; z += this.PRINT_SPACING) {
        const candidate = new THREE.Vector3(x, 0, z);
        const tooClose = positions.some(pos => 
          pos.distanceTo(candidate) < this.PRINT_SPACING
        );
        
        if (!tooClose) {
          return candidate;
        }
      }
    }
    
    // Fallback to random position if grid is full
    return new THREE.Vector3(
      (Math.random() - 0.5) * this.FLOOR_SIZE * 0.8,
      0,
      (Math.random() - 0.5) * this.FLOOR_SIZE * 0.8
    );
  }

  private animatePrintAppearance(mesh: THREE.Object3D): void {
    mesh.scale.setScalar(0);
    mesh.position.y = -2;
    
    const targetScale = 1;
    const targetY = 0;
    const duration = 1000; // ms
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
      
      mesh.scale.setScalar(easeProgress * targetScale);
      mesh.position.y = (1 - easeProgress) * -2 + easeProgress * targetY;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  private fitCameraToObject(object: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Print bounding box calculated
    
    // Add debug helpers
    this.addDebugHelpers(object, box);
    
    // Calculate the camera distance needed to fit the object
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraDistance = Math.abs(maxDim / Math.sin(fov / 2)) * 1.5; // Add some padding
    
    // Ensure minimum distance for very small objects
    cameraDistance = Math.max(cameraDistance, 5);
    
    // Position camera at an angle to see the print properly
    const cameraPosition = new THREE.Vector3(
      center.x + cameraDistance * 0.7,
      center.y + cameraDistance * 0.5,
      center.z + cameraDistance * 0.7
    );
    
    // Auto-positioning camera
    
    this.animateCameraTo(cameraPosition, center);
  }

  private addDebugHelpers(object: THREE.Object3D, boundingBox: THREE.Box3): void {
    // Add bounding box helper
    const boxHelper = new THREE.Box3Helper(boundingBox, 0xffff00);
    boxHelper.name = 'boundingBoxHelper';
    this.scene.add(boxHelper);
    
    // Add coordinate axes at the center of the print
    const center = boundingBox.getCenter(new THREE.Vector3());
    const axesHelper = new THREE.AxesHelper(2); // 2 units long
    axesHelper.position.copy(center);
    axesHelper.name = 'printAxesHelper';
    this.scene.add(axesHelper);
    
    // Add world coordinate axes at origin
    const worldAxes = new THREE.AxesHelper(5);
    worldAxes.name = 'worldAxesHelper';
    this.scene.add(worldAxes);
    
    // Debug helpers added: bounding box, print axes, world axes
  }

  public removeDebugHelpers(): void {
    const helpersToRemove = ['boundingBoxHelper', 'printAxesHelper', 'worldAxesHelper'];
    helpersToRemove.forEach(name => {
      const helper = this.scene.getObjectByName(name);
      if (helper) {
        this.scene.remove(helper);
      }
    });
  }

  private animateCameraTo(position: THREE.Vector3, target: THREE.Vector3): void {
    // Safety check: don't animate to extreme positions
    const maxDistance = 100;
    if (position.length() > maxDistance) {
      // Camera position too far, clamping to safe distance
      position.normalize().multiplyScalar(maxDistance);
    }
    
    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const duration = 1500; // ms
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      this.camera.position.lerpVectors(startPosition, position, easeProgress);
      this.controls.target.lerpVectors(startTarget, target, easeProgress);
      this.controls.update();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  public on<K extends keyof FactoryFloorEvents>(
    event: K,
    handler: FactoryFloorEvents[K]
  ): void {
    this.eventEmitter.on(event, handler);
  }

  public off<K extends keyof FactoryFloorEvents>(
    event: K,
    handler: FactoryFloorEvents[K]
  ): void {
    this.eventEmitter.off(event, handler);
  }

  public dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    this.controls.dispose();
    this.renderer.dispose();
    
    // Clean up geometries and materials
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) {
          object.material.dispose();
        }
      }
    });
    
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  public getPrintCount(): number {
    return this.prints.size;
  }

  public getAllPrints(): PrintObject[] {
    return Array.from(this.prints.values());
  }
}