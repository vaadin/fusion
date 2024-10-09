/* eslint-disable import/no-extraneous-dependencies */
import snapshotMatcher from '@vaadin/hilla-generator-utils/testing/snapshotMatcher.js';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import BackbonePlugin from '../../src/index.js';
import { createGenerator, loadInput, pathBase } from '../utils/common.js';

use(sinonChai);
use(snapshotMatcher);

describe('BackbonePlugin', () => {
  context('when generic types are used', () => {
    const sectionName = 'GenericTypes';
    const modelSectionPath = `${pathBase}/${sectionName.toLowerCase()}`;

    it('correctly generates code', async () => {
      const generator = createGenerator([BackbonePlugin]);
      const input = await loadInput(sectionName, import.meta.url);
      const files = await generator.process(input);
      expect(files.length).to.equal(2);

      const [endpointFile, entity] = files;
      await expect(await entity.text()).toMatchSnapshot('GenericTypesEntity.snap.ts', import.meta.url);
      await expect(await endpointFile.text()).toMatchSnapshot(`${sectionName}Endpoint.snap.ts`, import.meta.url);
      expect(entity.name).to.equal(`${modelSectionPath}/GenericTypesEntity.ts`);
      expect(endpointFile.name).to.equal(`${sectionName}Endpoint.ts`);
    });
  });
});
