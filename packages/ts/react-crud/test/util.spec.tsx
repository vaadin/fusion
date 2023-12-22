import { expect } from '@esm-bundle/chai';
import { isFilterEmpty } from '../src/util';
import type FilterUnion from '../types/dev/hilla/crud/filter/FilterUnion';
import Matcher from '../types/dev/hilla/crud/filter/PropertyStringFilter/Matcher';

describe('@hilla/react-crud', () => {
  describe('util', () => {
    describe('isFilterEmpty', () => {
      it('returns true when empty', () => {
        const filterEmpty = isFilterEmpty({
          '@type': 'and',
          children: [],
          filterValue: '',
          key: 'inner',
        } as FilterUnion);
        expect(filterEmpty).to.be.true;
      });

      it('returns true when empty with string filter', () => {
        const filterEmpty = isFilterEmpty({
          propertyId: 'name',
          filterValue: '',
          matcher: Matcher.CONTAINS,
          '@type': 'propertyString',
        });
        expect(filterEmpty).to.be.true;
      });

      it('returns false when not empty', () => {
        const filterEmpty = isFilterEmpty({
          propertyId: 'name',
          filterValue: 'not empty',
          matcher: Matcher.CONTAINS,
          '@type': 'propertyString',
        } as FilterUnion);
        expect(filterEmpty).to.be.false;
      });

      it('returns true when all children are empty', () => {
        const filterEmpty = isFilterEmpty({
          '@type': 'and',
          children: [
            {
              '@type': 'and',
              children: [],
              key: 'and1',
            },
            {
              '@type': 'or',
              children: [],
              key: 'and2',
            },
          ],
          filterValue: '',
          key: 'inner',
        } as FilterUnion);
        expect(filterEmpty).to.be.true;
      });

      it('returns true when all children are empty with inner string filter', () => {
        const filterEmpty = isFilterEmpty({
          '@type': 'and',
          children: [
            {
              '@type': 'and',
              children: [],
              key: 'and1',
            },
            {
              '@type': 'or',
              children: [],
              key: 'or1',
            },
            {
              '@type': 'or',
              children: [
                {
                  propertyId: 'name',
                  filterValue: '',
                  matcher: Matcher.CONTAINS,
                  '@type': 'propertyString',
                },
              ],
              key: 'or2',
            },
          ],
          filterValue: '',
          key: 'inner',
        } as FilterUnion);
        expect(filterEmpty).to.be.true;
      });

      it('returns false when some children are not empty', () => {
        const filterEmpty = isFilterEmpty({
          '@type': 'and',
          children: [
            {
              '@type': 'or',
              children: [],
              key: 'or1',
            },
            {
              '@type': 'and',
              children: [
                {
                  propertyId: 'name',
                  filterValue: 'not empty',
                  matcher: Matcher.CONTAINS,
                  '@type': 'propertyString',
                },
              ],
              key: 'and1',
            },
          ],
          filterValue: '',
          key: 'inner',
        } as FilterUnion);
        expect(filterEmpty).to.be.false;
      });

      it('throws error if filter is empty', () => {
        expect(() => {
          isFilterEmpty({} as FilterUnion);
        }).to.throw('Unknown filter type: {}');
      });
    });
  });
});
