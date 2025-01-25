import { readFile } from 'node:fs/promises';
import Generator from '@vaadin/hilla-generator-core/Generator.js';
import type { PluginConstructor } from '@vaadin/hilla-generator-core/Plugin.js';
import LoggerFactory from '@vaadin/hilla-generator-utils/LoggerFactory.js';

export const pathBase = 'com/vaadin/hilla/parser/plugins/transfertypes';

export function createGenerator(plugins: readonly PluginConstructor[]): Generator {
  return new Generator(plugins, { logger: new LoggerFactory({ name: 'tsgen-test-transfertypes', verbose: true }) });
}

export async function loadInput(name: string, importMeta: string): Promise<string> {
  return readFile(new URL(`./${name}.json`, importMeta), 'utf8');
}
