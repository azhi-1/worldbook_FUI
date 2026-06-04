<template>
  <button
    v-if="collapsed"
    type="button"
    class="wb-tweaks-launcher"
    title="SETTING"
    @click.stop="toggleCollapsed"
  >
    <span aria-hidden="true">⚙</span>
  </button>
  <div
    v-else
    class="wb-tweaks"
    :style="{ left: `${position.x}px`, top: `${position.y}px` }"
    @mousedown.stop
  >
    <div class="wb-tweaks__header" @pointerdown="beginDrag" @click="toggleCollapsed">
      <span>SETTING</span>
      <span class="wb-tweaks__status">COLLAPSE</span>
    </div>

    <div class="wb-tweaks__body">
      <div class="wb-tweaks__group">THEME</div>
      <div class="wb-tweaks__row wb-tweaks__row--wide">
        <label class="wb-tweaks__label">THEME_SET</label>
        <select v-model="themeName" class="wb-tweaks__select" @change="onThemeChange">
          <option v-for="theme in WORLDBOOK_THEMES" :key="theme.name" :value="theme.name">
            {{ theme.name }}
          </option>
        </select>
      </div>
      <div class="wb-tweaks__row wb-tweaks__row--wide">
        <label class="wb-tweaks__label">TITLE_STYLE</label>
        <select v-model="titleStyle" class="wb-tweaks__select" @change="applyVisualSettings">
          <option v-for="style in TITLE_STYLES" :key="style.value" :value="style.value">
            {{ style.label }}
          </option>
        </select>
      </div>
      <div class="wb-tweaks__row wb-tweaks__row--wide">
        <label class="wb-tweaks__label">FONT_FAMILY</label>
        <select v-model="fontFamily" class="wb-tweaks__select" @change="applyVisualSettings">
          <option v-for="font in FONT_OPTIONS" :key="font.value" :value="font.value">
            {{ font.label }}
          </option>
        </select>
      </div>
      <button type="button" class="wb-tweaks__reset" @click="showColorEditor = !showColorEditor">
        {{ showColorEditor ? 'HIDE_COLOR_CONFIG' : 'CUSTOM_COLOR_CONFIG' }}
      </button>
      <div v-if="showColorEditor" class="wb-tweaks__color-grid">
        <label v-for="color in COLOR_TOKENS" :key="color.prop" class="wb-tweaks__color">
          <span>{{ color.label }}</span>
          <input v-model="colorValues[color.prop]" type="color" @input="applyCustomColors" />
        </label>
      </div>

      <div class="wb-tweaks__group">FX</div>
      <label v-for="fx in FX_OPTIONS" :key="fx.key" class="wb-tweaks__check">
        <input v-model="fxState[fx.key]" type="checkbox" @change="applyVisualSettings" />
        <span>{{ fx.label }}</span>
      </label>

      <template v-for="group in tweakGroups" :key="group.name">
        <div class="wb-tweaks__group">{{ group.name }}</div>
        <div v-for="t in group.items" :key="t.prop" class="wb-tweaks__row">
          <label class="wb-tweaks__label">{{ t.label }}</label>
          <input
            type="range"
            class="wb-tweaks__slider"
            :min="t.min"
            :max="t.max"
            :step="t.step"
            :value="values[t.prop]"
            @input="onInput(t, $event)"
          />
          <span class="wb-tweaks__value">{{ values[t.prop] }}{{ t.unit }}</span>
        </div>
      </template>

      <div class="wb-tweaks__actions">
        <button type="button" class="wb-tweaks__reset" @click="resetAll">RESET_ALL</button>
        <button type="button" class="wb-tweaks__save" @click="saveSettings">SAVE_SETTING</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import { DEFAULT_THEME_NAME, RESETTABLE_THEME_TOKENS, WORLDBOOK_THEMES, getTheme } from '../themes';

type TweakDef = {
  prop: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  initial: number;
};

type TweakGroup = {
  name: string;
  items: TweakDef[];
};

type FxKey = 'jitter' | 'corrupt' | 'address';

type SavedSettings = {
  values?: Record<string, number>;
  themeName?: string;
  titleStyle?: string;
  fontFamily?: string;
  customColors?: Record<string, string>;
  fx?: Record<FxKey, boolean>;
  position?: { x: number; y: number };
  collapsed?: boolean;
};

const SETTINGS_KEY = 'topo-wb:settings';
const TITLE_CLASS_PREFIX = 'wb-title-';
const FX_CLASS_PREFIX = 'wb-fx-';

