<template>
  <div
    ref="containerRef"
    class="wb-main"
    :class="{ 'wb-main--visible': isDrawerOpen }"
  >
    <div class="wb-shell-bar">
      <div class="wb-shell-bar__meta">
        <span class="wb-shell-bar__mark">WORLD FUI</span>
        <span class="wb-shell-bar__source">{{ worldbookName || 'AWAITING_SIGNAL' }}</span>
        <span class="wb-shell-bar__count">{{ entries.length }} NODES</span>
      </div>
      <div class="wb-shell-bar__actions">
        <TweaksPanel />
        <button type="button" class="wb-shell-bar__close" @click="closeWorldbookDrawer">
          EJECT
        </button>
      </div>
    </div>

    <div class="wb-bridge-bar">
      <select
        v-model="selectedWorldbookName"
        class="wb-bridge-bar__select"
        @focus="refreshWorldbookNames"
        @change="loadSelectedWorldbook"
      >
        <option value="">SELECT_LOREBOOK</option>
        <option v-for="name in worldbookNames" :key="name" :value="name">
          {{ name }}
        </option>
      </select>
      <button type="button" class="wb-bridge-bar__button" @click="createNewWorldbook">
        NEW_BOOK
      </button>
      <button type="button" class="wb-bridge-bar__button" @click="openImportFilePicker">
        IMPORT_BOOK
      </button>
      <input
        ref="importInputRef"
        class="wb-bridge-bar__file"
        type="file"
        accept=".json,application/json"
        @change="onImportFileSelected"
      />
      <button
        type="button"
        class="wb-bridge-bar__button"
        :disabled="!worldbookName"
        @click="exportCurrentWorldbook"
      >
        EXPORT_BOOK
      </button>
      <button
        type="button"
        class="wb-bridge-bar__button wb-bridge-bar__button--danger"
        :disabled="!worldbookName"
        @click="deleteCurrentWorldbook"
      >
        DELETE_BOOK
      </button>
      <button
        type="button"
        class="wb-bridge-bar__button"
        :disabled="!worldbookName"
        @click="createNewEntry"
      >
        NEW_ENTRY
      </button>
      <input
        v-model="searchQuery"
        class="wb-bridge-bar__search"
        type="search"
        placeholder="FILTER_NODES"
      />
    </div>

    <!-- SVG routing layer -->
    <svg ref="svgRef" class="wb-routing">
      <path
        v-if="routePath"
        :d="routePath"
        class="wb-routing__line"
        :stroke="routeColor"
      />
    </svg>

    <!-- Root anchor -->
    <div class="wb-root-zone">
      <div
        ref="rootRef"
        class="wb-root"
        :style="{ color: routeColor || '', transition: 'color 0.15s ease' }"
      >
        <span
          class="wb-root__symbol"
          :style="{
            textShadow: routeColor ? `0 0 10px ${routeColor}` : 'none',
            transition: 'text-shadow 0.3s ease',
          }"
          >▣</span
        >
        <span class="wb-root__label">{{
          worldbookName || 'NO_SIGNAL'
        }}</span>
        <span class="wb-root__count">{{ entries.length }}</span>
      </div>
    </div>

    <!-- Data spine -->
    <div v-if="showDataSpine" class="wb-spine-wrapper">
      <div
        ref="spineRef"
        class="wb-spine"
        @wheel.prevent="onWheel"
      >
        <TransitionGroup ref="trackRef" name="disk" tag="div" class="wb-spine__track">
          <DataDisk
            v-for="(entry, index) in visibleEntries"
            :key="entry.uid"
            :entry="entry"
            :index="index"
            :is-active="activeUid === entry.uid"
            :is-dragging="dragState.isDragging && dragState.uid === entry.uid"
            @select="onDiskSelect"
            @toggle-enabled="onToggleEnabled"
            @hover-start="onHoverStart"
            @hover-end="onHoverEnd"
            @drag-intent="onDiskPointerDown($event, entry)"
          />
        </TransitionGroup>
      </div>
    </div>

    <!-- Empty state -->
    <DnaRibbon
      v-if="showNoWorldbookRibbon"
      label="NO_SIGNAL"
      sub-label="AWAITING_WORLDBOOK // SELECT_LOREBOOK_TO_INITIALIZE"
    />
    <div v-else-if="loading" class="wb-empty">
      READING_LOREBOOK // {{ worldbookName || 'UID_MATCH' }}
    </div>
    <div v-else-if="entries.length > 0 && visibleEntries.length === 0" class="wb-empty">
      FILTER_EMPTY // {{ searchQuery }}
    </div>
    <DnaRibbon
      v-else-if="showEmptyWorldbookRibbon"
      label="NO_ENTRIES_FOUND"
      :sub-label="`${worldbookName} // CREATE_NODE_TO_INITIALIZE`"
    />

    <!-- IDE modal -->
    <IdeModal
      v-if="activeEntry"
      :entry="activeEntry"
      :worldbook-name="worldbookName"
      @close="closeIde"
      @save="onSaveEntry"
      @delete-entry="onDeleteEntry"
    />

  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
import DataDisk from './components/DataDisk.vue';
import DnaRibbon from './components/DnaRibbon.vue';
import IdeModal from './components/IdeModal.vue';
import TweaksPanel from './components/TweaksPanel.vue';
import { getRoleCategory, getToneCategory } from './types';

