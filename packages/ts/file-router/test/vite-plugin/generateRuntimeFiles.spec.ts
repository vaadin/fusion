import { existsSync, watch } from 'node:fs';
import { rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import type { Logger } from 'vite';
import { generateRuntimeFiles, type RuntimeFileUrls } from '../../src/vite-plugin/generateRuntimeFiles.js';
import { createLogger, createTestingRouteFiles, createTmpDir } from '../utils.js';

use(chaiAsPromised);

describe('@vaadin/hilla-file-router', () => {
  describe('generateRuntimeFiles', () => {
    let tmp: URL;
    let viewsDir: URL;
    let runtimeUrls: RuntimeFileUrls;
    let logger: Logger;

    before(async () => {
      tmp = await createTmpDir();

      viewsDir = new URL('views/', tmp);
      runtimeUrls = {
        json: new URL('server/file-routes.json', tmp),
        code: new URL('generated/file-routes.ts', tmp),
        layouts: new URL('generated/layouts.json', tmp),
      };

      await createTestingRouteFiles(viewsDir);
    });

    after(async () => {
      await rm(tmp, { recursive: true, force: true });
    });

    beforeEach(() => {
      logger = createLogger();
    });

    it('should generate the runtime files', async () => {
      if (!existsSync(new URL('generated', tmp))) {
        await mkdir(new URL('generated', tmp));
      }
      await writeFile(
        runtimeUrls.layouts,
        '[{"path": "/really/long/path/for/layout"}, {"path": "/profile"}, {"path": "home"}]',
        'utf-8',
      );
      expect(existsSync(runtimeUrls.layouts)).to.be.true;

      await generateRuntimeFiles(viewsDir, runtimeUrls, ['.tsx', '.jsx'], logger, true);
      expect(existsSync(runtimeUrls.json)).to.be.true;
      expect(existsSync(runtimeUrls.code)).to.be.true;
      const listener = () => {
        throw new Error('File is changed');
      };
      const json = watch(runtimeUrls.json, listener);
      const code = watch(runtimeUrls.code, listener);

      await generateRuntimeFiles(viewsDir, runtimeUrls, ['.tsx', '.jsx'], logger, true);
      await new Promise((resolve) => {
        // Wait some time to ensure that the file is not changed
        setTimeout(resolve, 100);
      });
      json.close();
      code.close();
    });

    it('root layout should match all routes', async () => {
      if (!existsSync(new URL('generated', tmp))) {
        await mkdir(new URL('generated', tmp));
      }
      await writeFile(runtimeUrls.layouts, '[{"path": "/"}]', 'utf-8');

      await generateRuntimeFiles(viewsDir, runtimeUrls, ['.tsx', '.jsx'], logger, true);

      const generatedCode = await readFile(runtimeUrls.code, 'utf-8');
      const noLayout = /createRoute\("\S*", false/gmu;
      expect(noLayout.test(generatedCode)).to.be.false;
    });

    it('should not throw if views does not exist', async () => {
      await rm(viewsDir, { force: true, recursive: true });
      await generateRuntimeFiles(viewsDir, runtimeUrls, ['.tsx', '.jsx'], logger, true);
    });
  });
});