const TITLE_STYLES = [
  { value: 'hud_phosphor', label: 'HUD_PHOSPHOR' },
  { value: 'gradient_burn', label: 'GRADIENT_BURN' },
  { value: 'neon_trace', label: 'NEON_TRACE' },
  { value: 'split_cell', label: 'SPLIT_CELL' },
  { value: 'index_code', label: 'INDEX_CODE' },
  { value: 'backlit_strip', label: 'BACKLIT_STRIP' },
];

const FONT_OPTIONS = [
  { value: "'Cascadia Code', 'JetBrains Mono', 'Consolas', 'Courier New', monospace", label: 'CASCADIA_STACK' },
  { value: "'Courier New', monospace", label: 'COURIER' },
  { value: "'Consolas', monospace", label: 'CONSOLAS' },
  { value: "'JetBrains Mono', 'Cascadia Code', monospace", label: 'JETBRAINS' },
  { value: "monospace", label: 'SYSTEM_MONO' },
];

const COLOR_TOKENS = [
  { prop: '--wb-bg', label: 'BG' },
  { prop: '--wb-text', label: 'TEXT' },
  { prop: '--wb-text-muted', label: 'MUTED' },
  { prop: '--wb-color-a', label: 'COLOR_A' },
  { prop: '--wb-color-b', label: 'COLOR_B' },
  { prop: '--wb-color-c', label: 'COLOR_C' },
];

const FX_OPTIONS: { key: FxKey; label: string }[] = [
  { key: 'jitter', label: 'JITTER' },
  { key: 'corrupt', label: 'CORRUPT_TEXT' },
  { key: 'address', label: 'ADDRESS_LINE' },
];

const tweakGroups: TweakGroup[] = [
  {
    name: 'DISK',
    items: [
      { prop: '--wb-disk-w', label: 'DISK_WIDTH', min: 10, max: 80, step: 1, unit: 'px', initial: 33 },
      { prop: '--wb-disk-h', label: 'DISK_HEIGHT', min: 80, max: 800, step: 5, unit: 'px', initial: 400 },
      { prop: '--wb-gap', label: 'DISK_GAP', min: 0, max: 10, step: 1, unit: 'px', initial: 4 },
      { prop: '--wb-wave-amp', label: 'WAVE_AMP', min: 0, max: 60, step: 1, unit: 'px', initial: 8 },
      { prop: '--wb-disk-radius', label: 'CORNER_RADIUS', min: 0, max: 12, step: 1, unit: 'px', initial: 0 },
    ],
  },
  {
    name: 'SCAN',
    items: [
      { prop: '--wb-scan-x', label: 'SCAN_X', min: 0, max: 28, step: 1, unit: 'px', initial: 12 },
      { prop: '--wb-scan-y', label: 'SCAN_Y', min: 0, max: 40, step: 1, unit: '%', initial: 1 },
      { prop: '--wb-scan-w', label: 'SCAN_WIDTH', min: 1, max: 20, step: 1, unit: 'px', initial: 4 },
      { prop: '--wb-scan-h', label: 'SCAN_HEIGHT', min: 5, max: 50, step: 1, unit: '%', initial: 12 },
      { prop: '--wb-scan-speed', label: 'SCAN_SPEED', min: 0.4, max: 8, step: 0.2, unit: 's', initial: 3.6 },
      { prop: '--wb-scan-opacity', label: 'SCAN_OPACITY', min: 0, max: 1, step: 0.05, unit: '', initial: 0.4 },
    ],
  },
  {
    name: 'LAYOUT',
    items: [
      { prop: '--wb-spine-pad-top', label: 'SPINE_TOP', min: 0, max: 140, step: 2, unit: 'px', initial: 72 },
      { prop: '--wb-spine-pad-left', label: 'SPINE_LEFT', min: 0, max: 120, step: 2, unit: 'px', initial: 16 },
      { prop: '--wb-spine-offset', label: 'SPINE_OFFSET', min: -120, max: 120, step: 2, unit: 'px', initial: 0 },
      { prop: '--wb-root-pad-top', label: 'ROOT_TOP', min: 0, max: 60, step: 2, unit: 'px', initial: 18 },
      { prop: '--wb-root-pad-bottom', label: 'ROOT_BOTTOM', min: 0, max: 60, step: 2, unit: 'px', initial: 20 },
    ],
  },
  {
    name: 'ROUTE',
    items: [
      { prop: '--wb-route-bend', label: 'ROUTE_BEND', min: 0, max: 1, step: 0.05, unit: '', initial: 0.3 },
      { prop: '--wb-route-root-x', label: 'ROUTE_ROOT_X', min: -40, max: 40, step: 1, unit: 'px', initial: 0 },
      { prop: '--wb-route-root-y', label: 'ROUTE_ROOT_Y', min: -40, max: 40, step: 1, unit: 'px', initial: 0 },
      { prop: '--wb-slot-x', label: 'SLOT_X', min: -20, max: 20, step: 1, unit: 'px', initial: 0 },
      { prop: '--wb-slot-y', label: 'SLOT_Y', min: -20, max: 20, step: 1, unit: 'px', initial: -16 },
    ],
  },
];

