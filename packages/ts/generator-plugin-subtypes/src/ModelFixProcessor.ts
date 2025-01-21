import createSourceFile from '@vaadin/hilla-generator-utils/createSourceFile.js';
import ts, { type SourceFile } from 'typescript';
import { propertyNameToString } from './utils.js';

export class ModelFixProcessor {
  readonly #source: SourceFile;

  constructor(source: SourceFile) {
    this.#source = source;
  }

  process(): SourceFile {
    const statements = this.#source.statements.map((statement) => {
      // filter out the @type property from all models
      if (ts.isClassDeclaration(statement)) {
        const members = statement.members.filter(
          (member) => !(ts.isGetAccessor(member) && propertyNameToString(member.name) === '@type'),
        );

        return ts.factory.createClassDeclaration(
          statement.modifiers,
          statement.name,
          statement.typeParameters,
          statement.heritageClauses,
          members,
        );
      }

      return statement;
    });

    return createSourceFile(statements, this.#source.fileName);
  }
}
