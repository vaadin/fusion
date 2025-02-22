import { readFile } from 'node:fs/promises';
import { isAbsolute, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import Generator from '@vaadin/hilla-generator-core/Generator.js';
import LoggerFactory from '@vaadin/hilla-generator-utils/LoggerFactory.js';
import type { PackageJson } from 'type-fest';
import GeneratorIO from './GeneratorIO.js';

const {
  values: { inputFile, help, outputDir, plugin: plugins, verbose, version },
} = parseArgs({
  options: {
    inputFile: {
      type: 'string',
      short: 'i',
    },
    help: {
      type: 'boolean',
    },
    outputDir: {
      default: 'frontend/generated',
      short: 'o',
      type: 'string',
    },
    plugin: {
      default: [],
      multiple: true,
      short: 'p',
      type: 'string',
    },
    verbose: {
      short: 'v',
      type: 'boolean',
    },
    version: {
      type: 'boolean',
    },
  },
});

if (help) {
  // eslint-disable-next-line no-console
  console.log(`Usage:
tsgen

Options:
  -i, --input-file       OpenAPI schema file (required)
  -h, --help             Show this screen
  -o, --output-dir       Output directory
  -p, --plugin <path>    Use the plugin loadable by <path>.
  -v, --verbose          Enable verbose logging
  --version              Show the app version
`);
} else if (version) {
  const packageJson: PackageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  // eslint-disable-next-line no-console
  console.log(packageJson.version);
} else {
  if (!inputFile) {
    throw new Error('Input file is required');
  }

  const logger = new LoggerFactory({ verbose });

  const outputDirPath = isAbsolute(outputDir) ? outputDir : join(process.cwd(), outputDir);

  const io = new GeneratorIO(
    pathToFileURL(outputDirPath.endsWith(sep) ? outputDirPath : `${outputDirPath}${sep}`),
    logger,
  );

  const resolvedPlugins = await Promise.all(
    Array.from(new Set(plugins), async (pluginPath) => io.loadPlugin(pluginPath)),
  );
  const generator = new Generator(resolvedPlugins, { logger, outputDir });

  const files = await generator.process(await readFile(inputFile, 'utf8'));
  const filesToDelete = await io.getExistingGeneratedFiles();
  const generatedFiles = await io.writeGeneratedFiles(files);

  await io.cleanOutputDir(generatedFiles, filesToDelete);
}
