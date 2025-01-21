import { open } from 'fs/promises';
import { fileURLToPath } from 'url';
import Plugin from '@vaadin/hilla-generator-core/Plugin.js';
import type { SharedStorage } from '@vaadin/hilla-generator-core/SharedStorage.t.js';
import ClientProcessor from './ClientProcessor.js';

async function checkForCustomClientFile(path?: string): Promise<boolean> {
  const dir = path?.startsWith('file:') ? fileURLToPath(path) : path;

  try {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return !!(dir && (await open(`${dir}/${ClientPlugin.CUSTOM_CLIENT_FILE_NAME}.ts`, 'r')));
  } catch (e) {
    return false;
  }
}

async function getClientFileName(path?: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  return (await checkForCustomClientFile(path)) ? ClientPlugin.CUSTOM_CLIENT_FILE_NAME : ClientPlugin.CLIENT_FILE_NAME;
}

export default class ClientPlugin extends Plugin {
  static readonly CLIENT_FILE_NAME = 'connect-client.default';
  static readonly CUSTOM_CLIENT_FILE_NAME = '../connect-client';

  declare ['constructor']: typeof ClientPlugin;

  override get path(): string {
    return import.meta.url;
  }

  override async execute({ outputDir, sources }: SharedStorage): Promise<void> {
    // the client file is created only if a custom client file is not found
    if (!(outputDir && (await checkForCustomClientFile(outputDir)))) {
      const clientFile = new ClientProcessor(this.constructor.CLIENT_FILE_NAME, this).process();
      sources.push(clientFile);
    }
  }
}
