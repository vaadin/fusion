import Plugin from '@vaadin/hilla-generator-core/Plugin.js';
import type { SharedStorage } from '@vaadin/hilla-generator-core/SharedStorage.t.js';
import type { OpenAPIV3 } from 'openapi-types';
import type { ReadonlyDeep } from 'type-fest';
import type { SourceFile } from 'typescript';
import { EntityModelProcessor } from './EntityModelProcessor.js';
import type { Context } from './utils.js';

export enum ModelPluginSourceType {
  Model = 'model',
}

export default class ModelPlugin extends Plugin {
  static readonly MODEL_PLUGIN_FILE_TAGS = 'MODEL_PLUGIN_FILE_TAGS';
  declare ['constructor']: typeof ModelPlugin;
  readonly #tags = new WeakMap<SourceFile, ModelPluginSourceType>();

  override get path(): string {
    return import.meta.url;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async execute(storage: SharedStorage): Promise<void> {
    const files = this.#processEntities(storage.api.components?.schemas);
    files.forEach((file) => this.#tags.set(file, ModelPluginSourceType.Model));
    storage.sources.push(...files);
    storage.pluginStorage.set(this.constructor.MODEL_PLUGIN_FILE_TAGS, this.#tags);
  }

  #processEntities(schemas: ReadonlyDeep<OpenAPIV3.ComponentsObject>['schemas'] | undefined): readonly SourceFile[] {
    this.logger.debug('Processing entities');

    if (!schemas) {
      return [];
    }

    const ctx: Context = {
      owner: this,
    };

    return Object.entries(schemas).map(([name, component]) => EntityModelProcessor.process(name, component, ctx));
  }
}
