import createSourceFile from '@hilla/generator-typescript-utils/createSourceFile.js';
import ts from 'typescript';

function propertyNameToString(node: ts.PropertyName): string | null {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  return null;
}

export type EndpointOperations = {
  methodsToPatch: string[];
  removeInitImport: boolean;
};

export class TypeFixProcessor {
  readonly #source: ts.SourceFile;
  readonly #typeValue: string;

  constructor(source: ts.SourceFile, typeValue: string) {
    this.#source = source;
    this.#typeValue = typeValue;
  }

  process(): ts.SourceFile {
    const statements = this.#source.statements.map((statement) => {
      if (ts.isInterfaceDeclaration(statement)) {
        const members = statement.members.map((member) => {
          if (ts.isPropertySignature(member)) {
            if (propertyNameToString(member.name) === '@type') {
              return ts.factory.createPropertySignature(
                undefined,
                ts.factory.createStringLiteral('@type'),
                undefined,
                ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(this.#typeValue)),
              );
            }
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