const SELECTED_WORLDBOOK_CACHE_KEY = 'topo-wb:selected-worldbook';

const containerRef = ref<HTMLElement>();
const rootRef = ref<HTMLElement>();
const svgRef = ref<SVGSVGElement>();
const spineRef = ref<HTMLElement>();
const trackRef = ref<InstanceType<typeof import('vue')['TransitionGroup']>>();
const importInputRef = ref<HTMLInputElement>();

const worldbookName = ref('');
const worldbookNames = ref<string[]>([]);
const selectedWorldbookName = ref('');
const searchQuery = ref('');
const entries = ref<WorldbookEntry[]>([]);
const loading = ref(false);
const activeUid = ref<number | null>(null);
const activeEl = ref<HTMLElement | null>(null);
const hoveredEntry = ref<WorldbookEntry | null>(null);
const hoveredEl = ref<HTMLElement | null>(null);
const routePath = ref('');
const isDrawerOpen = ref(false);

const dragState = reactive({
  uid: null as number | null,
  startX: 0,
  isDragging: false,
});
let dragJustEnded = false;
let suppressWiReload = false;

type RawLorebookEntry = {
  uid: number;
  depth?: number;
  order?: number;
} & Record<string, unknown>;

type TavernHelperLorebookApi = {
  deleteLorebook?: (lorebookName: string) => Promise<unknown>;
  getLorebookEntries?: (lorebookName: string) => Promise<RawLorebookEntry[]>;
  importRawWorldbook?: (lorebookName: string, rawJson: string) => Promise<boolean> | boolean;
  updateLorebookEntriesWith?: (
    lorebookName: string,
    updater: (entries: RawLorebookEntry[]) => RawLorebookEntry[],
    options?: { render?: 'immediate' },
  ) => Promise<unknown>;
};

const activeEntry = computed(() => {
  if (activeUid.value === null) return null;
  return entries.value.find(e => e.uid === activeUid.value) ?? null;
});

const visibleEntries = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return entries.value;
  return entries.value.filter(entry => {
    const haystack = [
      entry.name,
      entry.content,
      entry.strategy.type,
      entry.position.type,
      entry.position.role,
      String(entry.uid),
    ].join('\n').toLowerCase();
    return haystack.includes(query);
  });
});

const showNoWorldbookRibbon = computed(() => !worldbookName.value && !loading.value);
const showEmptyWorldbookRibbon = computed(() => Boolean(worldbookName.value) && entries.value.length === 0 && !loading.value);
const showDataSpine = computed(() => !showNoWorldbookRibbon.value && !showEmptyWorldbookRibbon.value);

const routeTarget = computed(() => hoveredEntry.value ?? activeEntry.value);

const routeColor = computed(() => {
  if (!routeTarget.value) return '';
  const tone = getToneCategory(routeTarget.value);
  if (tone === 'user' || tone === 'conditional-system') return 'var(--wb-user)';
  if (tone === 'char') return 'var(--wb-char)';
  return 'var(--wb-sys)';
});

// --- Data loading ---

