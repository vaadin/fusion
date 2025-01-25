import { open } from 'fs/promises';
import { fileURLToPath } from 'url';
import Plugin from '@vaadin/hilla-generator-core/Plugin.js';
import type { SharedStorage } from '@vaadin/hilla-generator-core/SharedStorage.t.js';
import ClientProcessor from './ClientProcessor.js';

export default class ClientPlugin extends Plugin {
  static readonly CLIENT_FILE_NAME = 'connect-client.default';
  static readonly CUSTOM_CLIENT_FILE_NAME = '../connect-client';

  static async getClientFileName(path?: string): Promise<string> {
    return (await ClientPlugin.#checkForCustomClientFile(path))
      ? ClientPlugin.CUSTOM_CLIENT_FILE_NAME
      : ClientPlugin.CLIENT_FILE_NAME;
  }

  static async #checkForCustomClientFile(path?: string): Promise<boolean> {
    const dir = path?.startsWith('file:') ? fileURLToPath(path) : path;

    try {
      return !!(dir && (await open(`${dir}/${ClientPlugin.CUSTOM_CLIENT_FILE_NAME}.ts`, 'r')));
    } catch (e) {
      return false;
    }
  }

  declare ['constructor']: typeof ClientPlugin;

  override get path(): string {
    return import.meta.url;
  }

  override async execute({ outputDir, sources }: SharedStorage): Promise<void> {
    // the client file is created only if a custom client file is not found
    if (!(outputDir && (await ClientPlugin.#checkForCustomClientFile(outputDir)))) {
      const clientFile = new ClientProcessor(this.constructor.CLIENT_FILE_NAME, this).process();
      sources.push(clientFile);
    }
  }
}
