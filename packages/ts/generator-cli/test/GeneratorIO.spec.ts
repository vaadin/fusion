import { statSync } from 'node:fs';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import LoggerFactory from '@vaadin/hilla-generator-utils/LoggerFactory.js';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import GeneratorIO from '../src/GeneratorIO.js';

use(chaiAsPromised);

// eslint-disable-next-line func-names,prefer-arrow-callback
describe('Testing GeneratorIO', function (this: Mocha.Suite) {
  this.timeout(5000);

  const logger = new LoggerFactory({ verbose: true });
  const generatedFilenames = [1, 2, 3].map((i) => `file${i}.ts`);
  let tmpDir: string;
  let io: GeneratorIO;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'generator-io-test-'));
    io = new GeneratorIO(tmpDir, logger);
    await Promise.all(
      generatedFilenames.map(async (name) => {
        await writeFile(join(tmpDir, name), 'dummy content');
      }),
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { force: true, recursive: true });
  });

  describe('Testing GeneratorIO.exists', () => {
    it('should detect that a file exists', async () => {
      const path = join(tmpDir, generatedFilenames[0]);
      await expect(GeneratorIO.exists(path)).to.eventually.be.true;
    });

    it("should detect that a file doesn't exist", async () => {
      const path = join(tmpDir, 'nobody-created-me');
      await expect(GeneratorIO.exists(path)).to.eventually.be.false;
    });
  });

  describe('Testing GeneratorIO.createIndex', () => {
    it('should create file index with right content', async () => {
      await io.createFileIndex(generatedFilenames);
      const indexPath = join(tmpDir, GeneratorIO.INDEX_FILENAME);
      await expect(GeneratorIO.exists(indexPath)).to.eventually.be.true;
      const content = await io.read(indexPath);
      generatedFilenames.forEach((name) => expect(content).to.contain(name));
    });
  });

  describe('Testing GeneratorIO.getGeneratedFiles', () => {
    it("should do nothing when there's no file index", async () => {
      await expect(io.getGeneratedFiles()).to.eventually.be.empty;

      await Promise.all(
        generatedFilenames.map(async (name) => {
          const path = join(tmpDir, name);
          await expect(GeneratorIO.exists(path)).to.eventually.be.true;
        }),
      );
    });
    it('should return the file index', async () => {
      await io.createFileIndex(generatedFilenames);

      expect(await io.getGeneratedFiles()).to.eql(new Set(['file1.ts', 'file2.ts', 'file3.ts']));
    });
    xit('should fail when IO error happens', async () => {
      await io.createFileIndex(generatedFilenames);
      await chmod(tmpDir, 0o666);
      await expect(io.getGeneratedFiles()).to.eventually.be.rejectedWith(Error, /^(?!ENOENT).*/u);
      await chmod(tmpDir, 0o777);
    });
  });
  describe('Testing GeneratorIO.cleanOutputDir', () => {
    it('should delete all given files and report them', async () => {
      await io.createFileIndex(generatedFilenames);
      await expect(
        io.cleanOutputDir([generatedFilenames[0], generatedFilenames[1]], new Set(generatedFilenames)),
      ).to.eventually.have.property('size', generatedFilenames.length - 2);
      const existenceResults = await Promise.all(
        generatedFilenames.map(async (name) => GeneratorIO.exists(join(tmpDir, name))),
      );
      expect(existenceResults).to.be.deep.equal([true, true, false]);
    });

    it('should not delete newly generated files and report them', async () => {
      await io.createFileIndex(generatedFilenames);
      await expect(io.cleanOutputDir([], new Set(generatedFilenames))).to.eventually.have.property(
        'size',
        generatedFilenames.length,
      );
      const existenceResults = await Promise.all(
        generatedFilenames.map(async (name) => GeneratorIO.exists(join(tmpDir, name))),
      );
      expect(existenceResults).to.be.deep.equal([false, false, false]);
    });

    it('should not touch other files', async () => {
      await io.createFileIndex(generatedFilenames);
      const name = 'other-file.ts';
      await writeFile(join(tmpDir, name), 'dummy content');
      await expect(io.cleanOutputDir([], new Set(generatedFilenames))).to.eventually.have.property(
        'size',
        generatedFilenames.length,
      );
      await expect(GeneratorIO.exists(join(tmpDir, name))).to.eventually.be.true;
    });
  });
  describe('Testing GeneratorIO.writeChangedFiles', () => {
    it('should write changed file and sync file index', async () => {
      const f: File = new File([''], 'file1.ts');
      expect(await io.writeGeneratedFiles([f])).to.eql([f.name]);
      const content = await io.read(io.resolveGeneratedFile(f.name));
      expect(content).to.equal('');
    });

    it('should not write unchanged files', async () => {
      const f: File = new File(['dummy content'], 'file1.ts');
      const { mtime } = statSync(io.resolveGeneratedFile(f.name));
      expect(await io.writeGeneratedFiles([f])).to.eql([f.name]);
      const mtime2 = statSync(io.resolveGeneratedFile(f.name)).mtime;
      expect(mtime).to.eql(mtime2);
    });
  });
});
