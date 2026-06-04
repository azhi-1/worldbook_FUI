<template>
  <div class="wb-ide" :class="{ 'wb-ide--open': visible }" @keydown.esc="$emit('close')">
    <div class="wb-ide__backdrop" @click="$emit('close')" />

    <div class="wb-ide__window">
      <div class="wb-ide__header">
        <div class="wb-ide__breadcrumb">
          <span class="wb-ide__breadcrumb-dot" />
          // DATA_CORE / TRIGGER_NODE / <span>NODE_{{ String(entry.uid).padStart(3, '0') }}</span>.yaml
        </div>
        <div class="wb-ide__actions">
          <div class="wb-ide__delete" @click="onDelete">[ DELETE_NODE ]</div>
          <div class="wb-ide__commit" @click="onCommit">[ COMMIT ]</div>
          <div class="wb-ide__eject" @click="$emit('close')">[ EJECT ]</div>
        </div>
      </div>

      <div class="wb-ide__body">
        <div class="wb-ide__sidebar">
          <!-- Section 1: Identity -->
          <div class="wb-ide__zone">
            <div class="wb-ide__zone-title">1. 条目身份 (SLICE HEADER)</div>
            <div class="wb-ide__row">
              <span class="wb-ide__label">名称 (Name)</span>
              <input
                v-model="localName"
                type="text"
                class="wb-ide__input"
                style="width: 140px"
              />
            </div>
            <div class="wb-ide__row">
              <span class="wb-ide__label">状态 (Status)</span>
              <div
                class="wb-ide__toggle"
                :class="{ 'wb-ide__toggle--on': localEnabled }"
                @click="localEnabled = !localEnabled"
              />
            </div>
            <div class="wb-ide__row">
              <span class="wb-ide__label">触发策略 (Strategy)</span>
              <div class="wb-ide__control-stack wb-ide__control-stack--right">
                <select v-model="localStrategyType" class="wb-ide__select">
                  <option value="constant">蓝灯 常驻触发</option>
                  <option value="selective">绿灯 关键字/条件触发</option>
                  <option value="vectorized">锁链 向量触发</option>
                </select>
                <span
                  class="wb-ide__strategy-signal"
                  :data-strategy="localStrategyType"
                >
                  {{ strategySignalLabel }}
                </span>
              </div>
            </div>
            <div class="wb-ide__row">
              <span class="wb-ide__label">插入位置 (Position)</span>
              <select v-model="localPositionKey" class="wb-ide__select">
                <option
                  v-for="option in positionOptions"
                  :key="option.key"
                  :value="option.key"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div v-if="isDepthPosition" class="wb-ide__row">
              <span class="wb-ide__label">深度 (Depth)</span>
              <input
                v-model.number="localDepth"
                type="number"
                class="wb-ide__input"
                style="width: 50px"
                min="0"
              />
            </div>
            <div class="wb-ide__row">
              <span class="wb-ide__label">顺序 (Order)</span>
              <input
                v-model.number="localOrder"
                type="number"
                class="wb-ide__input"
                style="width: 70px"
              />
            </div>
          </div>

          <!-- Section 2: Trigger Matrix -->
          <div v-if="localStrategyType === 'selective'" class="wb-ide__zone">
            <div class="wb-ide__zone-title">2. 触发矩阵 (TRIGGER MATRIX)</div>
            <div class="wb-ide__row wb-ide__row--col">
              <span class="wb-ide__label">主关键字 (Primary Keys)</span>
              <input
                v-model="localKeys"
                type="text"
                class="wb-ide__input"
                style="width: 100%"
              />
            </div>
            <div class="wb-ide__row">
              <span class="wb-ide__label">扫描深度 (Scan Depth)</span>
              <span class="wb-ide__value">{{ scanDepthLabel }}</span>
            </div>
          </div>

          <!-- Section 3: Recursion Gate -->
          <div class="wb-ide__zone">
            <div class="wb-ide__zone-title">3. 递归闸门 (RECURSION GATE)</div>
            <div class="wb-ide__row">
              <span class="wb-ide__label">不可递归 (Prevent In)</span>
              <div
                class="wb-ide__toggle"
                :class="{ 'wb-ide__toggle--on': localRecursion.preventIncoming }"
                @click="localRecursion.preventIncoming = !localRecursion.preventIncoming"
              />
            </div>
            <div class="wb-ide__hint">不会被其他条目激活</div>
            <div class="wb-ide__row">
              <span class="wb-ide__label">防止进一步递归 (Prevent Out)</span>
              <div
                class="wb-ide__toggle"
                :class="{ 'wb-ide__toggle--on': localRecursion.preventOutgoing }"
                @click="localRecursion.preventOutgoing = !localRecursion.preventOutgoing"
              />
            </div>
          </div>

          <!-- Section 4: Temporal Controls -->
          <div class="wb-ide__zone">
            <div class="wb-ide__zone-title">4. 时间控制器 (TEMPORAL)</div>
            <div class="wb-ide__row">
              <span class="wb-ide__label">粘性 (Sticky)</span>
              <input
                v-model.number="localEffect.sticky"
                type="number"
                class="wb-ide__input"
                style="width: 50px"
                min="0"
              />
            </div>
            <div class="wb-ide__row">
              <span class="wb-ide__label">冷却 (Cooldown)</span>
              <input
                v-model.number="localEffect.cooldown"
                type="number"
                class="wb-ide__input"
                style="width: 50px"
                min="0"
              />
            </div>
            <div class="wb-ide__row">
              <span class="wb-ide__label">延迟 (Delay)</span>
              <input
                v-model.number="localEffect.delay"
                type="number"
                class="wb-ide__input"
                style="width: 50px"
                min="0"
              />
            </div>
          </div>

          <!-- Section 5: Probability -->
          <div class="wb-ide__zone">
            <div class="wb-ide__zone-title">5. 激活概率 (PROBABILITY)</div>
            <div class="wb-ide__row">
              <span class="wb-ide__label">概率 %</span>
              <span class="wb-ide__value">{{ entry.probability }}%</span>
            </div>
          </div>
        </div>

        <div class="wb-ide__workspace">
          <div class="wb-ide__workspace-header">
            <span>PAYLOAD CONTENT</span>
            <span>{{ localContent.length }} CHARS</span>
          </div>
          <div class="wb-ide__editor-wrap">
            <div ref="lineNumsRef" class="wb-ide__line-nums">
              <span v-for="n in lineCount" :key="n">{{ n }}</span>
            </div>
            <div class="wb-ide__editor-container">
              <pre
                ref="overlayRef"
                class="wb-ide__highlight"
                aria-hidden="true"
              ><code v-html="highlighted" /></pre>
              <textarea
                ref="textareaRef"
                v-model="localContent"
                class="wb-ide__textarea"
                spellcheck="false"
                @scroll="syncScroll"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { formatKeys, highlightContent } from '../types';

