import {
  type ArraySchema,
  convertReferenceSchemaToPath,
  convertReferenceSchemaToSpecifier,
  decomposeSchema,
  findTypeArgument,
  findTypeParameters,
  isArraySchema,
  isBooleanSchema,
  isComposedSchema,
  isIntegerSchema,
  isMapSchema,
  isNullableSchema,
  isNumberSchema,
  isReferenceSchema,
  isStringSchema,
  type MapSchema,
  type NonComposedSchema,
  type ReferenceSchema,
  type Schema,
} from '@vaadin/hilla-generator-core/Schema.js';
import type DependencyManager from '@vaadin/hilla-generator-utils/dependencies/DependencyManager.js';
import ts, { type TypeNode } from 'typescript';

function createBoolean(): TypeNode {
  return ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
}

function createNumber(): TypeNode {
  return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
}

function createString(): TypeNode {
  return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
}

function createUndefined(): TypeNode {
  return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword);
}

function createUnknown(): TypeNode {
  return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
}

function unwrapPossiblyNullableSchema(schema: Schema): NonComposedSchema {
  if (isComposedSchema(schema)) {
    const [result] = decomposeSchema(schema);

    return result as NonComposedSchema;
  }

  return schema as NonComposedSchema;
}

export default class TypeSchemaProcessor {
  declare ['constructor']: typeof TypeSchemaProcessor;
  readonly #dependencies: DependencyManager;
  readonly #schema: Schema;

  constructor(schema: Schema, dependencies: DependencyManager) {
    this.#schema = schema;
    this.#dependencies = dependencies;
  }

  process(): readonly TypeNode[] {
    let node: TypeNode;

    const unwrappedSchema = unwrapPossiblyNullableSchema(this.#schema);

    const typeArg = TypeSchemaProcessor.#processTypeArgument(this.#schema);
    if (typeArg) {
      return [typeArg];
    }

    if (isReferenceSchema(unwrappedSchema)) {
      const typeArguments = TypeSchemaProcessor.#processTypeParameters(this.#schema);
      node = this.#processReference(unwrappedSchema, typeArguments);
    } else if (isArraySchema(unwrappedSchema)) {
      node = this.#processArray(unwrappedSchema);
    } else if (isMapSchema(unwrappedSchema)) {
      node = this.#processMap(unwrappedSchema);
    } else if (isBooleanSchema(unwrappedSchema)) {
      node = createBoolean();
    } else if (isIntegerSchema(unwrappedSchema) || isNumberSchema(unwrappedSchema)) {
      node = createNumber();
    } else if (isStringSchema(unwrappedSchema)) {
      node = createString();
    } else {
      node = createUnknown();
    }

    return isNullableSchema(this.#schema) ? [node, createUndefined()] : [node];
  }

  #processArray(schema: ArraySchema): TypeNode {
    const nodes = new TypeSchemaProcessor(schema.items, this.#dependencies).process();

    return ts.factory.createTypeReferenceNode('Array', [ts.factory.createUnionTypeNode(nodes)]);
  }

  #processMap({ additionalProperties: valuesType }: MapSchema): TypeNode {
    let valuesTypeNode: TypeNode;

    if (typeof valuesType !== 'boolean') {
      const nodes = new TypeSchemaProcessor(valuesType, this.#dependencies).process();
      valuesTypeNode = ts.factory.createUnionTypeNode(nodes);
    } else {
      valuesTypeNode = ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
    }

    return ts.factory.createTypeReferenceNode('Record', [
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
      valuesTypeNode,
    ]);
  }

  static #processTypeParameters(schema: Schema): readonly ts.TypeReferenceNode[] | undefined {
    return findTypeParameters(schema)?.map((tp) => ts.factory.createTypeReferenceNode(tp));
  }

  static #processTypeArgument(schema: Schema): ts.TypeReferenceNode | undefined {
    const ref = findTypeArgument(schema);
    return ref ? ts.factory.createTypeReferenceNode(ref) : undefined;
  }

  #processReference(schema: ReferenceSchema, typeArguments: readonly ts.TypeReferenceNode[] | undefined): TypeNode {
    const { imports, paths } = this.#dependencies;

    const specifier = convertReferenceSchemaToSpecifier(schema);
    const path = paths.createRelativePath(convertReferenceSchemaToPath(schema));

    const identifier = imports.default.getIdentifier(path) ?? imports.default.add(path, specifier, true);

    return ts.factory.createTypeReferenceNode(identifier, typeArguments);
  }
}
