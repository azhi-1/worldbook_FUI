import { createScriptIdDiv, teleportStyle } from '@util/script';
import App from './App.vue';
import './style.scss';

function init() {
  const $originalList = $('#world_popup_entries_list');
  $originalList.hide();

  const $app = createScriptIdDiv().attr('id', 'topo-wb-app').addClass('topo-wb').insertAfter($originalList);

  const app = createApp(App);
  app.mount($app[0]);

  const { destroy } = teleportStyle();

  $(window).on('pagehide', () => {
    app.unmount();
    $app.remove();
    destroy();
    $originalList.show();
  });
}

$(() => {
  errorCatched(init)();
});