const props = defineProps<{
  entry: WorldbookEntry;
  worldbookName: string;
}>();

const emit = defineEmits<{
  close: [];
  save: [patch: Partial<WorldbookEntry> & { uid: number }];
  'delete-entry': [entry: WorldbookEntry];
}>();

const visible = ref(false);
const textareaRef = ref<HTMLTextAreaElement>();
const overlayRef = ref<HTMLPreElement>();
const lineNumsRef = ref<HTMLElement>();

const localName = ref(props.entry.name);
const localContent = ref(props.entry.content);
const localEnabled = ref(props.entry.enabled);
const localStrategyType = ref(props.entry.strategy.type);
const localPositionKey = ref(getPositionKey(props.entry.position));
const localDepth = ref(getEntryDepth(props.entry));
const localOrder = ref(getEntryOrder(props.entry));
const localKeys = ref(formatKeys(props.entry.strategy.keys));
const localRecursion = reactive({
  preventIncoming: props.entry.recursion.prevent_incoming,
  preventOutgoing: props.entry.recursion.prevent_outgoing,
});
const localEffect = reactive({
  sticky: props.entry.effect.sticky ?? 0,
  cooldown: props.entry.effect.cooldown ?? 0,
  delay: props.entry.effect.delay ?? 0,
});

type PositionKey =
  | 'before_character_definition'
  | 'after_character_definition'
  | 'before_example_messages'
  | 'after_example_messages'
  | 'before_author_note'
  | 'after_author_note'
  | 'at_depth:system'
  | 'at_depth:user'
  | 'at_depth:assistant'
  | 'outlet';

