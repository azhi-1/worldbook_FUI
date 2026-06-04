<template>
  <div ref="canvasRef" class="topo-canvas">
    <!-- ROOT Node -->
    <div ref="rootRef" class="topo-root">
      <span class="topo-root__glyph">▣</span>
      <span class="topo-root__label">ROOT</span>
      <span class="topo-root__count">{{ sortedDisks.length }}</span>
    </div>

    <!-- SVG Overlay -->
    <svg ref="svgRef" class="topo-svg">
      <!-- Decorative contour guide lines -->
      <line
        v-for="(y, i) in guideYs"
        :key="'guide-' + i"
        x1="0"
        :x2="svgWidth"
        :y1="y"
        :y2="y"
        class="topo-svg__guide"
        :style="{ opacity: 0.04 + i * 0.02 }"
      />
      <!-- Contour polyline tracing disk bottoms -->
      <polyline
        v-if="contourPoints"
        :points="contourPoints"
        class="topo-svg__contour"
      />
      <!-- Routing line from ROOT to hovered disk -->
      <path
        v-if="routingPath"
        :d="routingPath"
        class="topo-svg__route"
        :class="{ 'topo-svg__route--active': hoveredUid !== null }"
      />
    </svg>

    <!-- Data Spine (horizontal scrolling track) -->
    <div ref="spineRef" class="topo-spine" @wheel.prevent="onWheel">
      <div ref="trackRef" class="topo-spine__track">
        <DataDisk
          v-for="disk in sortedDisks"
          :key="disk.uid"
          :disk="disk"
          :is-hovered="hoveredUid === disk.uid"
          @hover-start="onDiskHoverStart"
          @hover-end="onDiskHoverEnd"
        />
      </div>
    </div>

    <!-- Scroll progress -->
    <div class="topo-progress">
      <div class="topo-progress__fill" :style="{ width: scrollPercent + '%' }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import DataDisk from './components/DataDisk.vue';
import { mockDisks } from './mock';
import type { DiskData } from './types';

const canvasRef = ref<HTMLElement>();
const rootRef = ref<HTMLElement>();
const svgRef = ref<SVGSVGElement>();
const spineRef = ref<HTMLElement>();
const trackRef = ref<HTMLElement>();

const hoveredUid = ref<number | null>(null);
const hoveredEl = ref<HTMLElement | null>(null);
const routingPath = ref('');
const scrollPercent = ref(0);
const svgWidth = ref(800);
const svgHeight = ref(400);
const contourPoints = ref('');

const sortedDisks = computed(() => [...mockDisks].sort((a, b) => b.order - a.order));

// Decorative horizontal guide lines
const guideYs = computed(() => {
  const h = svgHeight.value;
  return [h * 0.3, h * 0.5, h * 0.7];
});

// --- Contour polyline (traces the bottom edge of rendered disks) ---
function updateContour() {
  if (!trackRef.value || !canvasRef.value) return;
  const canvasRect = canvasRef.value.getBoundingClientRect();
  const diskEls = trackRef.value.querySelectorAll('[data-uid]');
  const pts: string[] = [];
  diskEls.forEach(el => {
    const r = (el as HTMLElement).getBoundingClientRect();
    const cx = r.left + r.width / 2 - canvasRect.left;
    const by = r.bottom - canvasRect.top;
    pts.push(`${cx},${by}`);
  });
  contourPoints.value = pts.join(' ');
}

// --- Routing line ---
function computeRoutingPath() {
  if (!hoveredEl.value || !canvasRef.value || !rootRef.value) {
    routingPath.value = '';
    return;
  }
  const canvasRect = canvasRef.value.getBoundingClientRect();
  const rootRect = rootRef.value.getBoundingClientRect();
  const diskRect = hoveredEl.value.getBoundingClientRect();

  const rx = rootRect.left + rootRect.width / 2 - canvasRect.left;
  const ry = rootRect.top + rootRect.height / 2 - canvasRect.top;
  const dx = diskRect.left + diskRect.width / 2 - canvasRect.left;
  const dy = diskRect.top - canvasRect.top;

  const cpY = Math.min(ry, dy) - 20;

  routingPath.value = `M ${rx} ${ry} C ${rx} ${cpY}, ${dx} ${cpY}, ${dx} ${dy}`;
}

