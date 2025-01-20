import Plugin from '@vaadin/hilla-generator-core/Plugin.js';
import type { SharedStorage } from '@vaadin/hilla-generator-core/SharedStorage.t.js';
import type { OpenAPIV3 } from 'openapi-types';
import type { ReadonlyDeep } from 'type-fest';
import type { SourceFile } from 'typescript';
import EndpointProcessor from './EndpointProcessor.js';
import { EntityProcessor } from './EntityProcessor.js';

export enum BackbonePluginSourceType {
  Endpoint = 'endpoint',
  Entity = 'entity',
}

export default class BackbonePlugin extends Plugin {
  static readonly BACKBONE_PLUGIN_FILE_TAGS = 'BACKBONE_PLUGIN_FILE_TAGS';
  declare ['constructor']: typeof BackbonePlugin;
  readonly #tags = new WeakMap<SourceFile, BackbonePluginSourceType>();

  override get path(): string {
    return import.meta.url;
  }

  override async execute(storage: SharedStorage): Promise<void> {
    const endpointSourceFiles = await this.#processEndpoints(storage);
    const entitySourceFiles = this.#processEntities(storage);

    endpointSourceFiles.forEach((file) => this.#tags.set(file, BackbonePluginSourceType.Endpoint));
    entitySourceFiles.forEach((file) => this.#tags.set(file, BackbonePluginSourceType.Entity));

    storage.sources.push(...endpointSourceFiles, ...entitySourceFiles);
    storage.pluginStorage.set(this.constructor.BACKBONE_PLUGIN_FILE_TAGS, this.#tags);
  }

  async #processEndpoints(storage: SharedStorage): Promise<readonly SourceFile[]> {
    this.logger.debug('Processing endpoints');
    const endpoints = new Map<string, Map<string, ReadonlyDeep<OpenAPIV3.PathItemObject>>>();

    Object.entries(storage.api.paths)
      .filter(([, pathItem]) => !!pathItem)
      .forEach(([path, pathItem]) => {
        const [, endpointName, endpointMethodName] = path.split('/');

        let methods: Map<string, ReadonlyDeep<OpenAPIV3.PathItemObject>>;

        if (endpoints.has(endpointName)) {
          methods = endpoints.get(endpointName)!;
        } else {
          methods = new Map();
          endpoints.set(endpointName, methods);
        }

        methods.set(endpointMethodName, pathItem!);
      });

    const processors = await Promise.all(
      Array.from(endpoints.entries(), async ([endpointName, methods]) =>
        EndpointProcessor.create(endpointName, methods, storage, this),
      ),
    );

    return Promise.all(processors.map(async (processor) => processor.process()));
  }

  #processEntities(storage: SharedStorage): readonly SourceFile[] {
    this.logger.debug('Processing entities');

    return storage.api.components?.schemas
      ? Object.entries(storage.api.components.schemas).map(([name, component]) =>
          new EntityProcessor(name, component, storage, this).process(),
        )
      : [];
  }
}
