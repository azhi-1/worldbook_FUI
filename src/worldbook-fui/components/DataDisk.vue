<template>
  <div
    ref="el"
    class="wb-disk"
    :class="{
      'wb-disk--disabled': !entry.enabled,
      'wb-disk--active': isActive,
      'wb-disk--dragging': isDragging,
    }"
    :data-role="roleCategory"
    :data-tone="toneCategory"
    :data-node-index="String(index + 1).padStart(2, '0')"
    :data-label="entry.name || `UID_${entry.uid}`"
    :style="{ '--wave': waveDepth }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @pointerdown="$emit('drag-intent', $event)"
    @click="onClick"
  >
    <div class="wb-disk__port" />
    <div class="wb-disk__slot" />

    <div class="wb-disk__label">{{ entry.name || `UID_${entry.uid}` }}</div>
    <div class="wb-disk__address" aria-hidden="true">{{ addressText }}</div>

    <div
      v-if="entry.strategy.type === 'selective'"
      class="wb-disk__scan"
      aria-hidden="true"
    >
      <i /><i /><i /><i />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { getRoleCategory, getToneCategory, getWaveDepth } from '../types';

const props = defineProps<{
  entry: WorldbookEntry;
  index: number;
  isActive: boolean;
  isDragging: boolean;
}>();

const emit = defineEmits<{
  'hover-start': [payload: { entry: WorldbookEntry; el: HTMLElement }];
  'hover-end': [];
  'select': [payload: { entry: WorldbookEntry; el: HTMLElement }];
  'toggle-enabled': [entry: WorldbookEntry];
  'drag-intent': [event: PointerEvent];
}>();

const el = ref<HTMLElement>();
const roleCategory = computed(() => getRoleCategory(props.entry));
const toneCategory = computed(() => getToneCategory(props.entry));
const waveDepth = computed(() => getWaveDepth(props.index));
const addressLabel = computed(() => `${resolveEntryDepth(props.entry)} - ${resolveEntryOrder(props.entry)}`);
const addressText = ref('');

let clickTimer: ReturnType<typeof setTimeout> | null = null;
let addressTimer: ReturnType<typeof setInterval> | null = null;

function normalizeHudValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
  if (typeof value === 'string') return value;
  return null;
}

function resolveEntryDepth(entry: WorldbookEntry): string {
  const raw = entry as unknown as {
    depth?: unknown;
    scanDepth?: unknown;
    position?: { depth?: unknown };
  };
  return normalizeHudValue(raw.depth)
    ?? normalizeHudValue(raw.position?.depth)
    ?? normalizeHudValue(raw.scanDepth)
    ?? '--';
}

function resolveEntryOrder(entry: WorldbookEntry): string {
  const raw = entry as unknown as {
    order?: unknown;
    insertionOrder?: unknown;
    position?: { order?: unknown };
  };
  return normalizeHudValue(raw.order)
    ?? normalizeHudValue(raw.position?.order)
    ?? normalizeHudValue(raw.insertionOrder)
    ?? '--';
}

function clearAddressTimer() {
  if (addressTimer === null) return;
  clearInterval(addressTimer);
  addressTimer = null;
}

function runAddressTyping() {
  clearAddressTimer();
  addressText.value = '';

  const locateText = 'LOCATING...';
  const targetText = addressLabel.value;
  let step = 0;

  addressTimer = setInterval(() => {
    if (step <= locateText.length) {
      addressText.value = locateText.substring(0, step);
    } else if (step <= locateText.length + 2 + targetText.length) {
      addressText.value = targetText.substring(0, step - locateText.length - 2);
    } else {
      clearAddressTimer();
    }
    step += 1;
  }, 30);
}

function onMouseEnter() {
  emit('hover-start', { entry: props.entry, el: el.value! });
  runAddressTyping();
}

function onMouseLeave() {
  emit('hover-end');
  clearAddressTimer();
  addressText.value = '';
}

function onClick() {
  if (props.isDragging) return;
  if (clickTimer !== null) {
    clearTimeout(clickTimer);
    clickTimer = null;
    emit('toggle-enabled', props.entry);
    return;
  }
  clickTimer = setTimeout(() => {
    clickTimer = null;
    if (props.isDragging) return;
    emit('select', { entry: props.entry, el: el.value! });
  }, 200);
}

onUnmounted(clearAddressTimer);
</script>

<style scoped>
.wb-disk {
  position: relative;
  width: var(--wb-disk-w);
  height: var(--wb-disk-h);
  flex-shrink: 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.005) 100%
  ), var(--wb-disk-bg);
  border: 1px solid var(--wb-disk-border);
  border-bottom: none;
  border-radius: var(--wb-disk-radius, 0px);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  transform: translateY(calc(var(--wave, 6) * var(--wb-wave-amp) * -1 + var(--wb-jitter-offset, 0px)));
  transition:
    transform var(--wb-duration) var(--wb-ease),
    background 0.3s,
    border-color 0.3s,
    opacity 0.3s;
  will-change: transform;
  user-select: none;
  touch-action: none;
  --scan-speed-local: var(--wb-scan-speed);
}

.wb-disk::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: var(--strategy-color);
  transition: height 0.2s ease;
}

.wb-disk[data-role='system'] {
  --strategy-color: var(--wb-sys);
}
.wb-disk[data-role='user'] {
  --strategy-color: var(--wb-user);
}
.wb-disk[data-role='char'] {
  --strategy-color: var(--wb-char);
}
.wb-disk[data-tone='conditional-system'] {
  --strategy-color: var(--wb-user);
}

