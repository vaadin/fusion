/* eslint-disable import/no-extraneous-dependencies */
import BackbonePlugin from '@hilla/generator-typescript-plugin-backbone/index.js';
import snapshotMatcher from '@hilla/generator-typescript-utils/testing/snapshotMatcher.js';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import SubTypesPlugin from '../../src/index.js';
import { createGenerator, loadInput } from '../utils/common.js';

use(sinonChai);
use(snapshotMatcher);

describe('SubTypesPlugin', () => {
  context('when the entity has `oneOf`', () => {
    it('generates as union type', async () => {
      const sectionName = 'SubTypes';
      const generator = createGenerator([BackbonePlugin, SubTypesPlugin]);
      const input = await loadInput(sectionName, import.meta.url);
      const files = await generator.process(input);
      expect(files.length).to.equal(5);

      const t = await files[1].text();
      expect(t).to.exist;

      const endpointFile = files.find((f) => f.name === 'SubTypesEndpoint.ts')!;
      expect(endpointFile).to.exist;
      await expect(await endpointFile.text()).toMatchSnapshot(`${sectionName}Endpoint`, import.meta.url);
      expect(endpointFile.name).to.equal(`${sectionName}Endpoint.ts`);

      const baseEventFile = files.find((f) => f.name === 'dev/hilla/parser/plugins/subtypes/BaseEvent.ts')!;
      expect(baseEventFile).to.exist;
      await expect(await baseEventFile.text()).toMatchSnapshot('BaseEvent', import.meta.url);
      expect(baseEventFile.name).to.equal('dev/hilla/parser/plugins/subtypes/BaseEvent.ts');

      const addEventFile = files.find((f) => f.name === 'dev/hilla/parser/plugins/subtypes/AddEvent.ts')!;
      expect(addEventFile).to.exist;
      await expect(await addEventFile.text()).toMatchSnapshot('AddEvent', import.meta.url);
      expect(addEventFile.name).to.equal('dev/hilla/parser/plugins/subtypes/AddEvent.ts');
    });
  });
});
