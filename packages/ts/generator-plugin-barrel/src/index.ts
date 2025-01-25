import Plugin from '@vaadin/hilla-generator-core/Plugin.js';
import type { SharedStorage } from '@vaadin/hilla-generator-core/SharedStorage.t.js';
import BackbonePlugin, { BackbonePluginSourceType } from '@vaadin/hilla-generator-plugin-backbone';
import PluginError from '@vaadin/hilla-generator-utils/PluginError.js';
import type { SourceFile } from 'typescript';
import BarrelProcessor from './BarrelProcessor.js';

export default class BarrelPlugin extends Plugin {
  override get path(): string {
    return import.meta.url;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async execute({ pluginStorage, sources }: SharedStorage): Promise<void> {
    const tags = pluginStorage.get(BackbonePlugin.BACKBONE_PLUGIN_FILE_TAGS) as WeakMap<SourceFile, string> | undefined;

    if (!tags) {
      throw new PluginError(`${BackbonePlugin.name} should be run first.`, this.constructor.name);
    }

    const endpoints = sources.filter((file) => tags.get(file) === BackbonePluginSourceType.Endpoint);
    const barrelFile = new BarrelProcessor(endpoints, this).process();
    sources.push(barrelFile);
  }
}
