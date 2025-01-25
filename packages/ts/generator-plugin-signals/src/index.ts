import Plugin from '@vaadin/hilla-generator-core/Plugin.js';
import type { SharedStorage } from '@vaadin/hilla-generator-core/SharedStorage.t.js';
import type { OpenAPIV3 } from 'openapi-types';
import SignalProcessor from './SignalProcessor.js';

// Polyfill for iterator helpers (Stage 3 proposal)
if (!('Iterator' in globalThis)) {
  const { installIntoGlobal } = await import('iterator-helpers-polyfill');
  installIntoGlobal();
}

export type PathSignalType = Readonly<{
  path: string;
  signalType: string;
}>;

const SIGNAL_CLASSES = [
  '#/components/schemas/com.vaadin.hilla.signals.NumberSignal',
  '#/components/schemas/com.vaadin.hilla.signals.ValueSignal',
  '#/components/schemas/com.vaadin.hilla.signals.ListSignal',
];

function extractEndpointMethodsWithSignalsAsReturnType(storage: SharedStorage): PathSignalType[] {
  return Object.entries(storage.api.paths)
    .filter(([_, pathObject]) => {
      const response200 = pathObject?.post?.responses['200'];
      return response200 && !('$ref' in response200);
    })
    .flatMap(([path, pathObject]) => {
      const response200 = pathObject?.post?.responses['200'];
      const responseSchema = (response200 as OpenAPIV3.ResponseObject).content?.['application/json']?.schema;

      return responseSchema && 'anyOf' in responseSchema
        ? responseSchema.anyOf
            ?.filter((c) => '$ref' in c && c.$ref && SIGNAL_CLASSES.includes(c.$ref))
            .map((c: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject) => ({
              path,
              signalType: '$ref' in c ? c.$ref : '',
            }))
        : [];
    })
    .filter((signalArray) => signalArray != null);
}

function groupByService(signals: readonly PathSignalType[]): Map<string, Map<string, string>> {
  return signals.reduce((serviceMap, signal) => {
    const [_, service, method] = signal.path.split('/');
    const serviceMethods = serviceMap.get(service) ?? new Map<string, string>();
    serviceMethods.set(method, signal.signalType);
    serviceMap.set(service, serviceMethods);
    return serviceMap;
  }, new Map<string, Map<string, string>>());
}

export default class SignalsPlugin extends Plugin {
  // eslint-disable-next-line @typescript-eslint/require-await
  override async execute(sharedStorage: SharedStorage): Promise<void> {
    const methodsWithSignals = extractEndpointMethodsWithSignalsAsReturnType(sharedStorage);
    const services = groupByService(methodsWithSignals);
    services.forEach((methods, service) => {
      const index = sharedStorage.sources.findIndex((source) => source.fileName === `${service}.ts`);
      if (index >= 0) {
        sharedStorage.sources[index] = new SignalProcessor(
          service,
          methods,
          sharedStorage.sources[index],
          this,
        ).process();
      }
    });
  }

  declare ['constructor']: typeof SignalsPlugin;

  override get path(): string {
    return import.meta.url;
  }
}
