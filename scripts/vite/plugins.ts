import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import type { PackageJson } from 'type-fest';
import type { Plugin } from 'vite';
import { compileCSS } from '../utils/compileCSS.js';
import injectRegister from '../utils/injectRegister.js';

export type PluginOptions = Readonly<{
  packageJson: PackageJson;
}>;

export type LoadRegisterOptions = PluginOptions;

// This plugin adds "__REGISTER__()" function definition everywhere where it finds
// the call for that function. It is necessary for a correct code for tests.
export function loadRegisterJs({ packageJson }: LoadRegisterOptions): Plugin {
  return {
    enforce: 'pre',
    name: 'vite-hilla-register',
    transform(code) {
      return injectRegister(code, packageJson);
    },
  };
}

// This plugin transforms CSS to Constructible CSSStyleSheet for easy
// installation it to the document styles.
export function constructCss(): Plugin {
  const css = new Map();

  return {
    enforce: 'post',
    name: 'vite-construct-css',
    async load(id) {
      if (id.endsWith('.obj.css')) {
        const content = await readFile(id, 'utf8');
        css.set(id, content);
        return {
          code: '',
        };
      }

      return null;
    },
    async transform(_, id) {
      if (id.endsWith('.obj.css')) {
        return {
          code: await compileCSS(css.get(id), pathToFileURL(id)),
        };
      }

      return null;
    },
  };
}
