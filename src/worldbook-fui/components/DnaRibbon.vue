<template>
  <div class="wb-dna" :class="{ 'wb-dna--fallback': !ready }">
    <div ref="frameRef" class="wb-dna__frame">
      <div class="wb-dna__hint wb-dna__hint--tl">
        &gt; HOVER: ACCELERATE<br />
        &gt; DRAG_X: PHASE_SHIFT
      </div>
      <div ref="ribbonRef" class="wb-dna__ribbon" />
      <div class="wb-dna__fallback-lines" aria-hidden="true">
        <i /><i /><i />
      </div>
      <div class="wb-dna__hint wb-dna__hint--br">[ NEURAL_FIBER_IDLE ]</div>
    </div>
    <div class="wb-dna__info">
      <div class="wb-dna__symbol">▣</div>
      <div class="wb-dna__label">{{ label }}</div>
      <div class="wb-dna__sub">{{ subLabel }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { HelixHeader } from './helix';

withDefaults(defineProps<{
  label?: string;
  subLabel?: string;
}>(), {
  label: 'NO_SIGNAL',
  subLabel: 'AWAITING_WORLDBOOK // SELECT_LOREBOOK_TO_INITIALIZE',
});

const ribbonRef = ref<HTMLElement>();
const frameRef = ref<HTMLElement>();
const ready = ref(true);
let helix: HelixHeader | null = null;
let colorObserver: MutationObserver | null = null;

function readRibbonColor(): string {
  const shell = $('#topo-wb-shell')[0] as HTMLElement | undefined;
  if (!shell) return '#737373';
  const style = getComputedStyle(shell);
  return style.getPropertyValue('--wb-text-muted').trim()
    || style.getPropertyValue('--wb-user').trim()
    || '#737373';
}

function syncRibbonColor() {
  helix?.setBaseColor(readRibbonColor());
}

async function initRibbon() {
  await nextTick();
  if (!ribbonRef.value) return;

  try {
    helix = new HelixHeader(ribbonRef.value, {
      baseColor: readRibbonColor(),
      eventTarget: frameRef.value,
    });
    ready.value = true;
    console.info('[世界书美化] DNA ribbon initialized');
  } catch (err) {
    ready.value = false;
    console.warn('[世界书美化] DNA ribbon fallback:', err);
  }
}

onMounted(() => {
  initRibbon();

  const shell = $('#topo-wb-shell')[0];
  if (shell) {
    colorObserver = new MutationObserver(syncRibbonColor);
    colorObserver.observe(shell, { attributes: true, attributeFilter: ['style', 'class'] });
  }
});

onUnmounted(() => {
  colorObserver?.disconnect();
  helix?.destroy();
  helix = null;
});
</script>

<style scoped>
.wb-dna {
  position: absolute;
  inset: 0;
  z-index: 12;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 72px 24px 42px;
  color: var(--wb-text-muted);
  pointer-events: auto;
}

.wb-dna__frame {
  position: relative;
  width: min(80%, 900px);
  border: 1px dashed color-mix(in srgb, var(--wb-text-muted) 42%, transparent);
  overflow: hidden;
  background:
    linear-gradient(90deg, transparent, color-mix(in srgb, var(--wb-text-muted) 7%, transparent), transparent),
    rgba(0, 0, 0, 0.12);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.wb-dna__frame:active {
  cursor: grabbing;
}

.wb-dna__ribbon {
  position: relative;
  width: 100%;
  height: 150px;
  touch-action: none;
}

.wb-dna__fallback-lines {
  position: absolute;
  inset: 22px -8%;
  display: none;
  pointer-events: none;
}

.wb-dna--fallback .wb-dna__fallback-lines {
  display: block;
}

.wb-dna__fallback-lines i {
  position: absolute;
  left: 0;
  width: 116%;
  height: 1px;
  background: color-mix(in srgb, var(--wb-text-muted) 64%, transparent);
  opacity: 0.38;
  transform-origin: center;
  animation: wb-dnaFallback 5.4s linear infinite;
}

.wb-dna__fallback-lines i:nth-child(1) {
  top: 32%;
}

.wb-dna__fallback-lines i:nth-child(2) {
  top: 50%;
  animation-delay: -1.8s;
}

.wb-dna__fallback-lines i:nth-child(3) {
  top: 68%;
  animation-delay: -3.6s;
}

.wb-dna__hint {
  position: absolute;
  z-index: 10;
  color: var(--wb-text-muted);
  opacity: 0.55;
  font-size: 9px;
  letter-spacing: 1px;
  pointer-events: none;
}

.wb-dna__hint--tl {
  top: 8px;
  left: 12px;
  line-height: 1.4;
}

.wb-dna__hint--br {
  right: 12px;
  bottom: 4px;
  letter-spacing: 2px;
}

.wb-dna__info {
  margin-top: 28px;
  text-align: center;
}

.wb-dna__symbol {
  color: var(--wb-user);
  font-size: 28px;
  line-height: 1;
  text-shadow: 0 0 12px color-mix(in srgb, var(--wb-user) 50%, transparent);
}

.wb-dna__label {
  margin-top: 10px;
  color: var(--wb-text);
  font-size: 13px;
  letter-spacing: 5px;
}

.wb-dna__sub {
  margin-top: 8px;
  color: var(--wb-text-muted);
  font-size: 10px;
  letter-spacing: 2px;
}

@keyframes wb-dnaFallback {
  0% {
    transform: translateX(-4%) skewY(-8deg) scaleY(1);
  }
  50% {
    transform: translateX(4%) skewY(8deg) scaleY(1.8);
  }
  100% {
    transform: translateX(-4%) skewY(-8deg) scaleY(1);
  }
}

@media (max-width: 1000px) {
  .wb-dna {
    padding: 96px 16px 32px;
  }

  .wb-dna__frame {
    width: 92%;
  }

  .wb-dna__ribbon {
    height: 120px;
  }

  .wb-dna__sub {
    max-width: 260px;
    line-height: 1.6;
  }
}
</style>
