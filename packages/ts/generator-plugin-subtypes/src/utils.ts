import ts, { type PropertyName } from 'typescript';

export function propertyNameToString(node: PropertyName): string | null {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  return null;
}
