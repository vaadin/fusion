import cssnanoPlugin from 'cssnano';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const cssTransformer = postcss([cssnanoPlugin()]);

export function replaceCSSImports(contents: string): string {
  return contents.replaceAll(/\.obj\.css/gmu, '.obj.js');
}

export async function compileCSS(contents: string, from: URL): Promise<string> {
  const compiled = await cssTransformer
    .process(contents, { from: fileURLToPath(from) })
    .then(({ content: c }) => c.replaceAll(/[`$]/gmu, '\\$&'));

  return `const css = new CSSStyleSheet();css.replaceSync(\`${compiled}\`);export default css;`;
}
