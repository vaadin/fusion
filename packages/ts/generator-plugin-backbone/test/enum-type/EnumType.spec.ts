/* eslint-disable import/no-extraneous-dependencies */
import sinonChai from 'sinon-chai';
import { chai, describe, expect, it } from 'vitest';
import BackbonePlugin from '../../src/index.js';
import { createGenerator, loadInput, pathBase } from '../utils/common.js';

chai.use(sinonChai);

describe('BackbonePlugin', () => {
  describe('when there is an enum entity', () => {
    const sectionName = 'EnumType';
    const modelSectionPath = `${pathBase}/${sectionName.toLowerCase()}/${sectionName}Endpoint`;

    it('correctly generates code', async () => {
      const generator = createGenerator([BackbonePlugin]);
      const input = await loadInput(sectionName, import.meta.url);
      const files = await generator.process(input);
      expect(files.length).to.equal(2);

      const [endpointFile, enumEntity] = files;
      await expect(await endpointFile.text()).toMatchFileSnapshot(`fixtures/${sectionName}Endpoint.snap.ts`);
      await expect(await enumEntity.text()).toMatchFileSnapshot('fixtures/EnumEntity.entity.snap.ts');
      expect(endpointFile.name).to.equal(`${sectionName}Endpoint.ts`);
      expect(enumEntity.name).to.equal(`${modelSectionPath}/EnumEntity.ts`);
    });
  });
});