async function loadWorldbook(name: string) {
  if (!name) {
    entries.value = [];
    worldbookName.value = '';
    selectedWorldbookName.value = '';
    return;
  }
  loading.value = true;
  try {
    entries.value = await loadMergedWorldbook(name);
    worldbookName.value = name;
    selectedWorldbookName.value = name;
    rememberSelectedWorldbook(name);
    activeUid.value = null;
    activeEl.value = null;
    hoveredEntry.value = null;
    hoveredEl.value = null;
    routePath.value = '';
    console.info(`[世界书美化] "${name}": ${entries.value.length} entries`);
  } catch (err) {
    console.error(`[世界书美化] load failed:`, err);
    entries.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadMergedWorldbook(name: string): Promise<WorldbookEntry[]> {
  const worldbook = await getWorldbook(name);
  const rawEntries = await getRawLorebookEntries(name);
  if (rawEntries.length === 0) return worldbook;

  const rawByUid = new Map(rawEntries.map(entry => [entry.uid, entry]));
  return worldbook.map(entry => {
    const raw = rawByUid.get(entry.uid);
    if (!raw) return entry;
    const merged = {
      ...entry,
      ...(raw.depth !== undefined ? { depth: raw.depth } : {}),
      ...(raw.order !== undefined ? { order: raw.order } : {}),
    } as WorldbookEntry;
    return merged;
  });
}

function getTavernHelperLorebookApi(): TavernHelperLorebookApi | undefined {
  return (window as unknown as { TavernHelper?: TavernHelperLorebookApi }).TavernHelper;
}

async function getRawLorebookEntries(name: string): Promise<RawLorebookEntry[]> {
  try {
    const api = getTavernHelperLorebookApi();
    return await api?.getLorebookEntries?.(name) ?? [];
  } catch (err) {
    console.warn('[世界书美化] raw lorebook read failed:', err);
    return [];
  }
}

function refreshWorldbookNames() {
  try {
    worldbookNames.value = getWorldbookNames();
    cleanupSelectedWorldbookCache();
  } catch (err) {
    console.error('[世界书美化] list worldbooks failed:', err);
    toastr.error('LIST FAILED', '世界书美化');
  }
}

function rememberSelectedWorldbook(name: string) {
  try {
    localStorage.setItem(SELECTED_WORLDBOOK_CACHE_KEY, name);
  } catch (err) {
    console.warn('[世界书美化] cache selected worldbook failed:', err);
  }
}

function readCachedSelectedWorldbook(): string {
  try {
    return localStorage.getItem(SELECTED_WORLDBOOK_CACHE_KEY) ?? '';
  } catch {
    return '';
  }
}

function clearSelectedWorldbookCache() {
  try {
    localStorage.removeItem(SELECTED_WORLDBOOK_CACHE_KEY);
  } catch {
    // localStorage can be unavailable in restricted runtimes.
  }
}

function cleanupSelectedWorldbookCache() {
  const cachedName = readCachedSelectedWorldbook();
  if (!cachedName) return;
  if (worldbookNames.value.includes(cachedName)) return;
  clearSelectedWorldbookCache();
}

async function restoreCachedWorldbook() {
  const cachedName = readCachedSelectedWorldbook();
  if (!cachedName) return;
  if (!worldbookNames.value.includes(cachedName)) {
    clearSelectedWorldbookCache();
    return;
  }
  selectedWorldbookName.value = cachedName;
  await loadWorldbook(cachedName);
}

function loadSelectedWorldbook() {
  if (!selectedWorldbookName.value) {
    loadWorldbook('');
    clearSelectedWorldbookCache();
    return;
  }
  loadWorldbook(selectedWorldbookName.value);
}

async function createNewWorldbook() {
  const name = window.prompt('新世界书名称');
  const trimmed = name?.trim();
  if (!trimmed) return;

  try {
    await createWorldbook(trimmed, []);
    refreshWorldbookNames();
    await loadWorldbook(trimmed);
    toastr.success('BOOK_CREATED', '世界书美化', { timeOut: 1500 });
  } catch (err) {
    console.error('[世界书美化] create worldbook failed:', err);
    toastr.error('CREATE BOOK FAILED', '世界书美化');
  }
}

function openImportFilePicker() {
  importInputRef.value?.click();
}

async function onImportFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const rawJson = await file.text();
    const payload = parseLorebookImportPayload(rawJson);
    refreshWorldbookNames();

    const defaultName = getImportDefaultName(file, payload);
    const targetName = window.prompt('IMPORT_BOOK_NAME', defaultName)?.trim();
    if (!targetName) return;

    if (worldbookNames.value.includes(targetName)) {
      const overwrite = window.confirm(`OVERWRITE_BOOK: ${targetName}\nExisting entries may be replaced.`);
      if (!overwrite) return;
    }

    await importRawWorldbookFile(targetName, rawJson, payload);
    refreshWorldbookNames();
    await loadWorldbook(targetName);
    toastr.success('BOOK_IMPORTED', 'WORLD_FUI', { timeOut: 1500 });
  } catch (err) {
    console.error('[WORLD_FUI] import worldbook failed:', err);
    toastr.error('IMPORT BOOK FAILED', 'WORLD_FUI');
  } finally {
    input.value = '';
  }
}

function parseLorebookImportPayload(rawJson: string): Record<string, unknown> & { entries: unknown } {
  const payload = JSON.parse(rawJson) as Record<string, unknown>;
  if (!payload || typeof payload !== 'object' || !('entries' in payload)) {
    throw new Error('Worldbook JSON must contain entries');
  }

  const importedEntries = payload.entries;
  const entriesOk =
    Array.isArray(importedEntries) ||
    (importedEntries !== null && typeof importedEntries === 'object');
  if (!entriesOk) {
    throw new Error('Worldbook entries must be an array or object');
  }

  return payload as Record<string, unknown> & { entries: unknown };
}

function getImportDefaultName(file: File, payload: Record<string, unknown>): string {
  for (const key of ['name', 'lorebookName', 'worldbook', 'bookName']) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  const fromFileName = file.name.replace(/\.json$/i, '').trim();
  return fromFileName || 'IMPORTED_BOOK';
}

async function importRawWorldbookFile(
  name: string,
  rawJson: string,
  payload: Record<string, unknown> & { entries: unknown },
) {
  const api = getTavernHelperLorebookApi();
  if (api?.importRawWorldbook) {
    const normalizedRawJson = JSON.stringify({
      ...payload,
      entries: normalizeEntriesForRawImport(payload.entries),
    });
    const result = await api.importRawWorldbook(name, normalizedRawJson);
    if (result === false) throw new Error('importRawWorldbook returned false');
    return;
  }

  const importedEntries = payload.entries;
  const fallbackEntries = Array.isArray(importedEntries)
    ? importedEntries
    : Object.values(importedEntries as Record<string, unknown>);
  await createWorldbook(name, fallbackEntries as WorldbookEntry[]);
}

function normalizeEntriesForRawImport(importedEntries: unknown): unknown {
  if (!Array.isArray(importedEntries)) return importedEntries;

  return importedEntries.reduce<Record<string, unknown>>((acc, entry, index) => {
    const uid = entry !== null && typeof entry === 'object'
      ? (entry as { uid?: unknown }).uid
      : undefined;
    acc[String(uid ?? index)] = entry;
    return acc;
  }, {});
}

