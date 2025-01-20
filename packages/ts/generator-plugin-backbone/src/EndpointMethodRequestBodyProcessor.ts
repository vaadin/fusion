import type Plugin from '@vaadin/hilla-generator-core/Plugin.js';
import {
  isEmptyObject,
  isObjectSchema,
  type NonEmptyObjectSchema,
  type Schema,
} from '@vaadin/hilla-generator-core/Schema.js';
import type { TransferTypes } from '@vaadin/hilla-generator-core/SharedStorage.t.js';
import type DependencyManager from '@vaadin/hilla-generator-utils/dependencies/DependencyManager.js';
import type { OpenAPIV3 } from 'openapi-types';
import type { ReadonlyDeep } from 'type-fest';
import ts, { type Identifier, type ObjectLiteralExpression, type ParameterDeclaration } from 'typescript';
import TypeSchemaProcessor from './TypeSchemaProcessor.js';
import { defaultMediaType } from './utils.js';

export type EndpointMethodRequestBody = ReadonlyDeep<OpenAPIV3.RequestBodyObject>;

export type EndpointMethodRequestBodyProcessingResult = Readonly<{
  parameters: readonly ParameterDeclaration[];
  packedParameters?: ObjectLiteralExpression;
  initParam: Identifier;
}>;

const DEFAULT_INIT_PARAM_NAME = 'init';
const INIT_TYPE_NAME = 'EndpointRequestInit';
const HILLA_FRONTEND_NAME = '@vaadin/hilla-frontend';

export default class EndpointMethodRequestBodyProcessor {
  readonly #dependencies: DependencyManager;
  readonly #transferTypes: TransferTypes;
  readonly #owner: Plugin;
  readonly #requestBody?: EndpointMethodRequestBody;

  constructor(
    requestBody: ReadonlyDeep<OpenAPIV3.ReferenceObject | OpenAPIV3.RequestBodyObject> | undefined,
    dependencies: DependencyManager,
    transferTypes: TransferTypes,
    owner: Plugin,
  ) {
    this.#owner = owner;
    this.#dependencies = dependencies;
    this.#requestBody = requestBody ? owner.resolver.resolve(requestBody) : undefined;
    this.#transferTypes = transferTypes;
  }

  process(): EndpointMethodRequestBodyProcessingResult {
    const { imports, paths } = this.#dependencies;
    const path = paths.createBareModulePath(HILLA_FRONTEND_NAME);
    const initTypeIdentifier =
      imports.named.getIdentifier(path, INIT_TYPE_NAME) ?? imports.named.add(path, INIT_TYPE_NAME);

    if (!this.#requestBody) {
      return {
        initParam: ts.factory.createIdentifier(DEFAULT_INIT_PARAM_NAME),
        packedParameters: ts.factory.createObjectLiteralExpression(),
        parameters: [
          ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            DEFAULT_INIT_PARAM_NAME,
            ts.factory.createToken(ts.SyntaxKind.QuestionToken),
            ts.factory.createTypeReferenceNode(initTypeIdentifier),
          ),
        ],
      };
    }

    const parameterData = this.#extractParameterData(this.#requestBody.content[defaultMediaType].schema);
    const parameterNames = parameterData.map(([name]) => name);
    let initParamName = DEFAULT_INIT_PARAM_NAME;

    while (parameterNames.includes(initParamName)) {
      initParamName = `_${initParamName}`;
    }

    return {
      initParam: ts.factory.createIdentifier(initParamName),
      packedParameters: ts.factory.createObjectLiteralExpression(
        parameterData.map(([name]) => ts.factory.createShorthandPropertyAssignment(name)),
      ),
      parameters: [
        ...parameterData.map(([name, schema]) => {
          const nodes = new TypeSchemaProcessor(schema, this.#dependencies, this.#transferTypes).process();

          return ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            name,
            undefined,
            ts.factory.createUnionTypeNode(nodes),
          );
        }),
        ts.factory.createParameterDeclaration(
          undefined,
          undefined,
          initParamName,
          ts.factory.createToken(ts.SyntaxKind.QuestionToken),
          ts.factory.createTypeReferenceNode(initTypeIdentifier),
        ),
      ],
    };
  }

  #extractParameterData(
    basicSchema?: ReadonlyDeep<OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>,
  ): Array<readonly [string, Schema]> {
    if (!basicSchema) {
      return [];
    }

    const { logger, resolver } = this.#owner;

    const resolvedSchema = resolver.resolve(basicSchema);

    if (isObjectSchema(resolvedSchema) && !isEmptyObject(resolvedSchema)) {
      return Object.entries((resolvedSchema as NonEmptyObjectSchema).properties);
    }

    logger.warn("A schema provided for endpoint method's 'requestBody' is not supported");
    return [];
  }
}
