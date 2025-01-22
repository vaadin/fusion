import type LoggerFactory from '@vaadin/hilla-generator-utils/LoggerFactory.js';
import type Plugin from './Plugin.js';
import type { PluginConstructor } from './Plugin.js';
import type ReferenceResolver from './ReferenceResolver.js';
import type { SharedStorage } from './SharedStorage.t.js';

export default class PluginManager {
  readonly #plugins: Plugin[];

  constructor(plugins: readonly PluginConstructor[], resolver: ReferenceResolver, logger: LoggerFactory) {
    const standardPlugins = [
      'TransferTypesPlugin',
      'BackbonePlugin',
      'ClientPlugin',
      'BarrelPlugin',
      'ModelPlugin',
      'PushPlugin',
      'SubTypesPlugin',
      'SignalsPlugin',
    ];
    const customPlugins = plugins.filter((p) => !standardPlugins.includes(p.name));
    if (customPlugins.length > 0) {
      logger.global.info(`Plugins: ${plugins.map(({ name }) => name).join(', ')}`);
    }
    this.#plugins = plugins.map((PluginClass) => new PluginClass(resolver, logger));
  }

  async execute(storage: SharedStorage): Promise<void> {
    // We need to run plugins sequentially
    for (const plugin of this.#plugins) {
      const { name, path } = plugin;
      plugin.logger.debug({ plugin: { name, path } }, `Executing plugin '${plugin.name}'`);
      // eslint-disable-next-line no-await-in-loop
      await plugin.execute(storage);
    }
  }
}
