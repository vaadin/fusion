import { basename } from 'path';
import type { SourceFile, Statement } from 'typescript';
import DependencyManager from './DependencyManager.js';
import { createSourceFile } from './utils.js';

export default class BarrelProcessor {
  readonly #endpoints: readonly SourceFile[];

  public constructor(endpoints: readonly SourceFile[]) {
    this.#endpoints = endpoints;
  }

  public process(): SourceFile {
    const { imports, exports } = this.#endpoints.reduce((acc, { fileName }) => {
      const specifier = basename(fileName, '.ts');

      const identifier = acc.imports.register(specifier, fileName);
      acc.exports.register(specifier, identifier);

      return acc;
    }, new DependencyManager());

    const importStatements = imports.toTS();
    const exportStatement = exports.toTS();

    return createSourceFile(
      [...importStatements, exportStatement].filter(Boolean) as readonly Statement[],
      './endpoints.ts',
    );
  }
}