.wb-disk--disabled {
  opacity: 0.25;
  filter: grayscale(100%);
}

.wb-disk:hover {
  transform: translateY(calc(var(--wave, 6) * var(--wb-wave-amp) * -1 - 16px + var(--wb-jitter-offset, 0px)));
  background: var(--wb-disk-bg-hover);
  border-color: var(--wb-disk-border-hover);
  --scan-speed-local: 0.6s;
}

.wb-disk:hover .wb-disk__port {
  background: var(--wb-port-bg-hover);
}

.wb-disk:hover .wb-disk__label {
  color: var(--wb-disk-text-hover-color, var(--wb-disk-text-hover));
  opacity: var(--wb-disk-text-hover-opacity, var(--wb-disk-text-opacity, 1));
  text-shadow: var(--wb-disk-text-hover-shadow, var(--wb-disk-text-shadow, none));
}

.wb-disk--active {
  transform: translateY(calc(var(--wave, 6) * var(--wb-wave-amp) * -1 - 32px + var(--wb-jitter-offset, 0px)));
  background: var(--wb-disk-bg-active);
  border-color: var(--wb-disk-border-active);
  --scan-speed-local: 0.6s;
}

.wb-disk--active .wb-disk__port {
  background: var(--wb-port-bg-active);
}

.wb-disk--active .wb-disk__label {
  color: var(--wb-disk-text-active);
  opacity: var(--wb-disk-text-active-opacity, var(--wb-disk-text-hover-opacity, var(--wb-disk-text-opacity, 1)));
  text-shadow: var(--wb-disk-text-active-shadow, var(--wb-disk-text-hover-shadow, var(--wb-disk-text-shadow, none)));
}

.wb-disk--active::before {
  height: 4px;
}

.wb-disk--dragging {
  z-index: 50;
  transform: translateY(calc(var(--wave, 6) * var(--wb-wave-amp) * -1 - 24px + var(--wb-jitter-offset, 0px))) scale(1.08);
  border-color: var(--strategy-color);
  box-shadow: 0 0 20px rgba(255, 107, 0, 0.25);
  opacity: 0.9;
  cursor: grabbing;
}

.wb-disk__port {
  width: 100%;
  height: 3px;
  background: var(--wb-port-bg);
  transition: background 0.3s;
  flex-shrink: 0;
}

.wb-disk__slot {
  position: absolute;
  top: var(--wb-slot-y, 0px);
  left: calc(50% + var(--wb-slot-x, 0px));
  width: 0;
  height: 0;
  pointer-events: none;
}

.wb-disk__label {
  writing-mode: vertical-rl;
  text-orientation: var(--wb-disk-text-orientation, mixed);
  font-size: var(--wb-disk-font-size, 10px);
  font-weight: var(--wb-disk-font-weight, normal);
  color: var(--wb-disk-text-color, rgba(255, 255, 255, 0.2));
  opacity: var(--wb-disk-text-opacity, 1);
  text-shadow: var(--wb-disk-text-shadow, none);
  letter-spacing: var(--wb-disk-letter-spacing, 2px);
  transition:
    color 0.3s ease,
    opacity 0.3s ease,
    text-shadow 0.3s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: calc(var(--wb-disk-h) - 40px);
  margin-bottom: 12px;
}

.wb-disk__address {
  position: absolute;
  top: -22px;
  left: 50%;
  z-index: 80;
  display: none;
  min-height: 16px;
  padding: 2px 5px;
  border: 1px solid var(--strategy-color);
  background: rgba(0, 0, 0, 0.85);
  color: var(--strategy-color);
  font-family: var(--wb-font, monospace);
  font-size: 10px;
  letter-spacing: 1px;
  line-height: 1.2;
  white-space: nowrap;
  width: max-content;
  max-width: 180px;
  pointer-events: none;
  box-shadow: 0 0 4px var(--strategy-color);
  transform: translateX(-50%);
  overflow: hidden;
}

.wb-disk__scan {
  position: absolute;
  right: var(--wb-scan-x, 10px);
  top: var(--wb-scan-y, 9%);
  width: var(--wb-scan-w, 4px);
  height: var(--wb-scan-h, 17%);
  display: grid;
  grid-template-rows: repeat(4, 1fr);
  overflow: hidden;
  color: var(--strategy-color);
  pointer-events: none;
}

.wb-disk__scan i {
  display: block;
  width: 100%;
  background: currentColor;
  animation: wb-scanPulse var(--scan-speed-local) linear infinite;
}

.wb-disk__scan i:nth-child(1) {
  animation-delay: 0s;
}
.wb-disk__scan i:nth-child(2) {
  animation-delay: calc(var(--scan-speed-local) * 0.1);
}
.wb-disk__scan i:nth-child(3) {
  animation-delay: calc(var(--scan-speed-local) * 0.2);
}
.wb-disk__scan i:nth-child(4) {
  animation-delay: calc(var(--scan-speed-local) * 0.3);
}

@media (max-width: 1000px) {
  .wb-disk__label {
    font-size: 9px;
  }
}

@media (max-width: 768px) {
  .wb-disk__label {
    font-size: 8px;
    letter-spacing: 1px;
    margin-bottom: 8px;
  }

  .wb-disk__address {
    font-size: 8px;
    top: -18px;
    max-width: 140px;
  }
}
</style>
