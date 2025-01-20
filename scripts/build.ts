import { readFile } from 'node:fs/promises';
import { sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import cssnanoPlugin from 'cssnano';
import { build, type Plugin } from 'esbuild';
import { glob } from 'glob';
import postcss from 'postcss';
import type { PackageJson } from 'type-fest';

const scriptsDir = new URL('./', import.meta.url);
const packageRoot = pathToFileURL(process.cwd() + sep);
const [packageJsonFile, srcFiles] = await Promise.all([
  readFile(new URL('package.json', packageRoot), 'utf8'),
  glob('src/**/*.{ts,tsx,obj.css}', { ignore: ['**/*.d.ts', '**/*.t.ts'] }),
]);

const packageJson: PackageJson = JSON.parse(packageJsonFile);

const cssTransformer = postcss([cssnanoPlugin()]);
const cssPath = /['"](.+)\.obj\.css['"]/gmu;
const cssConstructPlugin: Plugin = {
  name: 'construct-css',
  setup(_build) {
    // Here CSS imports like `import css from 'autocrud.obj.css';` are transformed to
    // JS imports: `import css from 'autocrud.obj.js'`.
    _build.onLoad({ filter: /\.tsx?/u }, async ({ path }) => {
      const contents = await readFile(path, 'utf8');

      return {
        contents: contents.replaceAll(cssPath, "'$1.obj.js'"),
        loader: 'tsx',
      };
    });

    // We transform CSS into a Constructible CSSStyleSheet to add it to the document on import.
    _build.onLoad({ filter: /\.obj\.css/u }, async ({ path }) => {
      const contents = await readFile(path, 'utf8');
      const processed = await cssTransformer
        .process(contents)
        .then(({ content: c }) => c.replaceAll(/[`$]/gmu, '\\$&'));

      return {
        contents: `const css = new CSSStyleSheet();css.replaceSync(\`${processed}\`);export { css as default };`,
        loader: 'js',
      };
    });
  },
};

await build({
  define: {
    __NAME__: `'${packageJson.name ?? '@hilla/unknown'}'`,
    __VERSION__: `'${packageJson.version ?? '0.0.0'}'`,
  },
  // Adds a __REGISTER__ function definition everywhere in the built code where
  // the call for that function exists.
  inject: [fileURLToPath(new URL('./register.js', scriptsDir))],
  entryPoints: srcFiles.map((file) => new URL(file, packageRoot)).map((url) => fileURLToPath(url)),
  format: 'esm',
  outdir: fileURLToPath(packageRoot),
  packages: 'external',
  plugins: [cssConstructPlugin],
  sourcemap: 'linked',
  sourcesContent: true,
  tsconfig: fileURLToPath(new URL('./tsconfig.build.json', packageRoot)),
});
