import Plugin from '@vaadin/hilla-generator-core/Plugin.js';
import type { SharedStorage } from '@vaadin/hilla-generator-core/SharedStorage.js';

export default class TestPlugin extends Plugin {
  override get path(): string {
    return import.meta.url;
  }
  override execute(storage: SharedStorage): Promise<void> | void {
    storage.pluginStorage.set('test', 'test');
  }
}