const allTweaks = tweakGroups.flatMap(g => g.items);
const values = reactive<Record<string, number>>(Object.fromEntries(allTweaks.map(t => [t.prop, t.initial])));
const colorValues = reactive<Record<string, string>>(Object.fromEntries(COLOR_TOKENS.map(t => [t.prop, '#000000'])));
const fxState = reactive<Record<FxKey, boolean>>({ jitter: false, corrupt: false, address: false });
const position = reactive({ x: 24, y: 86 });
const collapsed = ref(true);
const showColorEditor = ref(false);
const themeName = ref(DEFAULT_THEME_NAME);
const titleStyle = ref(TITLE_STYLES[0].value);
const fontFamily = ref(FONT_OPTIONS[0].value);

let dragStart: { x: number; y: number; panelX: number; panelY: number } | null = null;
let dragged = false;

function getShell(): HTMLElement | null {
  return $('#topo-wb-shell')[0] ?? null;
}

function dispatchTweakChange() {
  window.dispatchEvent(new CustomEvent('wb-tweak-change'));
}

function applyVar(prop: string, value: number, unit: string) {
  getShell()?.style.setProperty(prop, `${value}${unit}`);
}

function applyTheme(name = themeName.value) {
  const shell = getShell();
  if (!shell) return;
  for (const token of RESETTABLE_THEME_TOKENS) {
    shell.style.removeProperty(token);
  }
  for (const [prop, value] of Object.entries(getTheme(name).tokens)) {
    shell.style.setProperty(prop, value);
  }
  syncColorInputsFromShell();
}

function applyCustomColors() {
  const shell = getShell();
  if (!shell) return;
  for (const { prop } of COLOR_TOKENS) {
    shell.style.setProperty(prop, colorValues[prop]);
  }
  shell.style.setProperty('--wb-sys', 'var(--wb-color-a)');
  shell.style.setProperty('--wb-char', 'var(--wb-color-b)');
  shell.style.setProperty('--wb-user', 'var(--wb-color-c)');
  dispatchTweakChange();
}

function applyVisualSettings() {
  const shell = getShell();
  if (!shell) return;

  for (const className of Array.from(shell.classList)) {
    if (className.startsWith(TITLE_CLASS_PREFIX) || className.startsWith(FX_CLASS_PREFIX)) {
      shell.classList.remove(className);
    }
  }

  shell.classList.add(`${TITLE_CLASS_PREFIX}${titleStyle.value}`);
  shell.style.setProperty('--wb-font', fontFamily.value);
  for (const fx of FX_OPTIONS) {
    if (fxState[fx.key]) shell.classList.add(`${FX_CLASS_PREFIX}${fx.key}`);
  }
  dispatchTweakChange();
}

function onThemeChange() {
  applyTheme();
  applyVisualSettings();
}

function onInput(t: TweakDef, event: Event) {
  const v = parseFloat((event.target as HTMLInputElement).value);
  values[t.prop] = v;
  applyVar(t.prop, v, t.unit);
  dispatchTweakChange();
}

function resetAll() {
  const shell = getShell();
  for (const t of allTweaks) {
    values[t.prop] = t.initial;
    shell?.style.removeProperty(t.prop);
  }
  themeName.value = DEFAULT_THEME_NAME;
  titleStyle.value = TITLE_STYLES[0].value;
  fontFamily.value = FONT_OPTIONS[0].value;
  for (const fx of FX_OPTIONS) fxState[fx.key] = false;
  applyTheme();
  applyVisualSettings();
}

function saveSettings() {
  const saved: SavedSettings = {
    values: { ...values },
    themeName: themeName.value,
    titleStyle: titleStyle.value,
    fontFamily: fontFamily.value,
    customColors: Object.fromEntries(COLOR_TOKENS.map(({ prop }) => [prop, colorValues[prop]])),
    fx: { ...fxState },
    position: { ...position },
    collapsed: collapsed.value,
  };

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(saved));
    toastr.success('SETTING_SAVED', '世界书美化', { timeOut: 1200 });
  } catch (err) {
    console.warn('[世界书美化] save settings failed:', err);
    toastr.error('SETTING_SAVE_FAILED', '世界书美化');
  }
}

