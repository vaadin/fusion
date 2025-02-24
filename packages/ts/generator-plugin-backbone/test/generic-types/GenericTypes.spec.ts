/* eslint-disable import/no-extraneous-dependencies */
import sinonChai from 'sinon-chai';
import { chai, describe, expect, it } from 'vitest';
import BackbonePlugin from '../../src/index.js';
import { createGenerator, loadInput, pathBase } from '../utils/common.js';

chai.use(sinonChai);

describe('BackbonePlugin', () => {
  describe('when generic types are used', () => {
    const sectionName = 'GenericTypes';
    const modelSectionPath = `${pathBase}/${sectionName.toLowerCase()}`;

    it('correctly generates code', async () => {
      const generator = createGenerator([BackbonePlugin]);
      const input = await loadInput(sectionName, import.meta.url);
      const files = await generator.process(input);
      expect(files.length).to.equal(2);

      const [endpointFile, entity] = files;
      await expect(await entity.text()).toMatchFileSnapshot('fixtures/GenericTypesEntity.snap.ts');
      await expect(await endpointFile.text()).toMatchFileSnapshot(`fixtures/${sectionName}Endpoint.snap.ts`);
      expect(entity.name).to.equal(`${modelSectionPath}/GenericTypesEntity.ts`);
      expect(endpointFile.name).to.equal(`${sectionName}Endpoint.ts`);
    });
  });
});
