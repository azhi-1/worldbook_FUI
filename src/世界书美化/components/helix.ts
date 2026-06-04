// 本仓库根依赖暂未安装 three；这里复用 DNA_ribbon 原生项目中已验证的本地 three module。
// @ts-ignore - three.module.js 来自子项目 node_modules，allowJs 会让 webpack 正常打包。
import * as THREE from '../../../projects/love-meido-moemoekyuu/jsscript/nerv_ach/DNA_ribbon/node_modules/three/build/three.module.js';

export interface HelixOptions {
  baseColor: string;
  bgColor: string | 'transparent';
  baseSpeed: number;
  hoverSpeed: number;
  xDragSensitivity: number;
  yDragSensitivity: number;
  rotationX: number;
  lineCount: number;
  twistCount: number;
  amplitude: number;
  lineWidth: number;
  opacity: number;
  rgbIntensity: number;
  rgbMaxOffset: number;
  rgbSpeedGain: number;
  rgbDamping: number;
  eventTarget?: HTMLElement;
}

const DEFAULT_OPTIONS: HelixOptions = {
  baseColor: '#737373',
  bgColor: 'transparent',
  baseSpeed: 0.002,
  hoverSpeed: 0.008,
  xDragSensitivity: 0.009,
  yDragSensitivity: 0.01,
  rotationX: 0,
  lineCount: 67,
  twistCount: 5.5,
  amplitude: 19,
  lineWidth: 0.8,
  opacity: 0.4,
  rgbIntensity: 0.015,
  rgbMaxOffset: 0.1,
  rgbSpeedGain: 0.02,
  rgbDamping: 0.03,
};

const VIRTUAL_WIDTH = 4000;
const MAX_LINES = 150;
const DRAG_START_THRESHOLD = 3;

/**
 * Three.js 参数化 DNA / 光纤丝带束。
 * 原型来自 projects/love-meido-moemoekyuu/jsscript/nerv_ach/DNA_ribbon/src/lib/HelixHeader.ts。
 */
export class HelixHeader {
  private container: HTMLElement;
  private options: HelixOptions;
  private eventTarget: HTMLElement;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private animationFrameId = 0;

  private renderTarget!: THREE.WebGLRenderTarget;
  private postScene!: THREE.Scene;
  private postCamera!: THREE.OrthographicCamera;
  private postMaterial!: THREE.ShaderMaterial;
  private postQuad!: THREE.Mesh;

  private geometry!: THREE.CylinderGeometry;
  private instancedMesh!: THREE.InstancedMesh;
  private material!: THREE.ShaderMaterial;

  private time = 0;
  private currentSpeed = 0;
  private targetSpeed = 0;
  private currentRotationX = 0;
  private targetRotationX = 0;
  private currentRgbOffset = 0;
  private targetRgbOffset = 0;