function restoreSettings(): SavedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) as SavedSettings : {};
  } catch {
    return {};
  }
}

function applySavedSettings(saved: SavedSettings) {
  themeName.value = saved.themeName && WORLDBOOK_THEMES.some(theme => theme.name === saved.themeName)
    ? saved.themeName
    : DEFAULT_THEME_NAME;
  titleStyle.value = saved.titleStyle && TITLE_STYLES.some(style => style.value === saved.titleStyle)
    ? saved.titleStyle
    : TITLE_STYLES[0].value;
  fontFamily.value = saved.fontFamily ?? FONT_OPTIONS[0].value;
  collapsed.value = true;

  if (saved.position) {
    position.x = saved.position.x;
    position.y = saved.position.y;
  } else {
    position.x = Math.max(12, window.innerWidth - 328);
    position.y = 64;
  }

  applyTheme();

  if (saved.customColors) {
    for (const { prop } of COLOR_TOKENS) {
      if (saved.customColors[prop]) colorValues[prop] = saved.customColors[prop];
    }
    applyCustomColors();
  }

  for (const fx of FX_OPTIONS) fxState[fx.key] = saved.fx?.[fx.key] ?? false;
  applyVisualSettings();

  for (const t of allTweaks) {
    const savedValue = saved.values?.[t.prop];
    if (typeof savedValue === 'number') {
      values[t.prop] = savedValue;
      applyVar(t.prop, savedValue, t.unit);
    }
  }
}

function syncColorInputsFromShell() {
  const shell = getShell();
  if (!shell) return;
  const style = getComputedStyle(shell);
  for (const { prop } of COLOR_TOKENS) {
    const value = style.getPropertyValue(prop).trim();
    if (value.startsWith('#')) colorValues[prop] = value;
  }
}

function syncNumericInputsFromShell() {
  const shell = getShell();
  if (!shell) return;
  const view = shell.ownerDocument.defaultView ?? window;
  for (const t of allTweaks) {
    const raw = view.getComputedStyle(shell).getPropertyValue(t.prop).trim();
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) values[t.prop] = parsed;
  }
}

function toggleCollapsed() {
  if (dragged) return;
  collapsed.value = !collapsed.value;
}

function beginDrag(event: PointerEvent) {
  if (event.button !== 0) return;
  dragStart = {
    x: event.clientX,
    y: event.clientY,
    panelX: position.x,
    panelY: position.y,
  };
  dragged = false;
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', endDrag, { once: true });
}

function onDragMove(event: PointerEvent) {
  if (!dragStart) return;
  const dx = event.clientX - dragStart.x;
  const dy = event.clientY - dragStart.y;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragged = true;
  position.x = Math.max(0, Math.min(window.innerWidth - 80, dragStart.panelX + dx));
  position.y = Math.max(0, Math.min(window.innerHeight - 30, dragStart.panelY + dy));
}

function endDrag() {
  dragStart = null;
  window.removeEventListener('pointermove', onDragMove);
  window.setTimeout(() => {
    dragged = false;
  }, 0);
}

onMounted(() => {
  applySavedSettings(restoreSettings());
  syncNumericInputsFromShell();
  syncColorInputsFromShell();
});

onUnmounted(() => {
  window.removeEventListener('pointermove', onDragMove);
});
</script>

<style scoped>
.wb-tweaks-launcher {
  appearance: none;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--wb-text) 12%, transparent);
  background:
    radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--wb-user) 18%, transparent), transparent 58%),
    rgba(0, 0, 0, 0.18);
  color: color-mix(in srgb, var(--wb-text-muted) 72%, transparent);
  font: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  backdrop-filter: blur(8px);
  box-shadow:
    inset 0 0 10px rgba(255, 255, 255, 0.035),
    0 0 10px color-mix(in srgb, var(--wb-user) 10%, transparent);
  transition:
    border-color 0.16s ease,
    color 0.16s ease,
    background 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.wb-tweaks-launcher:hover {
  border-color: color-mix(in srgb, var(--wb-user) 62%, transparent);
  color: var(--wb-user);
  background:
    radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--wb-user) 28%, transparent), transparent 60%),
    rgba(0, 0, 0, 0.32);
  box-shadow:
    inset 0 0 12px color-mix(in srgb, var(--wb-user) 8%, transparent),
    0 0 14px color-mix(in srgb, var(--wb-user) 28%, transparent);
  transform: translateY(-1px);
}

