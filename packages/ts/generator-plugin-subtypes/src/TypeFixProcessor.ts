import createSourceFile from '@vaadin/hilla-generator-utils/createSourceFile.js';
import ts, { type SourceFile } from 'typescript';
import { propertyNameToString } from './utils.js';

export class TypeFixProcessor {
  readonly #source: SourceFile;
  readonly #typeValue: string;

  constructor(source: ts.SourceFile, typeValue: string) {
    this.#source = source;
    this.#typeValue = typeValue;
  }

  process(): SourceFile {
    const statements = this.#source.statements.map((statement) => {
      // search in the interface definition
      if (ts.isInterfaceDeclaration(statement)) {
        const members = statement.members.map((member) => {
          // search for the @type property and replace it with a quoted string
          if (ts.isPropertySignature(member) && propertyNameToString(member.name) === '@type') {
            return ts.factory.createPropertySignature(
              undefined,
              ts.factory.createStringLiteral('@type'),
              undefined,
              ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(this.#typeValue)),
            );
          }

          return member;
        });

        return ts.factory.createInterfaceDeclaration(
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