async function fetchNativeWorldbook(name: string): Promise<Record<string, unknown>> {
  const resp = await fetch('/api/worldinfo/get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!resp.ok) throw new Error(`/api/worldinfo/get ${resp.status}`);
  return resp.json() as Promise<Record<string, unknown>>;
}

async function exportCurrentWorldbook() {
  if (!worldbookName.value) {
    toastr.warning('LOAD_BOOK_FIRST', 'WORLD_FUI');
    return;
  }

  try {
    const name = worldbookName.value;
    const nativeData = await fetchNativeWorldbook(name);
    downloadJsonFile(nativeData, `${sanitizeFileName(name)}.json`);
    toastr.success('BOOK_EXPORTED', 'WORLD_FUI', { timeOut: 1500 });
  } catch (err) {
    console.error('[WORLD_FUI] export worldbook failed:', err);
    toastr.error('EXPORT BOOK FAILED', 'WORLD_FUI');
  }
}

function downloadJsonFile(payload: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'worldbook';
}

async function deleteCurrentWorldbook() {
  if (!worldbookName.value) {
    toastr.warning('请先加载世界书', '世界书美化');
    return;
  }

  const name = worldbookName.value;
  const confirmed = window.confirm(`删除整本世界书：${name}？\n此操作会删除所有条目。`);
  if (!confirmed) return;
  const typedName = window.prompt(`TYPE_BOOK_NAME_TO_DELETE\n${name}`);
  if (typedName !== name) {
    toastr.warning('DELETE_CANCELLED', 'WORLD_FUI', { timeOut: 1500 });
    return;
  }

  try {
    await deleteLorebookByName(name);
    clearSelectedWorldbookCache();
    refreshWorldbookNames();
    entries.value = [];
    worldbookName.value = '';
    selectedWorldbookName.value = '';
    activeUid.value = null;
    activeEl.value = null;
    hoveredEntry.value = null;
    hoveredEl.value = null;
    routePath.value = '';
    toastr.success('BOOK_DELETED', '世界书美化', { timeOut: 1500 });
  } catch (err) {
    console.error('[世界书美化] delete worldbook failed:', err);
    toastr.error('DELETE BOOK FAILED', '世界书美化');
  }
}

async function deleteLorebookByName(name: string) {
  const api = getTavernHelperLorebookApi();

  if (api?.deleteLorebook) {
    await api.deleteLorebook(name);
    return;
  }

  const legacy = (window as unknown as {
    deleteWorldbook?: (worldbookName: string) => Promise<unknown>;
  }).deleteWorldbook;
  if (legacy) {
    await legacy(name);
    return;
  }

  throw new Error('deleteLorebook/deleteWorldbook API not available');
}

async function createNewEntry() {
  if (!worldbookName.value) {
    toastr.warning('请先加载世界书', '世界书美化');
    return;
  }

  try {
    const result = await createWorldbookEntries(
      worldbookName.value,
      [{ name: 'NEW_NODE', content: '' }],
      { render: 'immediate' },
    );
    entries.value = result.worldbook;
    activeUid.value = null;
    activeEl.value = null;
    hoveredEntry.value = null;
    hoveredEl.value = null;
    routePath.value = '';
    toastr.success('ENTRY_CREATED', '世界书美化', { timeOut: 1500 });
  } catch (err) {
    console.error('[世界书美化] create entry failed:', err);
    toastr.error('CREATE ENTRY FAILED', '世界书美化');
  }
}

// --- Worldbook detection via MutationObserver + UID matching ---

let entryObserver: MutationObserver | null = null;
let detectTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleDetect() {
  if (!isDrawerOpen.value) return;
  if (detectTimer) clearTimeout(detectTimer);
  detectTimer = setTimeout(() => detectAndLoadWorldbook(), 150);
}

async function detectAndLoadWorldbook() {
  const $domEntries = $('#world_popup_entries_list .world_entry');
  if ($domEntries.length === 0) {
    return;
  }

  const targetUid = parseInt($domEntries.first().attr('uid') || '', 10);
  if (isNaN(targetUid)) return;

  // Skip if we already have this worldbook loaded
  if (entries.value.some(e => e.uid === targetUid)) return;

  loading.value = true;
  try {
    const names = getWorldbookNames();
    const results = await Promise.allSettled(
      names.map(async name => ({ name, wb: await getWorldbook(name) })),
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.wb.some(e => e.uid === targetUid)) {
        worldbookName.value = r.value.name;
        selectedWorldbookName.value = r.value.name;
        entries.value = r.value.wb;
        activeUid.value = null;
        activeEl.value = null;
        console.info(`[世界书美化] "${r.value.name}": ${r.value.wb.length} entries`);
        return;
      }
    }
    console.warn('[世界书美化] no matching worldbook for uid', targetUid);
  } catch (err) {
    console.error('[世界书美化] detect failed:', err);
  } finally {
    loading.value = false;
  }
}

function setupEntryWatcher() {
  const listEl = $('#world_popup_entries_list')[0];
  if (!listEl) {
    console.warn('[世界书美化] #world_popup_entries_list not found');
    return;
  }

  entryObserver = new MutationObserver(scheduleDetect);
  entryObserver.observe(listEl, { childList: true });

  // Select2 events as supplementary trigger
  $('#world_info').on('change.topo-wb select2:select.topo-wb select2:unselect.topo-wb', scheduleDetect);

  // Initial detection
  scheduleDetect();
}

// --- Event handlers ---

let wiHandler: EventOnReturn | null = null;

