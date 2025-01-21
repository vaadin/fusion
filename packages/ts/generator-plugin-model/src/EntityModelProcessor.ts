/* eslint-disable symbol-description */
import { dirname } from 'path/posix';
import {
  convertFullyQualifiedNameToRelativePath,
  convertReferenceSchemaToPath,
  convertReferenceSchemaToSpecifier,
  decomposeSchema,
  isComposedSchema,
  isEnumSchema,
  isObjectSchema,
  isReferenceSchema,
  type ObjectSchema,
  type ReferenceSchema,
  type Schema,
  simplifyFullyQualifiedName,
} from '@vaadin/hilla-generator-core/Schema.js';
import createSourceFile from '@vaadin/hilla-generator-utils/createSourceFile.js';
import DependencyManager from '@vaadin/hilla-generator-utils/dependencies/DependencyManager.js';
import PathManager from '@vaadin/hilla-generator-utils/dependencies/PathManager.js';
import ts, {
  type ClassDeclaration,
  type ClassElement,
  type Identifier,
  type SourceFile,
  type Statement,
} from 'typescript';
import { ModelSchemaExpressionProcessor, ModelSchemaTypeProcessor } from './ModelSchemaProcessor.js';
import { type Context, createEmptyValueMaker, createModelBuildingCallback, importBuiltInFormModel } from './utils.js';

export type DependencyData = Readonly<{
  id: Identifier;
  path: string;
}>;

const $dependencies = Symbol();
const $entity = Symbol();
const $fullyQualifiedName = Symbol();
const $model = Symbol();
const $processDeclaration = Symbol();

export abstract class EntityModelProcessor {
  static process(name: string, component: Schema, context: Context): SourceFile {
    context.owner.logger.debug(`Processing model for entity: ${name}`);

    const schema = isComposedSchema(component) ? decomposeSchema(component)[0] : component;

    return isEnumSchema(schema)
      ? // eslint-disable-next-line @typescript-eslint/no-use-before-define
        new EntityEnumModelProcessor(name).process() // eslint-disable-line no-use-before-define
      : // eslint-disable-next-line @typescript-eslint/no-use-before-define
        new EntityClassModelProcessor(name, component, context).process(); // eslint-disable-line no-use-before-define
  }

  protected readonly [$dependencies]: DependencyManager;
  protected readonly [$entity]: DependencyData;
  protected readonly [$fullyQualifiedName]: string;
  protected readonly [$model]: DependencyData;
  readonly #outputPathManager = new PathManager({ extension: 'ts' });

  protected constructor(name: string, shouldImportEntityAsType: boolean) {
    this[$fullyQualifiedName] = name;

    const entityName = simplifyFullyQualifiedName(name);
    const entityPath = convertFullyQualifiedNameToRelativePath(name);

    const modelName = `${entityName}Model`;
    const modelPath = `${entityPath}Model`;
    this[$dependencies] = new DependencyManager(new PathManager({ extension: '.js', relativeTo: dirname(modelPath) }));

    const { exports, imports, paths } = this[$dependencies];

    this[$model] = {
      id: exports.default.set(modelName),
      path: modelPath,
    };

    this[$entity] = {
      id: imports.default.add(paths.createRelativePath(entityPath), entityName, shouldImportEntityAsType),
      path: entityPath,
    };
  }

  process(): SourceFile {
    const declaration = this[$processDeclaration]();

    const { exports, imports } = this[$dependencies];
    const importStatements = imports.toCode();
    const exportStatement = exports.toCode();

    return createSourceFile(
      [...importStatements, declaration, ...exportStatement].filter(Boolean) as readonly Statement[],
      this.#outputPathManager.createRelativePath(this[$model].path),
    );
  }

  protected abstract [$processDeclaration](): ClassDeclaration | undefined;
}

export class EntityClassModelProcessor extends EntityModelProcessor {
  readonly #component: Schema;
  readonly #context: Context;
  readonly #fullyQualifiedName: string;
  readonly #getPropertyModelSymbol: Identifier;
  readonly #makeObjectEmptyValueCreator: Identifier;

