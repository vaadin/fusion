import Plugin from '@vaadin/hilla-generator-core/Plugin.js';
import type { SharedStorage } from '@vaadin/hilla-generator-core/SharedStorage.t.js';
import type { OpenAPIV3 } from 'openapi-types';
import type { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep';
import { type EndpointOperations, PushProcessor } from './PushProcessor.js';

type ExtendedMediaTypeSchema = Readonly<{ 'x-class-name': string }> &
  ReadonlyObjectDeep<OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>;

const classesToReplace: readonly string[] = [
  'com.vaadin.hilla.runtime.transfertypes.Flux',
  'com.vaadin.hilla.runtime.transfertypes.EndpointSubscription',
];

export default class PushPlugin extends Plugin {
  /**
   * Collects methods that must be patched by checking their `x-class-name` value
   */
  static #collectPatchableMethods(paths: ReadonlyObjectDeep<OpenAPIV3.PathsObject>) {
    return Object.entries(paths).reduce((acc, [key, path]) => {
      const response = path?.post?.responses[200] as ReadonlyObjectDeep<OpenAPIV3.ResponseObject> | undefined;
      const schema = response?.content?.['application/json']?.schema as ExtendedMediaTypeSchema | undefined;
      const className = schema?.['x-class-name'];
      const [, endpoint, method] = key.split('/');

      if (className && classesToReplace.includes(className)) {
        if (acc.has(endpoint)) {
          acc.get(endpoint)!.methodsToPatch.push(method);
        } else {
          acc.set(endpoint, { methodsToPatch: [method], removeInitImport: true });
        }
      } else {
        // Not all methods will be patched, let's keep the init import
        // eslint-disable-next-line no-lonely-if
        if (acc.has(endpoint)) {
          acc.get(endpoint)!.removeInitImport = false;
        } else {
          acc.set(endpoint, { methodsToPatch: [], removeInitImport: false });
        }
      }

      return acc;
    }, new Map<string, EndpointOperations>());
  }

  declare ['constructor']: typeof PushPlugin;

  override get path(): string {
    return import.meta.url;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async execute(storage: SharedStorage): Promise<void> {
    const { api, sources } = storage;
    const endpointMethodMap = this.constructor.#collectPatchableMethods(api.paths);

    for (let i = 0; i < sources.length; i++) {
      const { fileName } = sources[i];
      const endpoint = fileName.substring(0, fileName.indexOf('.ts'));

      if (endpointMethodMap.has(endpoint)) {
        sources[i] = new PushProcessor(sources[i], endpointMethodMap.get(endpoint)!).process();
      }
    }
  }
}