function onDiskSelect(payload: { entry: WorldbookEntry; el: HTMLElement }) {
  if (dragJustEnded) return;
  activeUid.value = payload.entry.uid;
  activeEl.value = payload.el;
  updateRoutingLine();
}

async function onToggleEnabled(entry: WorldbookEntry) {
  const newEnabled = !entry.enabled;
  try {
    await updateWorldbookWith(
      worldbookName.value,
      wb => wb.map(e => (e.uid === entry.uid ? { ...e, enabled: newEnabled } : e)),
      { render: 'immediate' },
    );
    const target = entries.value.find(e => e.uid === entry.uid);
    if (target) target.enabled = newEnabled;
    toastr.info(
      `${entry.name}: ${newEnabled ? 'ENABLED' : 'DISABLED'}`,
      '世界书美化',
      { timeOut: 1500 },
    );
  } catch (err) {
    console.error('[世界书美化] toggle failed:', err);
    toastr.error('操作失败', '世界书美化');
  }
}

function onHoverStart(payload: { entry: WorldbookEntry; el: HTMLElement }) {
  if (dragState.isDragging) return;
  hoveredEntry.value = payload.entry;
  hoveredEl.value = payload.el;
  updateRoutingLine();
}

function onHoverEnd() {
  if (dragState.isDragging) return;
  hoveredEntry.value = null;
  hoveredEl.value = null;
  updateRoutingLine();
}

// --- Drag to reorder (threshold intent detection: 5px movement → drag) ---

const DRAG_THRESHOLD = 5;
const LONG_PRESS_MS = 400;
const LONG_PRESS_MOVE_TOLERANCE = 8;

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
let longPressTimer: ReturnType<typeof setTimeout> | null = null;

function getTrackEl(): HTMLElement | null {
  return (trackRef.value as unknown as { $el?: HTMLElement })?.$el ?? null;
}

