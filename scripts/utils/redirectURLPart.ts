import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export default function redirectURLPart(url: URL, from: URL, to: URL): URL {
  return new URL(relative(fileURLToPath(from), fileURLToPath(url)), to);
}
