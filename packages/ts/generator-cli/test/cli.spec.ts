import { exec } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { PackageJson } from 'type-fest';
import { describe, expect, it } from 'vitest';

const execAsync = promisify(exec);

const { version } = await readFile(new URL('../package.json', import.meta.url)).then(
  (data) => JSON.parse(data.toString()) as PackageJson,
);

describe('cli', () => {
  it('should print help', async () => {
    const { stdout } = await execAsync(`npx tsx src/index.ts --help`);
    await expect(stdout).toMatchFileSnapshot('fixtures/help.snap');
  });

  it('should print version', async () => {
    const { stdout } = await execAsync(`npx tsx src/index.ts --version`);
    expect(stdout.trim()).to.be.equal(version);
  });

  it('should throw an error if input file is not provided', async () => {
    await expect(execAsync(`npx tsx src/index.ts`)).rejects.and.throws(Error, 'Input file is required');
  });
});
