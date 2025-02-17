import type { SourceMapPayload } from 'module';
import { mkdir, readFile, writeFile, glob } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transform, type TransformOptions } from 'oxc-transform';
import type { PackageJson } from 'type-fest';
import { ScriptTarget } from 'typescript';
import { compileCSS, replaceCSSImports } from './utils/compileCSS.js';
import dir from './utils/dir.js';
import injectRegister from './utils/injectRegister.js';
import loadTSConfig from './utils/loadTSConfig.js';

const cwd = pathToFileURL(dir(process.cwd()));
const sourceDir = new URL('src/', cwd);
const [config, packageJson] = await Promise.all([
  loadTSConfig(new URL('tsconfig.build.json', cwd)),
  readFile('package.json', 'utf8').then((contents) => JSON.parse(contents) as PackageJson),
]);

const outDir = new URL(dir(config.options.outDir ?? 'dist'), cwd);

function getScriptTarget(target?: ScriptTarget): string {
  switch (target) {
    case ScriptTarget.ES2021:
      return 'es2021';
    case ScriptTarget.ES2022:
      return 'es2022';
    case ScriptTarget.ES2023:
      return 'es2023';
    default:
      return 'esnext';
  }
}

const oxcConfig = {
  sourceType: 'module',
  lang: 'tsx',
  cwd: fileURLToPath(cwd),
  sourcemap: true,
  typescript: {
    declaration: {
      stripInternal: true,
    },
    onlyRemoveTypeImports: true,
  },
  jsx: {
    runtime: 'automatic',
    pure: true,
  },
  target: getScriptTarget(config.options.target),
} satisfies TransformOptions;

for await (const file of glob('**/*.{ts,tsx,obj.css}', { cwd: fileURLToPath(sourceDir) })) {
  const fileURL = new URL(file, sourceDir);
  let contents = await readFile(fileURL, 'utf8');

  if (file.endsWith('.d.ts')) {
    throw new Error(`Declaration files are not allowed in source directory: ${fileURL.toString()}`);
  }

  if (file.endsWith('.ts') || file.endsWith('.tsx')) {
    contents = injectRegister(contents, packageJson);
    contents = replaceCSSImports(contents);

    const { code, declaration, map, errors } = transform(fileURLToPath(fileURL), contents, oxcConfig);

    if (errors.length) {
      for (const error of errors) {
        console.error(fileURL.toString(), error);
      }
      process.exit(1);
    }

    const fileBase = file.replace(/\.tsx?$/u, '');

    const js = new URL(`${fileBase}.js`, outDir);
    const jsMap = new URL(`${fileBase}.js.map`, outDir);
    const dts = new URL(`${fileBase}.d.ts`, outDir);

    await mkdir(new URL('./', js), { recursive: true });

    if (code.trim() === 'export {};') {
      await writeFile(dts, declaration!);
    } else {
      await Promise.all([
        writeFile(js, `${code}//# sourceMappingURL=./${basename(fileURLToPath(jsMap))}`),
        writeFile(jsMap, JSON.stringify(map as SourceMapPayload)),
        writeFile(dts, declaration!),
      ]);
    }
  } else if (file.endsWith('.obj.css')) {
    await writeFile(new URL(file.replace('.css', '.js'), outDir), await compileCSS(contents, fileURL));
  }
}