  private isDragging = false;
  private isPointerActive = false;
  private isHovering = false;
  private activePointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, options: Partial<HelixOptions> = {}) {
    this.container = container;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.eventTarget = options.eventTarget
      ?? (container.closest('.wb-dna') as HTMLElement | null)
      ?? container;

    this.currentSpeed = this.options.baseSpeed;
    this.targetSpeed = this.options.baseSpeed;
    this.currentRotationX = this.options.rotationX;
    this.targetRotationX = this.options.rotationX;

    this.initThree();
    this.initGeometry();
    this.initPostProcessing();
    this.bindEvents();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.animate();
  }

  private initThree() {
    let { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0) w = window.innerWidth;
    if (h === 0) h = 150;

    this.scene = new THREE.Scene();
    if (this.options.bgColor !== 'transparent') {
      this.scene.background = new THREE.Color(this.options.bgColor);
    }

    this.camera = new THREE.PerspectiveCamera(45, w / h, 1, 1000);
    this.camera.position.z = 100;
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    if (window.getComputedStyle(this.container).position === 'static') {
      this.container.style.position = 'relative';
    }

    const canvas = this.renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
  }

  private initGeometry() {
    const { lineWidth, baseColor, opacity, twistCount, amplitude } = this.options;
    const activeLines = Math.min(this.options.lineCount, MAX_LINES);

    this.geometry = new THREE.CylinderGeometry(lineWidth, lineWidth, VIRTUAL_WIDTH, 5, 128, true);
    this.geometry.rotateZ(Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(baseColor) },
        uTwist: { value: twistCount },
        uAmplitude: { value: amplitude },
        uOpacity: { value: opacity },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uTwist;
        uniform float uAmplitude;
        attribute float aPhase;
        attribute float aRadiusOffset;
        varying float vDepth;

        void main() {
          vec3 transformed = position;
          float nx = (transformed.x / ${VIRTUAL_WIDTH}.0) + 0.5;
          float angle = nx * uTwist * 3.14159 * 2.0 + uTime + aPhase;
          float r = uAmplitude + aRadiusOffset;
          transformed.y += cos(angle) * r;
          transformed.z += sin(angle) * r;

          vec4 mvPosition = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            mvPosition = instanceMatrix * mvPosition;
          #endif

          vec4 worldPosition = modelMatrix * mvPosition;
          vDepth = worldPosition.z;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uAmplitude;
        varying float vDepth;

        void main() {
          float depthFactor = smoothstep(-uAmplitude * 1.5, uAmplitude * 1.5, vDepth);
          vec3 finalColor = mix(uColor * 0.1, uColor * 1.8, depthFactor);
          gl_FragColor = vec4(finalColor, uOpacity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.instancedMesh = new THREE.InstancedMesh(this.geometry, this.material, MAX_LINES);
    this.instancedMesh.count = activeLines;
    this.instancedMesh.frustumCulled = false;

    const phases = new Float32Array(MAX_LINES);
    const radiusOffsets = new Float32Array(MAX_LINES);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < MAX_LINES; i += 1) {
      const strand = i % 3;
      const spread = (Math.random() - 0.5) * 1.2;
      phases[i] = strand * (Math.PI * 2 / 3) + spread;
      radiusOffsets[i] = (Math.random() * 2.0 - 1.0) * (this.options.amplitude * 0.3);
      dummy.position.set(0, 0, 0);
      dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, dummy.matrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    this.geometry.setAttribute('aRadiusOffset', new THREE.InstancedBufferAttribute(radiusOffsets, 1));
    this.instancedMesh.rotation.x = this.options.rotationX;
    this.scene.add(this.instancedMesh);
  }

  private initPostProcessing() {
    let { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0) w = window.innerWidth;
    if (h === 0) h = 150;

    const pixelRatio = this.renderer.getPixelRatio();
    this.renderTarget = new THREE.WebGLRenderTarget(w * pixelRatio, h * pixelRatio, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene = new THREE.Scene();
    this.postMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.renderTarget.texture },
        uRgbOffset: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uRgbOffset;
        varying vec2 vUv;

        void main() {
          vec2 offset = vec2(uRgbOffset, 0.0);
          vec4 cr = texture2D(tDiffuse, vUv + offset);
          vec4 cg = texture2D(tDiffuse, vUv);
          vec4 cb = texture2D(tDiffuse, vUv - offset);
          float maxAlpha = max(cr.a, max(cg.a, cb.a));
          gl_FragColor = vec4(cr.r, cg.g, cb.b, maxAlpha);
        }
      `,
      transparent: true,
      blending: THREE.NormalBlending,
    });

    this.postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial);
    this.postScene.add(this.postQuad);
  }

  private bindEvents() {
    this.eventTarget.addEventListener('pointerdown', this.onPointerDown);
    this.eventTarget.addEventListener('pointermove', this.onPointerMove);
    this.eventTarget.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.eventTarget.addEventListener('pointerenter', this.onEnter);
    this.eventTarget.addEventListener('pointerleave', this.onLeave);
  }

  private onEnter = () => {
    this.isHovering = true;
    if (!this.isPointerActive) this.targetSpeed = this.options.hoverSpeed;
  };

  private onLeave = () => {
    this.isHovering = false;
    if (!this.isPointerActive) this.targetSpeed = this.options.baseSpeed;
  };

  private onPointerDown = (event: PointerEvent) => {
    this.isPointerActive = true;
    this.isDragging = false;
    this.activePointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.lastX = event.clientX;
    this.targetSpeed = this.options.baseSpeed;
    this.targetRgbOffset = 0;
    if (this.eventTarget.setPointerCapture) {
      try {
        this.eventTarget.setPointerCapture(event.pointerId);
      } catch {
        // Some browsers only allow capture on the original event target.
      }
    }
    event.preventDefault();
    event.stopPropagation();
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.isPointerActive) return;
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) return;
    if (event.currentTarget === this.eventTarget) event.stopPropagation();

    const totalDeltaX = event.clientX - this.startX;
    const deltaX = event.clientX - this.lastX;
    const deltaY = event.clientY - this.startY;

    if (!this.isDragging) {
      const distance = Math.hypot(totalDeltaX, deltaY);
      if (distance < DRAG_START_THRESHOLD) return;
      this.isDragging = true;
    }

    if (Math.abs(deltaX) > 0) {
      this.time += deltaX * this.options.xDragSensitivity;
      const rgbOffset = Math.min(
        Math.abs(deltaX) * this.options.rgbIntensity,
        this.options.rgbMaxOffset,
      );
      this.targetRgbOffset = rgbOffset;
      this.currentRgbOffset = Math.max(this.currentRgbOffset, rgbOffset * 0.4);
    }

    this.targetRotationX = this.currentRotationX + deltaY * this.options.yDragSensitivity;
    this.lastX = event.clientX;
  };

  private onPointerUp = (event?: PointerEvent) => {
    if (event && this.activePointerId !== null && event.pointerId !== this.activePointerId) return;
    if (event?.currentTarget === this.eventTarget) event.stopPropagation();
    this.isPointerActive = false;
    this.isDragging = false;
    this.activePointerId = null;
    this.targetSpeed = this.options.baseSpeed;
    this.targetRgbOffset = 0.0;
    this.currentRotationX = this.targetRotationX;
    if (event && this.eventTarget.releasePointerCapture) {
      try {
        this.eventTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
    }
  };

  resize() {
    if (!this.camera || !this.renderer) return;
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;

    const pixelRatio = this.renderer.getPixelRatio();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderTarget.setSize(Math.max(1, w * pixelRatio), Math.max(1, h * pixelRatio));
  }

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.currentSpeed += (this.targetSpeed - this.currentSpeed) * 0.1;
    this.time += this.currentSpeed;
    this.currentRgbOffset += (this.targetRgbOffset - this.currentRgbOffset) * this.options.rgbDamping;
    this.instancedMesh.rotation.x += (this.targetRotationX - this.instancedMesh.rotation.x) * 0.1;
    this.material.uniforms.uTime.value = this.time;
    this.postMaterial.uniforms.uRgbOffset.value = this.currentRgbOffset;

    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  };

  setOption(key: keyof HelixOptions, value: number | string) {
    (this.options as Record<string, number | string>)[key] = value;
    if (key === 'baseColor') this.material.uniforms.uColor.value = new THREE.Color(value as string);
    if (key === 'opacity') this.material.uniforms.uOpacity.value = value as number;
    if (key === 'twistCount') this.material.uniforms.uTwist.value = value as number;
    if (key === 'amplitude') this.material.uniforms.uAmplitude.value = value as number;
    if (key === 'lineCount') this.instancedMesh.count = Math.min(value as number, MAX_LINES);
  }

  setBaseColor(color: string) {
    this.setOption('baseColor', color);
  }

  updateData(payload: Partial<HelixOptions>) {
    for (const [key, value] of Object.entries(payload)) {
      this.setOption(key as keyof HelixOptions, value);
    }
  }

  destroy() {
    cancelAnimationFrame(this.animationFrameId);
    this.resizeObserver.disconnect();
    this.eventTarget.removeEventListener('pointerdown', this.onPointerDown);
    this.eventTarget.removeEventListener('pointermove', this.onPointerMove);
    this.eventTarget.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.eventTarget.removeEventListener('pointerenter', this.onEnter);
    this.eventTarget.removeEventListener('pointerleave', this.onLeave);
    this.geometry.dispose();
    this.material.dispose();
    this.postMaterial.dispose();
    this.renderTarget.dispose();
    if (this.renderer.domElement && this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
