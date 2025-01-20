import {
  isAnyOfRuleComposedSchema,
  type AllOfRuleComposedSchema,
  type Schema,
} from '@vaadin/hilla-generator-core/Schema.js';
import type DependencyManager from '@vaadin/hilla-generator-utils/dependencies/DependencyManager.js';
import type { NamedImportManager } from '@vaadin/hilla-generator-utils/dependencies/ImportManager.js';
import type { Identifier } from 'typescript';

export const defaultMediaType = 'application/json';

export type SchemaWithTypeArguments = Readonly<{ 'x-type-arguments': AllOfRuleComposedSchema }> & Schema;
export type SchemaWithTypeParameters = Readonly<{ 'x-type-parameters': Schema[] }> & Schema;
export type SchemaWithTypeVariable = Readonly<{ 'x-type-variable': string }> & Schema;

export function isSchemaWithTypeArguments(schema: Schema): schema is SchemaWithTypeArguments {
  return 'x-type-arguments' in schema;
}

export function isSchemaWithTypeParameters(schema: Schema): schema is SchemaWithTypeParameters {
  return 'x-type-parameters' in schema;
}

export function isSchemaWithTypeVariable(schema: Schema): schema is SchemaWithTypeVariable {
  return 'x-type-variable' in schema;
}

export function findTypeArguments(schema: Schema): AllOfRuleComposedSchema | undefined {
  if (isSchemaWithTypeArguments(schema)) {
    return schema['x-type-arguments'];
  }

  // Type arguments are defined as part of anyOf schemas
  if (isAnyOfRuleComposedSchema(schema)) {
    return schema.anyOf.find(isSchemaWithTypeArguments)?.['x-type-arguments'];
  }

  return undefined;
}

export function findTypeParameters(schema: Schema): readonly Schema[] | undefined {
  if (isSchemaWithTypeParameters(schema)) {
    return schema['x-type-parameters'];
  }

  return undefined;
}

export function findTypeVariable(schema: Schema): string | undefined {
  if (isSchemaWithTypeVariable(schema)) {
    return schema['x-type-variable'];
  }

  return undefined;
}
