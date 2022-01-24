import type ReferenceResolver from '@hilla/generator-typescript-core/ReferenceResolver.js';
import type Pino from 'pino';

export type BackbonePluginContext = Readonly<{
  logger: Pino.Logger;
  resolver: ReferenceResolver;
}>;

export const defaultMediaType = 'application/json';
