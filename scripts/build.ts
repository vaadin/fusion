import { mkdir, readFile, writeFile, glob } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { PackageJson } from 'type-fest';
import { createCompilerHost, createProgram, type ParsedCommandLine, sys } from 'typescript';
import { compileCSS, replaceCSSImports } from './utils/compileCSS.js';
import dir from './utils/dir.js';
import injectRegister from './utils/injectRegister.js';
import loadTSConfig from './utils/loadTSConfig.js';
import redirectURLPart from './utils/redirectURLPart.js';

const cwd = pathToFileURL(dir(process.cwd()));
const sourceDir = new URL('src/', cwd);

const [config, packageJson] = await Promise.all([
  loadTSConfig(new URL('tsconfig.build.json', cwd)),
  readFile(new URL('package.json', cwd), 'utf8').then((contents) => JSON.parse(contents) as PackageJson),
]);

const outDir = new URL(dir(config.options.outDir ?? 'dist'), cwd);

async function* loadFiles() {
  for await (const file of glob('**/*.{ts,tsx,obj.css}', { cwd: fileURLToPath(sourceDir) })) {
    const fileURL = new URL(file, sourceDir);

    if (file.endsWith('.d.ts')) {
      throw new Error(`Declaration files are not allowed in source directory: ${fileURL.toString()}`);
    }

    const contents = await readFile(fileURL, 'utf8');

    if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      let result = injectRegister(contents, packageJson);
      result = replaceCSSImports(result);
      yield [fileURLToPath(fileURL), result] as const;
    } else if (file.endsWith('.obj.css')) {
      yield [fileURLToPath(fileURL), contents] as const;
    } else {
      throw new Error(`Unexpected file type: ${fileURL.toString()}`);
    }
  }
}

const originalFiles = Object.fromEntries(await Array.fromAsync(loadFiles()));

/**
 * Compiles the TypeScript files applying the given transformers, and filters
 * empty JS files.
 *
 * @param options - The compiler options.
 * @param fileNames - The names of files to compile.
 * @returns The array of names of the compiled files and their contents.
 */
function compileTypeScript({ options, fileNames }: ParsedCommandLine): ReadonlyArray<readonly [URL, string]> {
  const createdFiles: Array<readonly [string, string]> = [];
  const host = createCompilerHost(options);
  host.readFile = (fileName) => originalFiles[fileURLToPath(new URL(fileName, cwd))] ?? sys.readFile(fileName);
  host.writeFile = (fileName, data) => {
    createdFiles.push([fileName, data]);
  };
  const program = createProgram(fileNames, options, host);

  program.emit();

  return createdFiles
    .filter(
      ([fileName, data]) => !(fileName.endsWith('.js') && data.startsWith('export {}') && data.split('\n').length < 3),
    )
    .filter(([fileName], _, arr) => {
      if (!fileName.endsWith('.js.map')) {
        return true;
      }
      const sourceName = fileName.replace('.map', '');
      return arr.some(([f]) => f === sourceName);
    })
    .map(([fileName, data]) => [new URL(fileName, outDir), data] as const);
}

const cssFiles = await Promise.all(
  Object.entries(originalFiles)
    .filter(([file]) => file.endsWith('.obj.css'))
    .map(([file, data]) => [pathToFileURL(file.replace('.css', '.js')), data] as const)
    .map(async ([file, data]) => [redirectURLPart(file, sourceDir, outDir), await compileCSS(data, file)] as const),
);

await Promise.all(
  [...compileTypeScript(config), ...cssFiles].map(async ([file, data]) => {
    await mkdir(new URL('./', file), { recursive: true });
    await writeFile(file, data, 'utf8');
  }),
);
