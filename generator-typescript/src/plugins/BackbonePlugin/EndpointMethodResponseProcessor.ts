import type { OpenAPIV3 } from 'openapi-types';
import type { ReadonlyDeep } from 'type-fest';
import type { TypeNode } from 'typescript';
import Schema from '../../core/Schema.js';
import type DependencyManager from './DependencyManager.js';
import SchemaProcessor from './SchemaProcessor.js';
import type { BackbonePluginContext } from './utils.js';
import { defaultMediaType } from './utils.js';

export type EndpointMethodResponses = ReadonlyDeep<OpenAPIV3.ResponsesObject>;
export type EndpointMethodResponse = ReadonlyDeep<OpenAPIV3.ResponseObject>;

export default class EndpointMethodResponseProcessor {
  readonly #code: string;
  readonly #context: BackbonePluginContext;
  readonly #dependencies: DependencyManager;
  readonly #response: EndpointMethodResponse;

  public constructor(
    code: string,
    response: EndpointMethodResponses[string],
    dependencyManager: DependencyManager,
    context: BackbonePluginContext,
  ) {
    this.#code = code;
    this.#context = context;
    this.#dependencies = dependencyManager;
    this.#response = context.resolver.resolve(response);
  }

  public process(): readonly TypeNode[] {
    switch (this.#code) {
      case '200':
        return this.#processOk();
      default:
        this.#context.logger.warn(`Response code '${this.#code} is not supported'`);
        return [];
    }
  }

  #processOk(): readonly TypeNode[] {
    const rawSchema = this.#response.content?.[defaultMediaType]?.schema;

    return rawSchema ? new SchemaProcessor(Schema.of(rawSchema), this.#dependencies).process() : [];
  }
}
