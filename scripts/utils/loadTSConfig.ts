import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseConfigFileTextToJson, type ParsedCommandLine, parseJsonConfigFileContent, sys } from 'typescript';

/**
 * Loads the TypeScript compiler options from a tsconfig file.
 *
 * @param file - The URL of the tsconfig file.
 * @returns The parsed compiler options.
 */
export default async function loadTSConfig(file: URL): Promise<ParsedCommandLine> {
  const { config } = parseConfigFileTextToJson(fileURLToPath(file), await readFile(file, 'utf8')) as {
    config: ParsedCommandLine;
  };

  return parseJsonConfigFileContent(config, sys, './');
}