const positionOptions: { key: PositionKey; label: string }[] = [
  { key: 'before_character_definition', label: '角色定义前 (↑ Char)' },
  { key: 'after_character_definition', label: '角色定义后 (↓ Char)' },
  { key: 'before_example_messages', label: '示例消息前 (↑ EM)' },
  { key: 'after_example_messages', label: '示例消息后 (↓ EM)' },
  { key: 'before_author_note', label: '作者注释前 (↑ AN)' },
  { key: 'after_author_note', label: '作者注释后 (↓ AN)' },
  { key: 'at_depth:system', label: '[系统] 插入深度 @D' },
  { key: 'at_depth:user', label: '[用户] 插入深度 @D' },
  { key: 'at_depth:assistant', label: '[AI] 插入深度 @D' },
  { key: 'outlet', label: '锚点' },
];
const isDepthPosition = computed(() => localPositionKey.value.startsWith('at_depth:'));
const strategySignalLabel = computed(() => {
  if (localStrategyType.value === 'constant') return 'BLUE_LAMP // 常驻触发';
  if (localStrategyType.value === 'vectorized') return 'CHAIN // 向量触发';
  return 'GREEN_LAMP // 关键字/条件触发';
});
const scanDepthLabel = computed(() => {
  const sd = props.entry.strategy.scan_depth;
  return sd === 'same_as_global' ? 'GLOBAL' : String(sd);
});
const lineCount = computed(() => localContent.value.split('\n').length);
const highlighted = computed(() => highlightContent(localContent.value));

watch(
  () => props.entry,
  (e) => {
    localName.value = e.name;
    localContent.value = e.content;
    localEnabled.value = e.enabled;
    localStrategyType.value = e.strategy.type;
    localPositionKey.value = getPositionKey(e.position);
    localDepth.value = getEntryDepth(e);
    localOrder.value = getEntryOrder(e);
    localKeys.value = formatKeys(e.strategy.keys);
    localRecursion.preventIncoming = e.recursion.prevent_incoming;
    localRecursion.preventOutgoing = e.recursion.prevent_outgoing;
    localEffect.sticky = e.effect.sticky ?? 0;
    localEffect.cooldown = e.effect.cooldown ?? 0;
    localEffect.delay = e.effect.delay ?? 0;
  },
);

function syncScroll() {
  if (!textareaRef.value || !overlayRef.value || !lineNumsRef.value) return;
  overlayRef.value.scrollTop = textareaRef.value.scrollTop;
  overlayRef.value.scrollLeft = textareaRef.value.scrollLeft;
  lineNumsRef.value.scrollTop = textareaRef.value.scrollTop;
}

