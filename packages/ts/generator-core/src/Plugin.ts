import type LoggerFactory from '@vaadin/hilla-generator-utils/LoggerFactory.js';
import type { Logger } from '@vaadin/hilla-generator-utils/LoggerFactory.js';
import type { Constructor } from 'type-fest';
import type ReferenceResolver from './ReferenceResolver.js';
import type { SharedStorage } from './SharedStorage.t.js';

export default abstract class Plugin {
  readonly resolver: ReferenceResolver;
  readonly logger: Logger;

  constructor(resolver: ReferenceResolver, logger: LoggerFactory) {
    this.logger = logger.for(this.constructor.name);
    this.resolver = resolver;
  }

  get name(): string {
    return this.constructor.name;
  }

  abstract get path(): string;

  abstract execute(storage: SharedStorage): Promise<void> | void;
}

export type PluginConstructor = Constructor<Plugin, ConstructorParameters<typeof Plugin>>;
