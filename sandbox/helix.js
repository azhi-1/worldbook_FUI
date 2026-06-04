/**
 * HelixHeader - DNA ribbon visualization engine
 * Ported from DNA_ribbon (Gemini), parameterized for FUI no_signal state
 * Requires THREE.js global
 */
(function () {
  const DEFAULT_OPTIONS = {
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

  class HelixHeader {
    constructor(container, options) {
      this.container = container;
      this.options = Object.assign({}, DEFAULT_OPTIONS, options);

      this.time = 0;
      this.currentSpeed = this.options.baseSpeed;
      this.targetSpeed = this.options.baseSpeed;
      this.currentRotationX = this.options.rotationX;
      this.targetRotationX = this.options.rotationX;
      this.currentRgbOffset = 0;
      this.targetRgbOffset = 0;
      this.isDragging = false;
      this.startX = 0;
      this.startY = 0;
      this.lastX = 0;
      this.animationFrameId = 0;

      this._onPointerDown = this._onPointerDown.bind(this);
      this._onPointerMove = this._onPointerMove.bind(this);
      this._onPointerUp = this._onPointerUp.bind(this);
      this._onEnter = this._onEnter.bind(this);
      this._onLeave = this._onLeave.bind(this);
      this._animate = this._animate.bind(this);

      this._initThree();
      this._initGeometry();
      this._initPostProcessing();
      this._bindEvents();

      this.resizeObserver = new ResizeObserver(function () { this.resize(); }.bind(this));
      this.resizeObserver.observe(this.container);

      this._animate();
    }

    _initThree() {
      var w = this.container.clientWidth || window.innerWidth;
      var h = this.container.clientHeight || 150;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(45, w / h, 1, 1000);
      this.camera.position.z = 100;
      this.camera.lookAt(0, 0, 0);

      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setClearColor(0x000000, 0);
      this.container.appendChild(this.renderer.domElement);

      var cssPosition = window.getComputedStyle(this.container).position;
      if (cssPosition === 'static') this.container.style.position = 'relative';

      var canvas = this.renderer.domElement;
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.pointerEvents = 'none';
    }

    _initGeometry() {
      var opts = this.options;
      var activeLines = Math.min(opts.lineCount, MAX_LINES);

      this.geometry = new THREE.CylinderGeometry(opts.lineWidth, opts.lineWidth, VIRTUAL_WIDTH, 5, 128, true);
      this.geometry.rotateZ(Math.PI / 2);

      this.material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(opts.baseColor) },
          uTwist: { value: opts.twistCount },
          uAmplitude: { value: opts.amplitude },
          uOpacity: { value: opts.opacity }
        },
        vertexShader: [
          'uniform float uTime;',
          'uniform float uTwist;',
          'uniform float uAmplitude;',
          'attribute float aPhase;',
          'attribute float aRadiusOffset;',
          'varying float vDepth;',
          'void main() {',
          '  vec3 transformed = position;',
          '  float nx = (transformed.x / ' + VIRTUAL_WIDTH + '.0) + 0.5;',
          '  float angle = nx * uTwist * 3.14159 * 2.0 + uTime + aPhase;',
          '  float r = uAmplitude + aRadiusOffset;',
          '  transformed.y += cos(angle) * r;',
          '  transformed.z += sin(angle) * r;',
          '  vec4 mvPosition = vec4(transformed, 1.0);',
          '  #ifdef USE_INSTANCING',
          '    mvPosition = instanceMatrix * mvPosition;',
          '  #endif',
          '  vec4 worldPosition = modelMatrix * mvPosition;',
          '  vDepth = worldPosition.z;',
          '  gl_Position = projectionMatrix * viewMatrix * worldPosition;',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform vec3 uColor;',
          'uniform float uOpacity;',
          'uniform float uAmplitude;',
          'varying float vDepth;',
          'void main() {',
          '  float depthFactor = smoothstep(-uAmplitude * 1.5, uAmplitude * 1.5, vDepth);',
          '  vec3 finalColor = mix(uColor * 0.1, uColor * 1.8, depthFactor);',
          '  gl_FragColor = vec4(finalColor, uOpacity);',
          '}'
        ].join('\n'),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      this.instancedMesh = new THREE.InstancedMesh(this.geometry, this.material, MAX_LINES);
      this.instancedMesh.count = activeLines;
      this.instancedMesh.frustumCulled = false;

      var phases = new Float32Array(MAX_LINES);
      var radiusOffsets = new Float32Array(MAX_LINES);
      var dummy = new THREE.Object3D();

      for (var i = 0; i < MAX_LINES; i++) {
        var strand = i % 3;
        var spread = (Math.random() - 0.5) * 1.2;
        phases[i] = (strand * (Math.PI * 2 / 3)) + spread;
        radiusOffsets[i] = (Math.random() * 2.0 - 1.0) * (opts.amplitude * 0.3);
        dummy.position.set(0, 0, 0);
        dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, dummy.matrix);
      }
      this.instancedMesh.instanceMatrix.needsUpdate = true;

      this.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
      this.geometry.setAttribute('aRadiusOffset', new THREE.InstancedBufferAttribute(radiusOffsets, 1));

      this.instancedMesh.rotation.x = opts.rotationX;
      this.scene.add(this.instancedMesh);
    }

    _initPostProcessing() {
      var w = this.container.clientWidth || window.innerWidth;
      var h = this.container.clientHeight || 150;
      var pixelRatio = this.renderer.getPixelRatio();

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
          uRgbOffset: { value: 0.0 }
        },
        vertexShader: [
          'varying vec2 vUv;',
          'void main() {',
          '  vUv = uv;',
          '  gl_Position = vec4(position, 1.0);',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform sampler2D tDiffuse;',
          'uniform float uRgbOffset;',
          'varying vec2 vUv;',
          'void main() {',
          '  vec2 offset = vec2(uRgbOffset, 0.0);',
          '  vec4 cr = texture2D(tDiffuse, vUv + offset);',
          '  vec4 cg = texture2D(tDiffuse, vUv);',
          '  vec4 cb = texture2D(tDiffuse, vUv - offset);',
          '  float maxAlpha = max(cr.a, max(cg.a, cb.a));',
          '  gl_FragColor = vec4(cr.r, cg.g, cb.b, maxAlpha);',
          '}'
        ].join('\n'),
        transparent: true,
        blending: THREE.NormalBlending
      });

      this.postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial);
      this.postScene.add(this.postQuad);
    }

    _bindEvents() {
      this.container.addEventListener('pointerdown', this._onPointerDown);
      window.addEventListener('pointermove', this._onPointerMove);
      window.addEventListener('pointerup', this._onPointerUp);
      this.container.addEventListener('pointerenter', this._onEnter);
      this.container.addEventListener('pointerleave', this._onLeave);
    }

    _onEnter() {
      if (!this.isDragging) this.targetSpeed = this.options.hoverSpeed;
    }

    _onLeave() {
      if (!this.isDragging) this.targetSpeed = this.options.baseSpeed;
    }

    _onPointerDown(e) {
      this.isDragging = true;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.lastX = e.clientX;
      e.preventDefault();
    }

    _onPointerMove(e) {
      if (!this.isDragging) return;
      var deltaX = e.clientX - this.lastX;
      var deltaY = e.clientY - this.startY;

      if (Math.abs(deltaX) > 0) {
        this.time += deltaX * this.options.xDragSensitivity;
        this.targetRgbOffset = Math.min(
          Math.abs(deltaX) * this.options.rgbIntensity,
          this.options.rgbMaxOffset
        );
      }

      this.targetRotationX = this.currentRotationX + deltaY * this.options.yDragSensitivity;
      this.lastX = e.clientX;
    }

    _onPointerUp() {
      this.isDragging = false;
      this.targetSpeed = this.options.baseSpeed;
      this.targetRgbOffset = 0.0;
      this.currentRotationX = this.targetRotationX;
    }

    resize() {
      if (!this.camera || !this.renderer) return;
      var w = this.container.clientWidth;
      var h = this.container.clientHeight;
      if (w === 0 || h === 0) return;

      var pixelRatio = this.renderer.getPixelRatio();
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.renderTarget.setSize(Math.max(1, w * pixelRatio), Math.max(1, h * pixelRatio));
    }

    _animate() {
      this.animationFrameId = requestAnimationFrame(this._animate);

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
    }

    setOption(key, value) {
      this.options[key] = value;
      if (key === 'baseColor') this.material.uniforms.uColor.value = new THREE.Color(value);
      if (key === 'opacity') this.material.uniforms.uOpacity.value = value;
      if (key === 'twistCount') this.material.uniforms.uTwist.value = value;
      if (key === 'amplitude') this.material.uniforms.uAmplitude.value = value;
      if (key === 'lineCount') this.instancedMesh.count = Math.min(value, MAX_LINES);
    }

    destroy() {
      cancelAnimationFrame(this.animationFrameId);
      this.resizeObserver.disconnect();
      this.container.removeEventListener('pointerdown', this._onPointerDown);
      window.removeEventListener('pointermove', this._onPointerMove);
      window.removeEventListener('pointerup', this._onPointerUp);
      this.container.removeEventListener('pointerenter', this._onEnter);
      this.container.removeEventListener('pointerleave', this._onLeave);
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

  window.HelixHeader = HelixHeader;
})();
