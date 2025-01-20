/* eslint-disable max-params */
import type Plugin from '@vaadin/hilla-generator-core/Plugin.js';
import type { TransferTypes } from '@vaadin/hilla-generator-core/SharedStorage.t.js';
import ClientPlugin from '@vaadin/hilla-generator-plugin-client';
import type DependencyManager from '@vaadin/hilla-generator-utils/dependencies/DependencyManager.js';
import equal from 'fast-deep-equal';
import { OpenAPIV3 } from 'openapi-types';
import type { ReadonlyDeep } from 'type-fest';
import ts, { type Expression, type Statement, type TypeNode } from 'typescript';
import EndpointMethodRequestBodyProcessor from './EndpointMethodRequestBodyProcessor.js';
import EndpointMethodResponseProcessor from './EndpointMethodResponseProcessor.js';

export type EndpointMethodOperation = ReadonlyDeep<OpenAPIV3.OperationObject>;

export default abstract class EndpointMethodOperationProcessor {
  static createProcessor(
    httpMethod: OpenAPIV3.HttpMethods,
    endpointName: string,
    endpointMethodName: string,
    operation: EndpointMethodOperation,
    dependencies: DependencyManager,
    transferTypes: TransferTypes,
    owner: Plugin,
  ): EndpointMethodOperationProcessor | undefined {
    switch (httpMethod) {
      case OpenAPIV3.HttpMethods.POST:
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return new EndpointMethodOperationPOSTProcessor(
          endpointName,
          endpointMethodName,
          operation,
          dependencies,
          transferTypes,
          owner,
        );
      default:
        owner.logger.warn(`Processing ${httpMethod.toUpperCase()} currently is not supported`);
        return undefined;
    }
  }

  abstract process(outputDir?: string): Promise<Statement | undefined>;
}

class EndpointMethodOperationPOSTProcessor extends EndpointMethodOperationProcessor {
  readonly #dependencies: DependencyManager;
  readonly #transferTypes: TransferTypes;
  readonly #endpointMethodName: string;
  readonly #endpointName: string;
  readonly #operation: EndpointMethodOperation;
  readonly #owner: Plugin;

  constructor(
    endpointName: string,
    endpointMethodName: string,
    operation: EndpointMethodOperation,
    dependencies: DependencyManager,
    transferTypes: TransferTypes,
    owner: Plugin,
  ) {
    super();
    this.#owner = owner;
    this.#dependencies = dependencies;
    this.#endpointName = endpointName;
    this.#endpointMethodName = endpointMethodName;
    this.#operation = operation;
    this.#transferTypes = transferTypes;
  }

  async process(outputDir?: string): Promise<Statement | undefined> {
    const { exports, imports, paths } = this.#dependencies;
    this.#owner.logger.debug(`${this.#endpointName}.${this.#endpointMethodName} - processing POST method`);

    const { initParam, packedParameters, parameters } = new EndpointMethodRequestBodyProcessor(
      this.#operation.requestBody,
      this.#dependencies,
      this.#transferTypes,
      this.#owner,
    ).process();

    const methodIdentifier = exports.named.add(this.#endpointMethodName);
    const clientLibIdentifier = imports.default.getIdentifier(
      paths.createRelativePath(await ClientPlugin.getClientFileName(outputDir)),
    )!;

    const callExpression = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(clientLibIdentifier, ts.factory.createIdentifier('call')),
      undefined,
      [
        ts.factory.createStringLiteral(this.#endpointName),
        ts.factory.createStringLiteral(this.#endpointMethodName),
        packedParameters,
        initParam,
      ].filter(Boolean) as readonly Expression[],
    );

    const responseType = this.#prepareResponseType();

    return ts.factory.createFunctionDeclaration(
      [ts.factory.createToken(ts.SyntaxKind.AsyncKeyword)],
      undefined,
      methodIdentifier,
      undefined,
      parameters,
      ts.factory.createTypeReferenceNode('Promise', [responseType]),
      ts.factory.createBlock([ts.factory.createReturnStatement(callExpression)]),
    );
  }

  #prepareResponseType(): TypeNode {
    this.#owner.logger.debug(`${this.#endpointName}.${this.#endpointMethodName} POST - processing response type`);

    const responseTypes = Object.entries(this.#operation.responses)
      .flatMap(([code, response]) =>
        new EndpointMethodResponseProcessor(
          code,
          response,
          this.#dependencies,
          this.#transferTypes,
          this.#owner,
        ).process(),
      )
      .filter((value, index, arr) => arr.findIndex((v) => equal(v, value)) === index);

    if (responseTypes.length === 0) {
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword);
    }

    return ts.factory.createUnionTypeNode(responseTypes);
  }
}
