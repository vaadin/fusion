import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Plugin from '@vaadin/hilla-generator-core/Plugin.js';
import LoggerFactory from '@vaadin/hilla-generator-utils/LoggerFactory.js';
import chaiAsPromised from 'chai-as-promised';
import { afterEach, beforeEach, chai, describe, expect, it } from 'vitest';
import GeneratorIO, { GENERATED_LIST_FILENAME } from '../src/GeneratorIO.js';

chai.use(chaiAsPromised);

// eslint-disable-next-line func-names,prefer-arrow-callback
describe('GeneratorIO', () => {
  const logger = new LoggerFactory({ verbose: true });
  const generatedFilenames = [1, 2, 3].map((i) => `file${i}.ts`);
  let tmpDir: URL;
  let io: GeneratorIO;

  async function createGeneratedFilesList() {
    await io.write(new File([generatedFilenames.join('\n')], GENERATED_LIST_FILENAME));
  }

  beforeEach(async () => {
    tmpDir = pathToFileURL(`${await mkdtemp(join(tmpdir(), 'generator-io-test-'))}/`);
    io = new GeneratorIO(tmpDir, logger);
    await Promise.all(generatedFilenames.map(async (name) => await writeFile(new URL(name, tmpDir), 'dummy content')));
  });

  afterEach(async () => {
    await rm(tmpDir, { force: true, recursive: true });
  });

  describe('getExistingGeneratedFiles', () => {
    it("should do nothing when there's no file index", async () => {
      await expect(io.getExistingGeneratedFiles()).to.eventually.be.fulfilled.and.empty;
    });

    it('should return the file index', async () => {
      await createGeneratedFilesList();
      expect(await io.getExistingGeneratedFiles()).to.be.deep.equal(['file1.ts', 'file2.ts', 'file3.ts']);
    });
  });

  describe('cleanOutputDir', () => {
    it('should delete all given files and report them', async () => {
      await createGeneratedFilesList();
      await expect(io.cleanOutputDir([], generatedFilenames)).to.eventually.be.deep.equal(generatedFilenames);
      await expect(readdir(tmpDir)).to.eventually.be.deep.equal([GENERATED_LIST_FILENAME]);
    });

    it('should not delete newly generated files and report them', async () => {
      await createGeneratedFilesList();
      await expect(io.cleanOutputDir(generatedFilenames.slice(0, 2), generatedFilenames)).to.eventually.be.deep.equal([
        'file3.ts',
      ]);
      await expect(readdir(tmpDir)).to.eventually.be.deep.equal(['file1.ts', 'file2.ts', GENERATED_LIST_FILENAME]);
    });

    it('should not touch other files', async () => {
      await createGeneratedFilesList();
      const otherFile = new URL('other-file.ts', tmpDir);
      await writeFile(otherFile, 'dummy content');
      await expect(io.cleanOutputDir([], generatedFilenames)).to.eventually.be.deep.equal(generatedFilenames);
      await expect(readdir(tmpDir)).to.eventually.be.deep.equal([GENERATED_LIST_FILENAME, 'other-file.ts']);
    });
  });

  describe('writeChangedFiles', () => {
    it('should write changed file and sync file index', async () => {
      const f = new File([''], 'file1.ts');
      await expect(io.writeGeneratedFiles([f])).to.eventually.be.deep.equal([f.name]);
      const content = await io.read(f.name);
      expect(content).to.equal('');
    });

    it('should not write unchanged files', async () => {
      const f = new File(['dummy content'], 'file1.ts');
      const url = new URL(f.name, tmpDir);
      const { mtime } = await stat(url);
      await expect(io.writeGeneratedFiles([f])).to.eventually.be.deep.equal([f.name]);
      const { mtime: mtime2 } = await stat(url);
      expect(mtime).to.be.deep.equal(mtime2);
    });
  });

  describe('loadPlugins', () => {
    it('loads the required plugin', async () => {
      const plugin = await io.loadPlugin(fileURLToPath(new URL('./TestPlugin.js', import.meta.url)));
      expect(plugin).to.be.a('function');
      expect(plugin.prototype).to.be.an.instanceof(Plugin);
    });
  });
});
