<template>
  <div
    ref="diskRef"
    class="topo-disk"
    :class="{
      'topo-disk--disabled': !disk.enabled,
      'topo-disk--hovered': isHovered,
    }"
    :data-strategy="strategy"
    :data-uid="disk.uid"
    :style="{
      '--depth-offset': `${offset}px`,
      '--strategy-color': `var(--topo-st-${strategy})`,
    }"
    @mouseenter="$emit('hover-start', { disk, el: diskRef! })"
    @mouseleave="$emit('hover-end')"
  >
    <div class="topo-disk__spine-mark" />

    <div class="topo-disk__body">
      <span class="topo-disk__name">{{ disk.name }}</span>
    </div>

    <div class="topo-disk__meta">
      <span class="topo-disk__depth">{{ effectiveDepth }}</span>
      <span class="topo-disk__indicator" :class="`topo-disk__indicator--${disk.strategyType}`" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { categorizeStrategy, depthToOffset, getEffectiveDepth, type DiskData } from '../types';

const props = defineProps<{
  disk: DiskData;
  isHovered: boolean;
}>();

defineEmits<{
  'hover-start': [payload: { disk: DiskData; el: HTMLElement }];
  'hover-end': [];
}>();

const diskRef = ref<HTMLElement>();
const strategy = computed(() => categorizeStrategy(props.disk));
const effectiveDepth = computed(() => getEffectiveDepth(props.disk));
const offset = computed(() => depthToOffset(effectiveDepth.value));
</script>

<style scoped>
.topo-disk {
  position: relative;
  width: var(--topo-disk-w);
  height: var(--topo-disk-h);
  flex-shrink: 0;
  background: var(--topo-surface);
  border: 1px solid var(--topo-border);
  border-radius: 2px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translateY(var(--depth-offset, 0px));
  transition:
    transform var(--topo-duration) var(--topo-ease),
    background var(--topo-duration) var(--topo-ease),
    border-color var(--topo-duration) var(--topo-ease),
    opacity var(--topo-duration) var(--topo-ease);
  user-select: none;
}

.topo-disk--hovered {
  transform: translateY(calc(var(--depth-offset, 0px) + var(--topo-hover-lift)));
  background: var(--topo-surface-hover);
  border-color: var(--strategy-color, var(--topo-border));
  z-index: 10;
}

.topo-disk--disabled {
  opacity: 0.35;
}

.topo-disk__spine-mark {
  width: 100%;
  height: 3px;
  background: var(--strategy-color, var(--topo-st-default));
  flex-shrink: 0;
  opacity: 0.7;
  transition: opacity var(--topo-duration) var(--topo-ease);
}

.topo-disk--hovered .topo-disk__spine-mark {
  opacity: 1;
}

.topo-disk__body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  overflow: hidden;
}

.topo-disk__name {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.04em;
  line-height: 1.3;
  color: var(--topo-text);
  max-height: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--topo-duration) var(--topo-ease);
}

.topo-disk--disabled .topo-disk__name {
  color: var(--topo-text-muted);
}

.topo-disk__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px 6px;
  flex-shrink: 0;
}

.topo-disk__depth {
  font-size: 9px;
  font-weight: 300;
  color: var(--topo-text-secondary);
  font-variant-numeric: tabular-nums;
}

.topo-disk__indicator {
  width: 6px;
  height: 6px;
  border-radius: 1px;
  background: var(--strategy-color, var(--topo-st-default));
  opacity: 0.6;
}

.topo-disk__indicator--constant {
  border-radius: 0;
}

.topo-disk__indicator--selective {
  border-radius: 50%;
}

.topo-disk__indicator--vectorized {
  border-radius: 0;
  transform: rotate(45deg);
}
</style>
