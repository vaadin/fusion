import ts, { type ExportAssignment, type ExportDeclaration, type Identifier, type Statement } from 'typescript';
import createFullyUniqueIdentifier from '../createFullyUniqueIdentifier.js';
import type CodeConvertable from './CodeConvertable.js';
import StatementRecordManager, { type StatementRecord } from './StatementRecordManager.js';
import { createDependencyRecord, type DependencyRecord } from './utils.js';

export class NamedExportManager implements CodeConvertable<ExportDeclaration | undefined> {
  readonly #collator: Intl.Collator;
  readonly #map = new Map<string, DependencyRecord>();

  get size(): number {
    return this.#map.size;
  }

  constructor(collator: Intl.Collator) {
    this.#collator = collator;
  }

  add(name: string, isType?: boolean, uniqueId?: Identifier): Identifier {
    const id = uniqueId ?? createFullyUniqueIdentifier(name);
    this.#map.set(name, createDependencyRecord(id, isType));
    return id;
  }

  getIdentifier(name: string): Identifier | undefined {
    return this.#map.get(name)?.id;
  }

  *identifiers(): IterableIterator<readonly [id: Identifier, isType: boolean]> {
    for (const { id, isType } of this.#map.values()) {
      yield [id, isType];
    }
  }

  isType(name: string): boolean | undefined {
    return this.#map.get(name)?.isType;
  }

  names(): IterableIterator<string> {
    return this.#map.keys();
  }

  toCode(): ExportDeclaration | undefined {
    if (this.#map.size === 0) {
      return undefined;
    }

    const names = [...this.#map.keys()];
    // eslint-disable-next-line @typescript-eslint/unbound-method
    names.sort(this.#collator.compare);

    return ts.factory.createExportDeclaration(
      undefined,
      false,
      ts.factory.createNamedExports(
        names.map((name) => {
          const { id, isType } = this.#map.get(name)!;
          return ts.factory.createExportSpecifier(isType, id, ts.factory.createIdentifier(name));
        }),
      ),
      undefined,
    );
  }
}

export class NamespaceExportManager extends StatementRecordManager<ExportDeclaration> {
  readonly #map = new Map<string, Identifier | null>();

  get size(): number {
    return this.#map.size;
  }

  addCombined(path: string, name: string, uniqueId?: Identifier): Identifier {
    const id = uniqueId ?? createFullyUniqueIdentifier(name);
    this.#map.set(path, id);
    return id;
  }

  addSpread(path: string): void {
    this.#map.set(path, null);
  }

  override clear(): void {
    this.#map.clear();
  }

  getIdentifier(path: string): Identifier | null | undefined {
    return this.#map.get(path);
  }

  identifiers(): IterableIterator<Identifier | null> {
    return this.#map.values();
  }

  isCombined(path: string): boolean | undefined {
    return this.#map.has(path) ? this.#map.get(path) !== null : undefined;
  }

  isSpread(path: string): boolean | undefined {
    return this.#map.has(path) ? this.#map.get(path) === null : undefined;
  }

  paths(): IterableIterator<string> {
    return this.#map.keys();
  }

  override *statementRecords(): IterableIterator<StatementRecord<ExportDeclaration>> {
    for (const [path, id] of this.#map) {
      yield [
        path,
        ts.factory.createExportDeclaration(
          undefined,
          false,
          id !== null ? ts.factory.createNamespaceExport(id) : undefined,
          ts.factory.createStringLiteral(path),
        ),
      ];
    }
  }
}

export class DefaultExportManager implements CodeConvertable<ExportAssignment | undefined> {
  #id?: Identifier;

  get isEmpty(): boolean {
    return !this.#id;
  }

  set(id: Identifier | string): Identifier {
    this.#id = typeof id === 'string' ? ts.factory.createIdentifier(id) : id;
    return this.#id;
  }

  toCode(): ExportAssignment | undefined {
    return this.#id ? ts.factory.createExportAssignment(undefined, undefined, this.#id) : undefined;
  }
}

export default class ExportManager implements CodeConvertable<readonly Statement[]> {
  readonly default: DefaultExportManager = new DefaultExportManager();
  readonly named: NamedExportManager;
  readonly namespace: NamespaceExportManager;

  get size(): number {
    return (this.default.isEmpty ? 0 : 1) + this.named.size + this.namespace.size;
  }

  constructor(collator: Intl.Collator) {
    this.named = new NamedExportManager(collator);
    this.namespace = new NamespaceExportManager(collator);
  }

  toCode(): readonly Statement[] {
    const defaultStatement = this.default.toCode();
    const namedStatement = this.named.toCode();
    const namespaceStatements = this.namespace.toCode();

    const result: Statement[] = [];

    if (namedStatement) {
      result.push(namedStatement);
    }

    result.push(...namespaceStatements);

    if (defaultStatement) {
      result.push(defaultStatement);
    }

    return result;
  }
}
