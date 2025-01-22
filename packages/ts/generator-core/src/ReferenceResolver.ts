import type SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPIV3 } from 'openapi-types';

export default class ReferenceResolver {
  readonly #parser: SwaggerParser;

  constructor(parser: SwaggerParser) {
    this.#parser = parser;
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  resolve<T extends object>(obj: OpenAPIV3.ReferenceObject | T): T {
    return '$ref' in obj ? this.#parser.$refs.get(obj.$ref) : obj;
  }
}