.wb-tweaks-launcher:active {
  transform: translateY(0);
}

.wb-tweaks {
  position: fixed;
  width: 300px;
  background: rgba(0, 0, 0, 0.92);
  border: 1px solid color-mix(in srgb, var(--wb-text) 14%, transparent);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  color: var(--wb-text);
  box-shadow: 0 14px 42px rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(10px);
}

.wb-tweaks__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--wb-text) 8%, transparent);
  color: var(--wb-user);
  font-size: 10px;
  letter-spacing: 2px;
  cursor: grab;
  user-select: none;
}

.wb-tweaks__header:active {
  cursor: grabbing;
}

.wb-tweaks__status {
  color: var(--wb-text-muted);
  font-size: 9px;
  letter-spacing: 1px;
}

.wb-tweaks__body {
  padding: 8px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: min(68vh, 620px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color:
    color-mix(in srgb, var(--wb-user) 42%, transparent)
    color-mix(in srgb, var(--wb-text) 7%, transparent);
}

.wb-tweaks__body::-webkit-scrollbar {
  width: 6px;
}

.wb-tweaks__body::-webkit-scrollbar-track {
  background: color-mix(in srgb, var(--wb-text) 6%, transparent);
}

.wb-tweaks__body::-webkit-scrollbar-thumb {
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--wb-user) 52%, transparent),
      color-mix(in srgb, var(--wb-sys) 42%, transparent)
    );
  border: 1px solid rgba(0, 0, 0, 0.5);
}

.wb-tweaks__body::-webkit-scrollbar-thumb:hover {
  background: var(--wb-user);
}

.wb-tweaks__group {
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--wb-sys);
  border-bottom: 1px solid color-mix(in srgb, var(--wb-sys) 22%, transparent);
  padding: 6px 0 3px;
  margin-top: 4px;
}

.wb-tweaks__row {
  display: grid;
  grid-template-columns: 94px 1fr 48px;
  align-items: center;
  gap: 6px;
}

.wb-tweaks__row--wide {
  grid-template-columns: 94px 1fr;
}

.wb-tweaks__label {
  font-size: 9px;
  letter-spacing: 1px;
  color: var(--wb-text-muted);
  white-space: nowrap;
}

.wb-tweaks__select {
  min-width: 0;
  height: 22px;
  border: 1px solid color-mix(in srgb, var(--wb-text) 14%, transparent);
  background: rgba(0, 0, 0, 0.45);
  color: var(--wb-text);
  font: inherit;
  font-size: 9px;
  letter-spacing: 1px;
}

.wb-tweaks__select option {
  background: #111;
}

.wb-tweaks__slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 3px;
  background: color-mix(in srgb, var(--wb-text) 12%, transparent);
  outline: none;
  cursor: pointer;
}

.wb-tweaks__slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px;
  height: 10px;
  background: var(--wb-user);
  border: none;
  cursor: grab;
}

.wb-tweaks__value {
  font-size: 9px;
  color: var(--wb-text);
  text-align: right;
  letter-spacing: 0.5px;
  font-variant-numeric: tabular-nums;
}

.wb-tweaks__check {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--wb-text-muted);
  font-size: 9px;
  letter-spacing: 1px;
}

.wb-tweaks__check input {
  accent-color: var(--wb-user);
}

.wb-tweaks__color-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.wb-tweaks__color {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--wb-text-muted);
  font-size: 9px;
  letter-spacing: 1px;
}

.wb-tweaks__color input {
  width: 34px;
  height: 20px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--wb-text) 16%, transparent);
  background: transparent;
}

.wb-tweaks__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 6px;
}

.wb-tweaks__reset,
.wb-tweaks__save {
  appearance: none;
  border: 1px solid color-mix(in srgb, var(--wb-text) 12%, transparent);
  background: transparent;
  color: var(--wb-text-muted);
  font: inherit;
  font-size: 9px;
  letter-spacing: 1.5px;
  padding: 5px 0;
  cursor: pointer;
}

.wb-tweaks__reset:hover,
.wb-tweaks__save:hover {
  color: var(--wb-sys);
  border-color: var(--wb-sys);
}

.wb-tweaks__save {
  color: var(--wb-user);
}

@media (max-width: 1000px) {
  .wb-tweaks {
    width: min(300px, calc(100vw - 24px));
  }
}
</style>
