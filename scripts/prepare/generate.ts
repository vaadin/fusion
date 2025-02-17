/* eslint-disable no-console */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Script } from 'node:vm';
import { remote, type Transformer, type Versions, type Writer } from './config.js';

const require = createRequire(import.meta.url);

async function loadScripts(): Promise<readonly [Writer, Transformer]> {
  const [creator, replacer, transformer, writer] = await Promise.all(
    ['creator', 'replacer', 'transformer', 'writer'].map(async (name) => {
      const url = new URL(`./${name}.js`, remote.src);
      const res = await fetch(url);
      const code = await res.text();
      return new Script(code, { filename: url.toString() });
    }),
  );

  function req(name: string): unknown {
    let script: Script;

    if (name.includes('creator')) {
      script = creator;
    } else if (name.includes('replacer')) {
      script = replacer;
    } else if (name.includes('writer')) {
      script = writer;
    } else if (name.includes('transformer')) {
      script = transformer;
    } else {
      return require(name);
    }

    const exports = {};

    const ctx = {
      exports,
      module: { exports },
      require: req,
      process: { env: {} },
    };
    script.runInNewContext(ctx);

    return ctx.module.exports;
  }

  return [req('writer') as Writer, req('transformer') as Transformer];
}

const [writer, transformer] = await loadScripts();

const [
  hillaJsonTemplateFileName,
  ,
  releaseNotesTemplateFileName,
  releaseNotesMaintenanceTemplateFileName,
  releaseNotesPrereleaseTemplateFileName,
] = [
  'template-hilla-versions.json',
  'template-hilla-react-versions.json',
  'template-release-note.md',
  'template-release-note-maintenance.md',
  'template-release-note-prerelease.md',
].map((name) => fileURLToPath(new URL(`templates/${name}`, import.meta.url)));

const [
  hillaJsonResultFileName,
  releaseNotesResultFileName,
  releaseNotesMaintenanceResultFileName,
  releaseNotesPrereleaseResultFileName,
] = ['hilla-versions.json', 'release-note.md', 'release-note-maintenance.md', 'release-note-prerelease.md'].map(
  (name) => fileURLToPath(new URL(`results/${name}`, import.meta.url)),
);

export default function generate(version: string, versions: Versions): void {
  console.log('Generating release files');

  const transformed = transformer.transformVersions(versions, version, false);
  transformed.platform = version;

  writer.writeSeparateJson(transformed.bundles, hillaJsonTemplateFileName, hillaJsonResultFileName, 'bundles');
  writer.writeSeparateJson(transformed.core, hillaJsonTemplateFileName, hillaJsonResultFileName, 'core');
  writer.writeSeparateJson(transformed.vaadin, hillaJsonTemplateFileName, hillaJsonResultFileName, 'vaadin');
  writer.writeSeparateJson(transformed.react, hillaJsonTemplateFileName, hillaJsonResultFileName, 'react');

  console.log(`Generated ${pathToFileURL(hillaJsonResultFileName).toString()}.`);

  writer.writeReleaseNotes(transformed, releaseNotesTemplateFileName, releaseNotesResultFileName);

  console.log(`Generated ${pathToFileURL(releaseNotesResultFileName).toString()}.`);

  writer.writeReleaseNotes(transformed, releaseNotesMaintenanceTemplateFileName, releaseNotesMaintenanceResultFileName);

  console.log(`Generated ${pathToFileURL(releaseNotesMaintenanceResultFileName).toString()}.`);

  writer.writeReleaseNotes(transformed, releaseNotesPrereleaseTemplateFileName, releaseNotesPrereleaseResultFileName);

  console.log(`Generated ${pathToFileURL(releaseNotesPrereleaseResultFileName).toString()}.`);

  const javaVersion = version.replace('-', '.');
  transformed.core.hilla = { javaVersion };

  // write hilla version to hilla-versions.json as platform
  writer.writeSeparateJson(version, hillaJsonTemplateFileName, hillaJsonResultFileName, 'platform');

  console.log('"hilla-versions.json" and "hilla-react-versions.json" files are updated with the platform version');
}