  constructor(name: string, component: Schema, context: Context) {
    super(name, true);

    this.#component = component;
    this.#context = context;
    this.#fullyQualifiedName = name;

    this.#getPropertyModelSymbol = this[$dependencies].imports.named.add('@vaadin/hilla-lit-form', '_getPropertyModel');
    this.#makeObjectEmptyValueCreator = this[$dependencies].imports.named.add(
      '@vaadin/hilla-lit-form',
      'makeObjectEmptyValueCreator',
    );
  }

  protected [$processDeclaration](): ClassDeclaration | undefined {
    const { logger } = this.#context.owner;

    let entitySchema = this.#component;
    let parent;

    if (isComposedSchema(this.#component)) {
      const decomposed = decomposeSchema(this.#component);

      if (decomposed.length > 2) {
        logger.debug(
          this.#component,
          `The schema for a class component ${this.#fullyQualifiedName} has more than two components. This plugin will ignore it.`,
        );
        return undefined;
      }

      const [parentSchema, childSchema] = decomposed;

      if (!isReferenceSchema(parentSchema)) {
        logger.debug(parentSchema, 'Only reference schema allowed for parent class');
        return undefined;
      }

      entitySchema = childSchema;
      parent = this.#processParentClass(parentSchema);
    } else {
      parent = importBuiltInFormModel('ObjectModel', this[$dependencies]);
    }

    return this.#processModelClass(entitySchema, this[$entity].id, parent);
  }

  #processClassElements({ properties }: ObjectSchema): readonly ClassElement[] {
    if (!properties) {
      return [];
    }

    return Object.entries(properties).map(([name, schema]) => {
      const type = new ModelSchemaTypeProcessor(schema, this[$dependencies]).process();
      const args = new ModelSchemaExpressionProcessor(schema, this[$dependencies]).process();

      return ts.factory.createGetAccessorDeclaration(
        undefined,
        ts.factory.createIdentifier(name),
        [],
        type,
        ts.factory.createBlock(
          [
            ts.factory.createReturnStatement(
              ts.factory.createCallExpression(
                ts.factory.createElementAccessExpression(ts.factory.createThis(), this.#getPropertyModelSymbol),
                undefined,
                [ts.factory.createStringLiteral(name), createModelBuildingCallback(type.typeName as Identifier, args)],
              ),
            ),
          ],
          true,
        ),
      );
    });
  }

  #processModelClass(schema: Schema, entity: Identifier, parent: Identifier): ClassDeclaration | undefined {
    const { logger } = this.#context.owner;

    if (!isObjectSchema(schema)) {
      logger.debug(schema, `Component is not an object: ${this.#fullyQualifiedName}`);
      return undefined;
    }

    const typeT = ts.factory.createIdentifier('T');
    const modelTypeParameters = ts.factory.createTypeParameterDeclaration(
      undefined,
      typeT,
      ts.factory.createTypeReferenceNode(entity),
      ts.factory.createTypeReferenceNode(entity),
    );

    return ts.factory.createClassDeclaration(
      undefined,
      this[$model].id,
      [modelTypeParameters],
      [
        ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
          ts.factory.createExpressionWithTypeArguments(parent, [ts.factory.createTypeReferenceNode(typeT)]),
        ]),
      ],
      [
        createEmptyValueMaker(this.#makeObjectEmptyValueCreator, this[$model].id),
        ...this.#processClassElements(schema),
      ],
    );
  }

  #processParentClass(schema: ReferenceSchema): Identifier {
    const { imports, paths } = this[$dependencies];

    const specifier = convertReferenceSchemaToSpecifier(schema);
    const path = convertReferenceSchemaToPath(schema);
    const modelPath = paths.createRelativePath(`${path}Model`);
    const modelSpecifier = `${specifier}Model`;

    return imports.default.add(modelPath, modelSpecifier, false);
  }
}

export class EntityEnumModelProcessor extends EntityModelProcessor {
  constructor(name: string) {
    super(name, false);
  }

  protected [$processDeclaration](): ClassDeclaration {
    const enumModel = importBuiltInFormModel('EnumModel', this[$dependencies]);
    const enumPropertySymbol = this[$dependencies].imports.named.add('@vaadin/hilla-lit-form', '_enum');
    const makeEnumEmptyValueCreator = this[$dependencies].imports.named.add(
      '@vaadin/hilla-lit-form',
      'makeEnumEmptyValueCreator',
    );

    return ts.factory.createClassDeclaration(
      undefined,
      this[$model].id,
      undefined,
      [
        ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
          ts.factory.createExpressionWithTypeArguments(enumModel, [
            ts.factory.createTypeQueryNode(this[$entity].id, undefined),
          ]),
        ]),
      ],
      [
        createEmptyValueMaker(makeEnumEmptyValueCreator, this[$model].id),
        ts.factory.createPropertyDeclaration(
          [ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
          ts.factory.createComputedPropertyName(enumPropertySymbol),
          undefined,
          undefined,
          this[$entity].id,
        ),
      ],
    );
  }
}
