import Plugin from '@vaadin/hilla-generator-core/Plugin.js';
import type { ReferenceSchema } from '@vaadin/hilla-generator-core/Schema.js';
import { convertFullyQualifiedNameToRelativePath } from '@vaadin/hilla-generator-core/Schema.js';
import type { SharedStorage } from '@vaadin/hilla-generator-core/SharedStorage.t.js';
import { ModelFixProcessor } from './ModelFixProcessor.js';
import { SubTypesProcessor } from './SubTypesProcessor.js';
import { TypeFixProcessor } from './TypeFixProcessor.js';

export default class SubTypesPlugin extends Plugin {
  declare ['constructor']: typeof SubTypesPlugin;

  override get path(): string {
    return import.meta.url;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async execute(storage: SharedStorage): Promise<void> {
    const { api, sources } = storage;

    const components = api.components?.schemas;

    if (!components) {
      return;
    }

    Object.entries(components).forEach(([baseKey, baseComponent]) => {
      // search for components with oneOf: those are union types
      if ('oneOf' in baseComponent && Array.isArray(baseComponent.oneOf)) {
        const fn = `${convertFullyQualifiedNameToRelativePath(baseKey)}.ts`;
        const source = sources.find(({ fileName }) => fileName === fn)!;
        // replace the (empty) source with a newly-generated one
        const newSource = new SubTypesProcessor(baseKey, source, baseComponent.oneOf).process();
        sources.splice(sources.indexOf(source), 1, newSource);

        // mentioned types in the oneOf need to be fixed as well
        baseComponent.oneOf.forEach((schema) => {
          if ('$ref' in schema) {
            const path = (schema as ReferenceSchema).$ref;
            Object.entries(components).forEach(([subKey, subComponent]) => {
              if ('anyOf' in subComponent && subKey === path.substring('#/components/schemas/'.length)) {
                subComponent.anyOf?.forEach((s) => {
                  if ('properties' in s && '@type' in s.properties! && 'example' in s.properties['@type']) {
                    const typeValue = s.properties['@type'].example as string;
                    const subFn = `${convertFullyQualifiedNameToRelativePath(subKey)}.ts`;
                    const subSource = sources.find(({ fileName }) => fileName === subFn)!;
                    // fix the source to replace the @type property name with a quoted string
                    const fixedSource = new TypeFixProcessor(subSource, typeValue).process();
                    sources.splice(sources.indexOf(subSource), 1, fixedSource);

                    // fix the model to remove the @type property
                    const modelFn = `${convertFullyQualifiedNameToRelativePath(subKey)}Model.ts`;
                    const modelSource = sources.find(({ fileName }) => fileName === modelFn)!;
                    const fixedModelSource = new ModelFixProcessor(modelSource).process();
                    sources.splice(sources.indexOf(modelSource), 1, fixedModelSource);
                  }
                });
              }
            });
          }
        });

        // remove the union type model file
        const unionFn = `${convertFullyQualifiedNameToRelativePath(baseKey)}Model.ts`;
        const unionSource = sources.find(({ fileName }) => fileName === unionFn)!;
        sources.splice(sources.indexOf(unionSource), 1);
      }
    });
  }
}