function onCommit() {
  const keysArr = localKeys.value
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);
  const positionPatch = getPositionPatch(localPositionKey.value);

  emit('save', {
    uid: props.entry.uid,
    name: localName.value,
    enabled: localEnabled.value,
    content: localContent.value,
    strategy: {
      ...props.entry.strategy,
      type: localStrategyType.value,
      keys: keysArr,
    },
    position: {
      ...props.entry.position,
      type: positionPatch.type,
      role: positionPatch.role,
    },
    depth: localDepth.value,
    order: localOrder.value,
    recursion: {
      prevent_incoming: localRecursion.preventIncoming,
      prevent_outgoing: localRecursion.preventOutgoing,
      delay_until: props.entry.recursion.delay_until,
    },
    effect: {
      sticky: localEffect.sticky || null,
      cooldown: localEffect.cooldown || null,
      delay: localEffect.delay || null,
    },
  });
}

function onDelete() {
  const label = props.entry.name || `UID_${props.entry.uid}`;
  if (!window.confirm(`删除世界书条目：${label}？`)) return;
  emit('delete-entry', props.entry);
}

function getPositionKey(position: WorldbookEntry['position']): PositionKey {
  if (position.type === 'at_depth') {
    const role = position.role === 'user' || position.role === 'assistant' ? position.role : 'system';
    return `at_depth:${role}`;
  }
  if (position.type === 'outlet') return 'outlet';
  return position.type as PositionKey;
}

function getPositionPatch(key: PositionKey): Pick<WorldbookEntry['position'], 'type' | 'role'> {
  if (key.startsWith('at_depth:')) {
    const role = key.slice('at_depth:'.length) as WorldbookEntry['position']['role'];
    return { type: 'at_depth', role };
  }
  return { type: key as WorldbookEntry['position']['type'], role: props.entry.position.role };
}

function getEntryDepth(entry: WorldbookEntry): number {
  const raw = (entry as unknown as { depth?: number }).depth;
  return raw ?? 0;
}

function getEntryOrder(entry: WorldbookEntry): number {
  const raw = (entry as unknown as { order?: number }).order;
  return raw ?? 100;
}

onMounted(() => {
  nextTick(() => {
    visible.value = true;
  });
});
</script>

<style scoped>
.wb-ide {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s;

  --ide-bg: #1f1f1f;
  --ide-editor-bg: #262626;
  --ide-border: #3e3e38;
  --ide-text: #c3c1ba;
  --ide-muted: #9a988f;
  --ide-accent: #d87757;
  --ide-header-bg: #1b1b1b;
}

.wb-ide--open {
  pointer-events: auto;
  opacity: 1;
}

.wb-ide__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(12px);
  z-index: 1;
  cursor: pointer;
}

