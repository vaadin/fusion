import type Plugin from '@vaadin/hilla-generator-core/Plugin.js';
import type { TransferTypes } from '@vaadin/hilla-generator-core/SharedStorage.t.js';
import type DependencyManager from '@vaadin/hilla-generator-utils/dependencies/DependencyManager.js';
import type { OpenAPIV3 } from 'openapi-types';
import type { TypeNode } from 'typescript';
import TypeSchemaProcessor from './TypeSchemaProcessor.js';
import { defaultMediaType } from './utils.js';

export type EndpointMethodResponses = OpenAPIV3.ResponsesObject;
export type EndpointMethodResponse = OpenAPIV3.ResponseObject;

export default class EndpointMethodResponseProcessor {
  readonly #code: string;
  readonly #dependencies: DependencyManager;
  readonly #transferTypes: TransferTypes;
  readonly #owner: Plugin;
  readonly #response: EndpointMethodResponse;

  constructor(
    code: string,
    response: EndpointMethodResponses[string],
    dependencyManager: DependencyManager,
    transferTypes: TransferTypes,
    owner: Plugin,
  ) {
    this.#code = code;
    this.#owner = owner;
    this.#dependencies = dependencyManager;
    this.#response = owner.resolver.resolve(response);
    this.#transferTypes = transferTypes;
  }

  process(): readonly TypeNode[] {
    switch (this.#code) {
      case '200':
        return this.#processOk();
      default:
        this.#owner.logger.warn(`Response code '${this.#code} is not supported'`);
        return [];
    }
  }

  #processOk(): readonly TypeNode[] {
    const rawSchema = this.#response.content?.[defaultMediaType]?.schema;

    return rawSchema ? new TypeSchemaProcessor(rawSchema, this.#dependencies, this.#transferTypes).process() : [];
  }
}