function cancelLongPress() {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function enterDragMode(entry: WorldbookEntry) {
  dragState.isDragging = true;
  activeUid.value = null;
  hoveredEntry.value = entries.value.find(e => e.uid === entry.uid) ?? null;
  if (spineRef.value) spineRef.value.style.overflowX = 'hidden';
  startDragRaf();
  toastr.info('DRAG_MODE', '世界书美化', { timeOut: 800 });
}

function onDiskPointerDown(event: PointerEvent, entry: WorldbookEntry) {
  if (event.button !== 0) return;
  if (searchQuery.value.trim()) return;

  dragState.uid = entry.uid;
  dragState.startX = event.clientX;
  dragState.isDragging = false;

  const doc = containerRef.value?.ownerDocument ?? document;

  if (isTouchDevice) {
    const startY = event.clientY;
    const earlyMoveCheck = (e: PointerEvent) => {
      const dx = Math.abs(e.clientX - dragState.startX);
      const dy = Math.abs(e.clientY - startY);
      if (dx > LONG_PRESS_MOVE_TOLERANCE || dy > LONG_PRESS_MOVE_TOLERANCE) {
        cancelLongPress();
        doc.removeEventListener('pointermove', earlyMoveCheck);
      }
    };
    doc.addEventListener('pointermove', earlyMoveCheck);

    longPressTimer = setTimeout(() => {
      doc.removeEventListener('pointermove', earlyMoveCheck);
      enterDragMode(entry);
      doc.addEventListener('pointermove', onDragMove);
    }, LONG_PRESS_MS);

    doc.addEventListener('pointerup', () => {
      cancelLongPress();
      doc.removeEventListener('pointermove', earlyMoveCheck);
      onDragEnd();
    }, { once: true });
  } else {
    doc.addEventListener('pointermove', onDragMove);
    doc.addEventListener('pointerup', onDragEnd);
  }
}

let dragRafId = 0;

function startDragRaf() {
  const loop = () => {
    if (!dragState.isDragging) return;
    const track = getTrackEl();
    if (track) {
      const idx = entries.value.findIndex(e => e.uid === dragState.uid);
      if (idx >= 0 && track.children[idx]) {
        hoveredEl.value = track.children[idx] as HTMLElement;
      }
    }
    updateRoutingLine();
    dragRafId = requestAnimationFrame(loop);
  };
  dragRafId = requestAnimationFrame(loop);
}

function stopDragRaf() {
  if (dragRafId) {
    cancelAnimationFrame(dragRafId);
    dragRafId = 0;
  }
}

function onDragMove(event: PointerEvent) {
  if (dragState.uid === null) return;

  if (!dragState.isDragging) {
    if (Math.abs(event.clientX - dragState.startX) < DRAG_THRESHOLD) return;
    dragState.isDragging = true;
    activeUid.value = null;
    hoveredEntry.value = entries.value.find(e => e.uid === dragState.uid) ?? null;
    startDragRaf();
  }

  if (isTouchDevice) event.preventDefault();

  const track = getTrackEl();
  if (!track) return;

  const dragIdx = entries.value.findIndex(e => e.uid === dragState.uid);
  if (dragIdx === -1) return;

  const children = Array.from(track.children) as HTMLElement[];
  let swapped = false;

  if (dragIdx > 0) {
    const leftRect = children[dragIdx - 1].getBoundingClientRect();
    if (event.clientX < leftRect.left + leftRect.width / 2) {
      const [item] = entries.value.splice(dragIdx, 1);
      entries.value.splice(dragIdx - 1, 0, item);
      swapped = true;
    }
  }

  if (!swapped && dragIdx < children.length - 1) {
    const rightRect = children[dragIdx + 1].getBoundingClientRect();
    if (event.clientX > rightRect.left + rightRect.width / 2) {
      const [item] = entries.value.splice(dragIdx, 1);
      entries.value.splice(dragIdx + 1, 0, item);
      swapped = true;
    }
  }
}

function onDragEnd() {
  cancelLongPress();
  stopDragRaf();
  const doc = containerRef.value?.ownerDocument ?? document;
  doc.removeEventListener('pointermove', onDragMove);

  if (spineRef.value) spineRef.value.style.overflowX = '';

  if (dragState.isDragging) {
    const track = getTrackEl();
    if (track) {
      const eatClick = (e: Event) => { e.stopPropagation(); e.preventDefault(); };
      track.addEventListener('click', eatClick, { capture: true, once: true });
      setTimeout(() => track.removeEventListener('click', eatClick, { capture: true } as EventListenerOptions), 500);
    }
    dragJustEnded = true;
    setTimeout(() => { dragJustEnded = false; }, 300);
    persistDragOrder();
  }

  hoveredEntry.value = null;
  hoveredEl.value = null;
  routePath.value = '';
  dragState.uid = null;
  dragState.isDragging = false;
}

async function persistDragOrder() {
  if (!worldbookName.value) return;

  const uidOrder = entries.value.map(e => e.uid);

  suppressWiReload = true;
  try {
    await updateWorldbookWith(
      worldbookName.value,
      wb => {
        const byUid = new Map(wb.map(e => [e.uid, e]));
        return uidOrder
          .map(uid => byUid.get(uid))
          .filter((e): e is WorldbookEntry => e != null);
      },
    );
  } catch (err) {
    console.error('[世界书美化] persist drag order failed:', err);
  } finally {
    setTimeout(() => { suppressWiReload = false; }, 2000);
  }
}

function closeIde() {
  activeUid.value = null;
  activeEl.value = null;
  updateRoutingLine();
}

async function onSaveEntry(patch: Partial<WorldbookEntry> & { uid: number }) {
  try {
    await updateWorldbookWith(
      worldbookName.value,
      wb => wb.map(e => (e.uid === patch.uid ? { ...e, ...patch } : e)),
      { render: 'immediate' },
    );
    await patchRawLorebookEntryFields(worldbookName.value, patch);
    await loadWorldbook(worldbookName.value);
    toastr.success('COMMITTED', '世界书美化', { timeOut: 1500 });
  } catch (err) {
    console.error('[世界书美化] save failed:', err);
    toastr.error('COMMIT FAILED', '世界书美化');
  }
}

async function patchRawLorebookEntryFields(
  name: string,
  patch: Partial<WorldbookEntry> & { uid: number },
) {
  const rawPatch = patch as unknown as { depth?: number; order?: number };
  if (rawPatch.depth === undefined && rawPatch.order === undefined) return;

  const api = getTavernHelperLorebookApi();

  if (!api?.updateLorebookEntriesWith) {
    console.warn('[世界书美化] updateLorebookEntriesWith not available');
    return;
  }

  await api.updateLorebookEntriesWith(
    name,
    wb => wb.map(entry => {
      if (entry.uid !== patch.uid) return entry;
      return {
        ...entry,
        ...(rawPatch.depth !== undefined ? { depth: rawPatch.depth } : {}),
        ...(rawPatch.order !== undefined ? { order: rawPatch.order } : {}),
      };
    }),
    { render: 'immediate' },
  );
}

async function onDeleteEntry(entry: WorldbookEntry) {
  try {
    await updateWorldbookWith(
      worldbookName.value,
      wb => wb.filter(e => e.uid !== entry.uid),
      { render: 'immediate' },
    );
    activeUid.value = null;
    activeEl.value = null;
    hoveredEntry.value = null;
    hoveredEl.value = null;
    routePath.value = '';
    await loadWorldbook(worldbookName.value);
    toastr.success('NODE_DELETED', '世界书美化', { timeOut: 1500 });
  } catch (err) {
    console.error('[世界书美化] delete entry failed:', err);
    toastr.error('DELETE FAILED', '世界书美化');
  }
}

// --- Horizontal scroll ---

function onWheel(e: WheelEvent) {
  if (!spineRef.value) return;
  spineRef.value.scrollLeft += e.deltaY !== 0 ? e.deltaY : e.deltaX;
  if (hoveredEl.value || activeEl.value) updateRoutingLine();
}

// --- SVG routing line ---

function updateRoutingLine() {
  if (!isDrawerOpen.value) {
    routePath.value = '';
    return;
  }

  const targetEl = hoveredEl.value ?? activeEl.value;
  if (!targetEl || !rootRef.value || !containerRef.value || !svgRef.value) {
    routePath.value = '';
    return;
  }

  syncSvgViewBox();

  const cr = svgRef.value.getBoundingClientRect();
  const rr = rootRef.value.getBoundingClientRect();
  const dr = targetEl.getBoundingClientRect();

  if (cr.width === 0 || cr.height === 0 || rr.width === 0 || dr.width === 0) {
    routePath.value = '';
    return;
  }

  const view = containerRef.value.ownerDocument.defaultView ?? window;
  const cs = view.getComputedStyle(containerRef.value);
  const bend = parseFloat(cs.getPropertyValue('--wb-route-bend')) || 0.4;
  const rootOx = parseFloat(cs.getPropertyValue('--wb-route-root-x')) || 0;
  const rootOy = parseFloat(cs.getPropertyValue('--wb-route-root-y')) || 0;

  const startX = rr.left + rr.width / 2 - cr.left + rootOx;
  const startY = rr.bottom - cr.top + rootOy;

  const slotEl = targetEl.querySelector('.wb-disk__slot') as HTMLElement | null;
  let endX: number, endY: number;
  if (slotEl) {
    const sr = slotEl.getBoundingClientRect();
    endX = sr.left - cr.left;
    endY = sr.top - cr.top;
  } else {
    endX = dr.left + dr.width / 2 - cr.left;
    endY = dr.top - cr.top;
  }

  const midY = startY + (endY - startY) * bend;
  routePath.value = `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
}

function onTweakChange() {
  nextTick(updateRoutingLine);
}

// --- SVG viewBox sync ---

let ro: ResizeObserver | null = null;

function syncSvgViewBox() {
  if (!containerRef.value || !svgRef.value) return;
  const rect = svgRef.value.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  svgRef.value.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
}

// --- Tavern drawer bridge ---

let drawerObserver: MutationObserver | null = null;

function getWorldInfoDrawer(): HTMLElement | null {
  return $('#WorldInfo')[0] ?? null;
}

function readDrawerOpenState(): boolean {
  const drawer = getWorldInfoDrawer();
  if (!drawer) return false;
  const style = getComputedStyle(drawer);
  return !drawer.classList.contains('closedDrawer') && style.display !== 'none' && style.visibility !== 'hidden';
}

function refreshDrawerState() {
  const open = readDrawerOpenState();
  if (isDrawerOpen.value === open) {
    if (open) {
      nextTick(() => {
        syncSvgViewBox();
        updateRoutingLine();
      });
    }
    return;
  }

  isDrawerOpen.value = open;

  if (!open) {
    hoveredEntry.value = null;
    hoveredEl.value = null;
    routePath.value = '';
    return;
  }

  nextTick(() => {
    syncSvgViewBox();
    scheduleDetect();
    updateRoutingLine();
  });
}

function setupDrawerWatcher() {
  const drawer = getWorldInfoDrawer();
  if (!drawer) {
    console.warn('[世界书美化] #WorldInfo not found');
    return;
  }

  drawerObserver = new MutationObserver(refreshDrawerState);
  drawerObserver.observe(drawer, { attributes: true, attributeFilter: ['class', 'style'] });
  refreshDrawerState();
}

function closeWorldbookDrawer() {
  const icon = $('#WIDrawerIcon')[0];
  if (icon) {
    icon.click();
    return;
  }

  console.warn('[世界书美化] #WIDrawerIcon not found');
}

// --- Lifecycle ---

onMounted(() => {
  refreshWorldbookNames();
  setupDrawerWatcher();
  setupEntryWatcher();
  restoreCachedWorldbook();

  wiHandler = eventOn(tavern_events.WORLDINFO_UPDATED, (name: string) => {
    if (suppressWiReload) return;
    if (name === worldbookName.value) {
      loadWorldbook(name);
    }
  });

  ro = new ResizeObserver(syncSvgViewBox);
  if (containerRef.value) ro.observe(containerRef.value);

  spineRef.value?.addEventListener('scroll', () => {
    if (hoveredEl.value || activeEl.value) updateRoutingLine();
  }, { passive: true });

  window.addEventListener('resize', refreshDrawerState);
  window.addEventListener('wb-tweak-change', onTweakChange);

  nextTick(refreshDrawerState);
});

onUnmounted(() => {
  entryObserver?.disconnect();
  if (detectTimer) clearTimeout(detectTimer);
  $('#world_info').off('.topo-wb');
  wiHandler?.stop();
  ro?.disconnect();
  drawerObserver?.disconnect();
  window.removeEventListener('resize', refreshDrawerState);
  window.removeEventListener('wb-tweak-change', onTweakChange);
});
</script>

<style scoped>
.wb-main {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  flex: 1;
  min-height: 430px;
  padding: 0;
  background: var(--wb-bg);
  background-image: radial-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 16px 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
  opacity: 0;
  pointer-events: none;
  transform: translateY(8px) scale(0.995);
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
  overflow: hidden;
}

.wb-main--visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0) scale(1);
}

/* Shell bar */
.wb-shell-bar {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px 0 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.28);
  z-index: 30;
  flex-shrink: 0;
}

.wb-shell-bar__meta {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.wb-shell-bar__mark {
  color: var(--wb-text);
  font-size: 11px;
  letter-spacing: 3px;
}

.wb-shell-bar__source {
  color: var(--wb-text-muted);
  font-size: 11px;
  letter-spacing: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: min(42vw, 640px);
}

.wb-shell-bar__count {
  color: var(--wb-user);
  font-size: 10px;
  letter-spacing: 2px;
  white-space: nowrap;
}

.wb-shell-bar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.wb-shell-bar__close {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.04);
  color: var(--wb-text);
  height: 26px;
  padding: 0 11px;
  font: inherit;
  font-size: 10px;
  letter-spacing: 2px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}

.wb-shell-bar__close:hover {
  border-color: var(--wb-sys);
  color: var(--wb-sys);
  background: rgba(255, 107, 0, 0.08);
}

/* Bridge controls */
.wb-bridge-bar {
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.025);
  z-index: 30;
  flex-shrink: 0;
}

.wb-bridge-bar__select,
.wb-bridge-bar__search {
  height: 24px;
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.35);
  color: var(--wb-text);
  font: inherit;
  font-size: 10px;
  letter-spacing: 1px;
  outline: none;
}

.wb-bridge-bar__select {
  width: min(36vw, 520px);
  padding: 0 8px;
}

.wb-bridge-bar__select option {
  background: #111;
  color: var(--wb-text);
}

.wb-bridge-bar__search {
  flex: 1;
  padding: 0 9px;
}

.wb-bridge-bar__search::placeholder {
  color: rgba(224, 224, 224, 0.35);
}

.wb-bridge-bar__file {
  display: none;
}

.wb-bridge-bar__button {
  appearance: none;
  height: 24px;
  padding: 0 9px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: var(--wb-text);
  font: inherit;
  font-size: 9px;
  letter-spacing: 1.5px;
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease,
    opacity 0.15s ease;
}

.wb-bridge-bar__button:hover:not(:disabled) {
  border-color: var(--wb-user);
  color: var(--wb-user);
  background: rgba(0, 255, 65, 0.06);
}

.wb-bridge-bar__button--danger:hover:not(:disabled) {
  border-color: var(--wb-sys);
  color: var(--wb-sys);
  background: rgba(255, 107, 0, 0.08);
}

.wb-bridge-bar__button:disabled {
  cursor: not-allowed;
  opacity: 0.38;
}

/* SVG routing */
.wb-routing {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  overflow: visible;
}

.wb-routing__line {
  fill: none;
  stroke-width: 1;
  transition: stroke 0.15s ease;
}

/* Root anchor */
.wb-root-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--wb-root-pad-top, 18px) 0 var(--wb-root-pad-bottom, 20px);
  flex-shrink: 0;
}

.wb-root {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--wb-text-muted);
  user-select: none;
  position: relative;
  z-index: 20;
}

.wb-root__symbol {
  font-size: 28px;
}

.wb-root__label {
  font-size: 11px;
  letter-spacing: 4px;
  text-transform: uppercase;
}

.wb-root__count {
  font-size: 10px;
  color: var(--wb-text-muted);
  opacity: 0.6;
}

/* Data spine */
.wb-spine-wrapper {
  position: relative;
  width: 100%;
  z-index: 2;
  flex: 1;
  min-height: 0;
  margin-bottom: var(--wb-spine-offset, 0px);
}

.wb-spine {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  overflow-x: auto;
  overflow-y: hidden;
  padding: var(--wb-spine-pad-top, 72px) 0 28px;
  padding-left: var(--wb-spine-pad-left, 40px);
  padding-right: 50%;
  scrollbar-width: none;
  scroll-behavior: smooth;
}

.wb-spine::-webkit-scrollbar {
  display: none;
}

.wb-spine__track {
  display: flex;
  gap: var(--wb-gap);
  align-items: flex-end;
  position: relative;
  min-width: min-content;
}

.disk-move {
  transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Empty state */
.wb-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--wb-text-muted);
  font-size: 12px;
  letter-spacing: 3px;
  pointer-events: none;
  z-index: 5;
}

@media (max-width: 1000px) {
  .wb-main {
    min-height: 340px;
  }
  .wb-bridge-bar {
    flex-wrap: wrap;
  }
  .wb-bridge-bar__select,
  .wb-bridge-bar__search {
    width: 100%;
    flex-basis: 100%;
  }
  .wb-spine {
    padding-left: 16px;
    padding-right: 30%;
  }
}

@media (max-width: 768px) {
  .wb-main {
    min-height: 0;
    border: none;
  }

  .wb-shell-bar {
    height: 36px;
    padding: 0 10px;
  }

  .wb-shell-bar__mark {
    font-size: 10px;
    letter-spacing: 2px;
  }

  .wb-shell-bar__source {
    max-width: 120px;
    font-size: 10px;
  }

  .wb-shell-bar__count {
    font-size: 9px;
  }

  .wb-bridge-bar {
    padding: 6px 10px;
    gap: 6px;
    flex-wrap: wrap;
  }

  .wb-bridge-bar__select {
    width: 100%;
    flex-basis: 100%;
    height: 28px;
    font-size: 11px;
  }

  .wb-bridge-bar__search {
    width: 100%;
    flex-basis: 100%;
    height: 28px;
    font-size: 11px;
    order: 10;
  }

  .wb-bridge-bar__button {
    height: 28px;
    padding: 0 6px;
    font-size: 8px;
    letter-spacing: 0.5px;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .wb-root-zone {
    padding: 10px 0 12px;
  }

  .wb-root__symbol {
    font-size: 22px;
  }

  .wb-root__label {
    font-size: 10px;
    letter-spacing: 3px;
  }

  .wb-spine {
    padding-left: 12px;
    padding-right: 40%;
    padding-top: var(--wb-spine-pad-top, 48px);
    padding-bottom: 20px;
  }
}
</style>