.wb-ide__window {
  position: relative;
  z-index: 2;
  width: 92%;
  height: 88%;
  background: var(--ide-bg);
  border: 1px solid var(--ide-border);
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  color: var(--ide-text);
  transform: scale(0.98);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.wb-ide--open .wb-ide__window {
  transform: scale(1);
}

.wb-ide__header {
  height: 40px;
  border-bottom: 1px solid var(--ide-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  background: var(--ide-header-bg);
  flex-shrink: 0;
}

.wb-ide__breadcrumb {
  color: var(--ide-muted);
  font-size: 11px;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.wb-ide__breadcrumb-dot {
  width: 8px;
  height: 8px;
  background: var(--ide-accent);
  display: inline-block;
}

.wb-ide__actions {
  display: flex;
  gap: 16px;
}

.wb-ide__delete {
  color: #ff9d4d;
  cursor: pointer;
  font-size: 11px;
  letter-spacing: 2px;
  transition: color 0.2s;
}
.wb-ide__delete:hover {
  color: #ffc18a;
}

.wb-ide__commit {
  color: #6bff6b;
  cursor: pointer;
  font-size: 11px;
  letter-spacing: 2px;
  transition: color 0.2s;
}
.wb-ide__commit:hover {
  color: #a0ffa0;
}

.wb-ide__eject {
  color: #f14444;
  cursor: pointer;
  font-size: 11px;
  letter-spacing: 2px;
  transition: color 0.2s;
}
.wb-ide__eject:hover {
  color: #ff7777;
}

.wb-ide__body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Sidebar */
.wb-ide__sidebar {
  width: 320px;
  border-right: 1px solid var(--ide-border);
  background: var(--ide-bg);
  flex-shrink: 0;
  overflow-y: auto;
  padding: 20px;
  font-size: 11px;
  scrollbar-width: none;
}
.wb-ide__sidebar::-webkit-scrollbar {
  display: none;
}

.wb-ide__zone {
  margin-bottom: 28px;
}

.wb-ide__zone-title {
  font-size: 10px;
  font-weight: bold;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--ide-border);
  padding-bottom: 4px;
  letter-spacing: 1px;
  color: var(--ide-text);
}

.wb-ide__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.wb-ide__row--col {
  flex-direction: column;
  align-items: flex-start;
}

.wb-ide__row--col .wb-ide__label {
  margin-bottom: 4px;
}

.wb-ide__label {
  color: var(--ide-muted);
}

.wb-ide__value {
  color: var(--ide-text);
  font-variant-numeric: tabular-nums;
}

.wb-ide__hint {
  margin: -5px 0 10px;
  color: color-mix(in srgb, var(--ide-muted) 72%, transparent);
  font-size: 10px;
  text-align: right;
}

.wb-ide__control-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wb-ide__control-stack--right {
  align-items: flex-end;
}

.wb-ide__strategy-signal {
  color: var(--ide-muted);
  font-size: 9px;
  letter-spacing: 1px;
}

.wb-ide__strategy-signal[data-strategy='constant'] {
  color: #4aa3ff;
}
.wb-ide__strategy-signal[data-strategy='selective'] {
  color: #6bff6b;
}
.wb-ide__strategy-signal[data-strategy='vectorized'] {
  color: #b4a7ff;
}

.wb-ide__input {
  background: #1b1b1b;
  color: var(--ide-text);
  border: 1px solid var(--ide-border);
  font-family: inherit;
  font-size: 11px;
  padding: 4px 6px;
  outline: none;
  transition: border-color 0.2s;
}
.wb-ide__input:focus {
  border-color: var(--ide-accent);
}

.wb-ide__select {
  background: #1b1b1b;
  color: var(--ide-text);
  border: 1px solid var(--ide-border);
  font-family: inherit;
  font-size: 11px;
  padding: 2px 6px;
  outline: none;
  cursor: pointer;
}
.wb-ide__select option {
  background: var(--ide-bg);
  color: var(--ide-text);
}

.wb-ide__toggle {
  width: 28px;
  height: 12px;
  background: #1b1b1b;
  border: 1px solid var(--ide-border);
  border-radius: 2px;
  position: relative;
  cursor: pointer;
  transition: border-color 0.2s;
}
.wb-ide__toggle::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 2px;
  width: 6px;
  height: 6px;
  background: var(--ide-muted);
  transition: 0.2s;
}
.wb-ide__toggle--on {
  border-color: var(--ide-accent);
}
.wb-ide__toggle--on::after {
  left: 18px;
  background: var(--ide-accent);
}

/* Workspace */
.wb-ide__workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: var(--ide-editor-bg);
  overflow: hidden;
}

.wb-ide__workspace-header {
  font-size: 10px;
  color: var(--ide-muted);
  margin-bottom: 10px;
  letter-spacing: 1px;
  display: flex;
  justify-content: space-between;
}

.wb-ide__editor-wrap {
  flex: 1;
  display: flex;
  border: 1px solid var(--ide-border);
  min-height: 0;
}

