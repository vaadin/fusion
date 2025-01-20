import type { OpenAPIV3 } from 'openapi-types';
import type { ReadonlyDeep, Simplify } from 'type-fest';

export type Nullified<T, K extends keyof T> = T & { [P in K]: undefined };

export type ReferenceSchema = ReadonlyDeep<OpenAPIV3.ReferenceObject>;
export type ArraySchema = ReadonlyDeep<OpenAPIV3.ArraySchemaObject>;
export type NonArraySchema = ReadonlyDeep<OpenAPIV3.NonArraySchemaObject>;
export type RegularSchema = ArraySchema | NonArraySchema;

export type NullableSchema = Readonly<Required<Pick<RegularSchema, 'nullable'>>> & RegularSchema;

export type AnyOfRuleComposedSchema = Readonly<Required<Pick<RegularSchema, 'anyOf'>>> & RegularSchema;
export type AllOfRuleComposedSchema = Readonly<Required<Pick<RegularSchema, 'allOf'>>> & RegularSchema;
export type OneOfRuleComposedSchema = Readonly<Required<Pick<RegularSchema, 'oneOf'>>> & RegularSchema;
export type NotRuleComposedSchema = Readonly<Required<Pick<RegularSchema, 'not'>>> & RegularSchema;
export type ComposedSchema =
  | AllOfRuleComposedSchema
  | AnyOfRuleComposedSchema
  | NotRuleComposedSchema
  | OneOfRuleComposedSchema;

export type NonComposedRegularSchema = Readonly<Nullified<RegularSchema, 'allOf' | 'anyOf' | 'oneOf'>> & RegularSchema;
export type NonComposedSchema = Simplify<NonComposedRegularSchema | ReferenceSchema>;

export type BooleanSchema = NonComposedRegularSchema & Readonly<{ type: 'boolean' }>;
export type IntegerSchema = NonComposedRegularSchema & Readonly<{ type: 'integer' }>;
export type NumberSchema = NonComposedRegularSchema & Readonly<{ type: 'number' }>;
export type ObjectSchema = NonComposedRegularSchema & Readonly<{ type: 'object' }>;
export type StringSchema = NonComposedRegularSchema & Readonly<{ type: 'string' }>;

export type EnumSchema = Readonly<Required<Pick<StringSchema, 'enum'>>> & StringSchema;
export type EmptyObjectSchema = ObjectSchema & Readonly<Nullified<ObjectSchema, 'properties'>>;
export type NonEmptyObjectSchema = ObjectSchema & Readonly<Required<Pick<ObjectSchema, 'properties'>>>;
export type MapSchema = EmptyObjectSchema & Readonly<Required<Pick<ObjectSchema, 'additionalProperties'>>>;

export type Schema = ReferenceSchema | RegularSchema;

export function isReferenceSchema(schema: Schema): schema is ReferenceSchema {
  return '$ref' in schema;
}

export function isAnyOfRuleComposedSchema(schema: Schema): schema is AnyOfRuleComposedSchema {
  return 'anyOf' in schema;
}

export function isAllOfRuleComposedSchema(schema: Schema): schema is AllOfRuleComposedSchema {
  return 'allOf' in schema;
}

export function isOneOfRuleComposedSchema(schema: Schema): schema is OneOfRuleComposedSchema {
  return 'oneOf' in schema;
}

export function isNotRuleComposedSchema(schema: Schema): schema is NotRuleComposedSchema {
  return 'not' in schema;
}

export function isComposedSchema(schema: Schema): schema is ComposedSchema {
  return (
    isAnyOfRuleComposedSchema(schema) ||
    isAllOfRuleComposedSchema(schema) ||
    isOneOfRuleComposedSchema(schema) ||
    isNotRuleComposedSchema(schema)
  );
}

export function isNonComposedSchema(schema: Schema): schema is NonComposedSchema {
  return !isComposedSchema(schema);
}

export function isNonComposedRegularSchema(schema: Schema): schema is NonComposedRegularSchema {
  return isNonComposedSchema(schema) && !isReferenceSchema(schema);
}

export function isNullableSchema(schema: Schema): schema is NullableSchema {
  return !isReferenceSchema(schema) && !!schema.nullable;
}

export function decomposeSchema(schema: ComposedSchema): readonly Schema[] {
  if (isAnyOfRuleComposedSchema(schema)) {
    return schema.anyOf;
  }

  if (isAllOfRuleComposedSchema(schema)) {
    return schema.allOf;
  }

  if (isOneOfRuleComposedSchema(schema)) {
    return schema.oneOf;
  }

  return [schema.not];
}

export function isArraySchema(schema: Schema): schema is ArraySchema {
  return isNonComposedRegularSchema(schema) && schema.type === 'array';
}

export function isBooleanSchema(schema: Schema): schema is BooleanSchema {
  return isNonComposedRegularSchema(schema) && schema.type === 'boolean';
}

export function isIntegerSchema(schema: Schema): schema is IntegerSchema {
  return isNonComposedRegularSchema(schema) && schema.type === 'integer';
}

export function isNumberSchema(schema: Schema): schema is NumberSchema {
  return isNonComposedRegularSchema(schema) && schema.type === 'number';
}

export function isObjectSchema(schema: Schema): schema is ObjectSchema {
  return isNonComposedRegularSchema(schema) && schema.type === 'object';
}

export function isStringSchema(schema: Schema): schema is StringSchema {
  return isNonComposedRegularSchema(schema) && schema.type === 'string';
}

export function isEnumSchema(schema: Schema): schema is EnumSchema {
  return isStringSchema(schema) && !!schema.enum;
}

export function isEmptyObject(schema: Schema): schema is EmptyObjectSchema {
  return isObjectSchema(schema) && !schema.properties;
}

export function isMapSchema(schema: Schema): schema is MapSchema {
  return isEmptyObject(schema) && !!schema.additionalProperties;
}

export function simplifyFullyQualifiedName(name: string): string {
  return name.substring(name.lastIndexOf(name.includes('$') ? '$' : '.') + 1, name.length);
}

export function convertReferenceSchemaToSpecifier({ $ref }: ReferenceSchema): string {
  return simplifyFullyQualifiedName($ref);
}

const COMPONENTS_SCHEMAS_REF_LENGTH = '#/components/schemas/'.length;

export function convertReferenceSchemaToFullyQualifiedName({ $ref }: ReferenceSchema): string {
  return $ref.substring(COMPONENTS_SCHEMAS_REF_LENGTH);
}

export function convertFullyQualifiedNameToRelativePath(name: string): string {
  return name.replace(/[$.]/gu, '/');
}

export function convertReferenceSchemaToPath(schema: ReferenceSchema): string {
  return convertFullyQualifiedNameToRelativePath(convertReferenceSchemaToFullyQualifiedName(schema));
}

export function resolveReference(
  schemas: ReadonlyDeep<OpenAPIV3.ComponentsObject>['schemas'],
  { $ref }: ReferenceSchema,
): Schema | undefined {
  if (schemas) {
    for (const [name, schema] of Object.entries(schemas)) {
      if ($ref.includes(name)) {
        return schema;
      }
    }
  }

  return undefined;
}