// --- Hover handlers ---
function onDiskHoverStart(payload: { disk: DiskData; el: HTMLElement }) {
  hoveredUid.value = payload.disk.uid;
  hoveredEl.value = payload.el;
  nextTick(computeRoutingPath);
}

function onDiskHoverEnd() {
  hoveredUid.value = null;
  hoveredEl.value = null;
  routingPath.value = '';
}

// --- Horizontal scroll ---
function onWheel(e: WheelEvent) {
  if (!spineRef.value) return;
  spineRef.value.scrollLeft += e.deltaY !== 0 ? e.deltaY : e.deltaX;
  updateScrollPercent();
  if (hoveredEl.value) computeRoutingPath();
}

function updateScrollPercent() {
  if (!spineRef.value) return;
  const el = spineRef.value;
  const maxScroll = el.scrollWidth - el.clientWidth;
  scrollPercent.value = maxScroll > 0 ? (el.scrollLeft / maxScroll) * 100 : 0;
}

// --- SVG sizing ---
function syncLayout() {
  if (!canvasRef.value) return;
  const rect = canvasRef.value.getBoundingClientRect();
  svgWidth.value = rect.width;
  svgHeight.value = rect.height;
  if (svgRef.value) {
    svgRef.value.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    svgRef.value.setAttribute('width', String(rect.width));
    svgRef.value.setAttribute('height', String(rect.height));
  }
  updateContour();
  updateScrollPercent();
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  nextTick(syncLayout);
  resizeObserver = new ResizeObserver(syncLayout);
  if (canvasRef.value) resizeObserver.observe(canvasRef.value);
  spineRef.value?.addEventListener('scroll', () => {
    updateScrollPercent();
    updateContour();
  }, { passive: true });
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});
</script>

<style scoped>
.topo-canvas {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 300px;
}

/* ROOT */
.topo-root {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
  align-self: center;
}

.topo-root__glyph {
  font-size: var(--topo-root-size);
  color: var(--topo-text);
  line-height: 1;
}

.topo-root__label {
  font-size: 9px;
  font-weight: 300;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--topo-text-muted);
}

.topo-root__count {
  font-size: 9px;
  font-weight: 300;
  color: var(--topo-text-secondary);
  margin-left: 2px;
}

/* SVG overlay */
.topo-svg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  overflow: visible;
}

.topo-svg__guide {
  stroke: var(--topo-text-muted);
  stroke-width: 0.5;
  stroke-dasharray: 2 6;
}

.topo-svg__contour {
  fill: none;
  stroke: var(--topo-border);
  stroke-width: 0.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.5;
}

.topo-svg__route {
  fill: none;
  stroke: var(--topo-text-secondary);
  stroke-width: 1;
  stroke-linecap: round;
  opacity: 0;
  transition: opacity 200ms ease;
}

.topo-svg__route--active {
  opacity: 1;
}

/* Data Spine */
.topo-spine {
  overflow-x: auto;
  overflow-y: visible;
  padding: 36px 0 16px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.topo-spine::-webkit-scrollbar {
  display: none;
}

.topo-spine__track {
  display: flex;
  gap: var(--topo-disk-gap);
  align-items: flex-end;
  padding: 0 4px;
  min-width: min-content;
}

/* Scroll progress */
.topo-progress {
  width: 100%;
  height: 1px;
  background: var(--topo-border);
  border-radius: 1px;
  overflow: hidden;
  flex-shrink: 0;
}

.topo-progress__fill {
  height: 100%;
  background: var(--topo-text-muted);
  border-radius: 1px;
  transition: width 100ms linear;
}

/* Mobile */
@media (max-width: 999px) {
  .topo-spine {
    padding: 24px 0 12px;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
