import type { $Refs } from '@apidevtools/swagger-parser';
import type { OpenAPIV3 } from 'openapi-types';
import type { ReadonlyDeep } from 'type-fest';
import type { SourceFile, TypeNode } from 'typescript';

export type TransferTypeMaker = (typeArguments: readonly TypeNode[] | undefined) => TypeNode;

export type TransferTypes = Map<string, TransferTypeMaker>;

export type SharedStorage = Readonly<{
  api: ReadonlyDeep<OpenAPIV3.Document>;
  apiRefs: $Refs;
  outputDir?: string;
  pluginStorage: Map<string, unknown>;
  sources: SourceFile[];
  transferTypes: TransferTypes;
}>;
