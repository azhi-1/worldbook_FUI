import { createScriptIdDiv, teleportStyle } from '@util/script';
import App from './App.vue';
import './style.scss';

const FORCE_CUSTOM_SORT_SCRIPT_ID = 'topo-wb-force-custom-sort';
const FORCE_CUSTOM_SORT_SCRIPT_SRC = 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/酒馆助手/世界书强制自定义排序/index.js';

function loadForceCustomSortScript() {
  if (document.getElementById(FORCE_CUSTOM_SORT_SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = FORCE_CUSTOM_SORT_SCRIPT_ID;
  script.type = 'module';
  script.textContent = `import '${FORCE_CUSTOM_SORT_SCRIPT_SRC}';`;
  script.addEventListener('error', err => {
    console.error('[世界书美化] force custom sort script failed:', err);
  });

  document.head.append(script);
}

function init() {
  $('#topo-wb-shell').remove();

  const $originalList = $('#world_popup_entries_list');
  if ($originalList.length === 0) {
    throw Error('[世界书美化] #world_popup_entries_list not found');
  }

  const $app = createScriptIdDiv()
    .attr('id', 'topo-wb-shell')
    .insertAfter($originalList);

  const app = createApp(App);
  app.mount($app[0]);

  const { destroy } = teleportStyle();
  loadForceCustomSortScript();

  console.info('[世界书美化] mounted');

  $(window).on('pagehide', () => {
    app.unmount();
    $app.remove();
    $(`#${FORCE_CUSTOM_SORT_SCRIPT_ID}`).remove();
    destroy();
    console.info('[世界书美化] unmounted');
  });
}

$(() => {
  errorCatched(init)();
});
