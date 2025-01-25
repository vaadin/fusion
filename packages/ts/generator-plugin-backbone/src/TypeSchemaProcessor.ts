import {
  type ArraySchema,
  convertFullyQualifiedNameToRelativePath,
  convertReferenceSchemaToFullyQualifiedName,
  convertReferenceSchemaToSpecifier,
  decomposeSchema,
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
import type { TransferTypeMaker } from '@vaadin/hilla-generator-core/SharedStorage.t.js';
import type DependencyManager from '@vaadin/hilla-generator-utils/dependencies/DependencyManager.js';
import ts, { type TypeNode } from 'typescript';
import { findTypeArguments, findTypeVariable } from './utils.js';

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
  readonly #transferTypes: Map<string, TransferTypeMaker>;

  constructor(schema: Schema, dependencies: DependencyManager, transferTypes: Map<string, TransferTypeMaker>) {
    this.#schema = schema;
    this.#dependencies = dependencies;
    this.#transferTypes = transferTypes;
  }

  process(): readonly TypeNode[] {
    let node: TypeNode;

    const unwrappedSchema = unwrapPossiblyNullableSchema(this.#schema);

    const typeVariable = findTypeVariable(this.#schema);
    if (typeVariable) {
      // Type variables are returned directly as they are, no further processing is needed
      return [ts.factory.createTypeReferenceNode(typeVariable)];
    }

    if (isReferenceSchema(unwrappedSchema)) {
      const typeArguments = this.#processTypeArguments(this.#schema);
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
    const nodes = new TypeSchemaProcessor(schema.items, this.#dependencies, this.#transferTypes).process();

    return ts.factory.createTypeReferenceNode('Array', [ts.factory.createUnionTypeNode(nodes)]);
  }

  #processMap({ additionalProperties: valuesType }: MapSchema): TypeNode {
    let valuesTypeNode: TypeNode;

    if (typeof valuesType !== 'boolean') {
      const nodes = new TypeSchemaProcessor(valuesType, this.#dependencies, this.#transferTypes).process();
      valuesTypeNode = ts.factory.createUnionTypeNode(nodes);
    } else {
      valuesTypeNode = ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
    }

    return ts.factory.createTypeReferenceNode('Record', [
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
      valuesTypeNode,
    ]);
  }

  #processTypeArguments(schema: Schema): readonly TypeNode[] | undefined {
    // Type arguments are processed recursively
    return findTypeArguments(schema)
      ?.allOf.map((s) => new TypeSchemaProcessor(s, this.#dependencies, this.#transferTypes).process())
      .map((t) => ts.factory.createUnionTypeNode(t));
  }

  #processReference(schema: ReferenceSchema, typeArguments: readonly TypeNode[] | undefined): TypeNode {
    const { imports, paths } = this.#dependencies;

    const fullyQualifiedName = convertReferenceSchemaToFullyQualifiedName(schema);

    if (this.#transferTypes.has(fullyQualifiedName)) {
      return this.#transferTypes.get(fullyQualifiedName)!(typeArguments);
    }

    const specifier = convertReferenceSchemaToSpecifier(schema);
    const path = paths.createRelativePath(convertFullyQualifiedNameToRelativePath(fullyQualifiedName));

    const identifier = imports.default.getIdentifier(path) ?? imports.default.add(path, specifier, true);

    return ts.factory.createTypeReferenceNode(identifier, typeArguments);
  }
}