.wb-ide__line-nums {
  padding: 15px 12px;
  color: #6b6961;
  text-align: right;
  background: var(--ide-bg);
  border-right: 1px solid var(--ide-border);
  user-select: none;
  line-height: 1.6;
  font-size: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.wb-ide__editor-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.wb-ide__textarea,
.wb-ide__highlight {
  position: absolute !important;
  inset: 0 !important;
  padding: 15px !important;
  margin: 0 !important;
  font-family: inherit !important;
  font-size: 12px !important;
  line-height: 1.6 !important;
  white-space: pre !important;
  border: none !important;
  box-sizing: border-box !important;
  overflow: auto !important;
  tab-size: 2 !important;
}

.wb-ide__textarea {
  color: transparent !important;
  caret-color: var(--ide-accent) !important;
  background: transparent !important;
  resize: none !important;
  outline: none !important;
  z-index: 2;
  -webkit-text-fill-color: transparent !important;
}

.wb-ide__textarea::selection {
  background: rgba(216, 119, 87, 0.25) !important;
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
}

.wb-ide__highlight {
  z-index: 1;
  color: var(--ide-text) !important;
  pointer-events: none !important;
  background: transparent !important;
  -webkit-text-fill-color: var(--ide-text) !important;
  /* Kill BBS theme's TERMINAL pseudo-elements on <pre> */
  border: none !important;
  border-radius: 0 !important;
  margin: 0 !important;
  position: absolute !important;
}

/* Block BBS theme pre::before ("TERMINAL") and pre::after decorations */
.wb-ide__highlight::before,
.wb-ide__highlight::after {
  content: none !important;
  display: none !important;
}

.wb-ide__highlight :deep(code) {
  color: inherit !important;
  background: transparent !important;
  -webkit-text-fill-color: inherit !important;
  font-family: inherit !important;
  font-size: inherit !important;
  line-height: inherit !important;
  white-space: inherit !important;
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
}

/* Syntax tokens — Claude Dark theme palette */
.wb-ide__highlight :deep(.hl-key) {
  color: #c4a66e !important;
  -webkit-text-fill-color: #c4a66e !important;
}
.wb-ide__highlight :deep(.hl-string) {
  color: #8fba6a !important;
  -webkit-text-fill-color: #8fba6a !important;
}
.wb-ide__highlight :deep(.hl-comment) {
  color: #6b6961 !important;
  -webkit-text-fill-color: #6b6961 !important;
  font-style: italic;
}
.wb-ide__highlight :deep(.hl-number) {
  color: #e89b76 !important;
  -webkit-text-fill-color: #e89b76 !important;
}
.wb-ide__highlight :deep(.hl-bool) {
  color: #e89b76 !important;
  -webkit-text-fill-color: #e89b76 !important;
  font-style: italic;
}

/* Responsive */
@media (max-width: 1000px) {
  .wb-ide__window {
    width: 98%;
    height: 96%;
  }
  .wb-ide__body {
    flex-direction: column;
  }
  .wb-ide__sidebar {
    width: 100%;
    height: 45%;
    border-right: none;
    border-bottom: 1px solid var(--ide-border);
  }
  .wb-ide__workspace {
    width: 100%;
    height: 55%;
    padding: 15px;
  }
}

@media (max-width: 768px) {
  .wb-ide__window {
    width: 100%;
    height: 100%;
    border: none;
  }

  .wb-ide__header {
    height: 36px;
    padding: 0 10px;
    flex-wrap: wrap;
  }

  .wb-ide__breadcrumb {
    font-size: 9px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 50%;
  }

  .wb-ide__actions {
    gap: 10px;
  }

  .wb-ide__delete,
  .wb-ide__commit,
  .wb-ide__eject {
    font-size: 10px;
    letter-spacing: 1px;
  }

  .wb-ide__sidebar {
    height: 40%;
    padding: 12px;
  }

  .wb-ide__zone-title {
    font-size: 9px;
  }

  .wb-ide__row {
    margin-bottom: 8px;
  }

  .wb-ide__workspace {
    height: 60%;
    padding: 10px;
  }

  .wb-ide__textarea,
  .wb-ide__highlight {
    font-size: 11px !important;
    padding: 10px !important;
  }

  .wb-ide__line-nums {
    padding: 10px 8px;
    font-size: 11px;
  }
}
</style>
