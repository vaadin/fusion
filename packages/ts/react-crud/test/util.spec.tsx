import { expect } from 'chai';
import { isFilterEmpty } from '../src/util';
import type FilterUnion from '../types/com/vaadin/flow/spring/data/filter/FilterUnion';
import Matcher from '../types/com/vaadin/flow/spring/data/filter/PropertyStringFilter/Matcher';

describe('@vaadin/hilla-react-crud', () => {
  describe('util', () => {
    describe('isFilterEmpty', () => {
      it('returns true when empty', () => {
        const filterEmpty = isFilterEmpty({
          '@type': 'and',
          children: [],
          filterValue: '',
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
            },
            {
              '@type': 'or',
              children: [],
            },
          ],
          filterValue: '',
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
            },
            {
              '@type': 'or',
              children: [],
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
            },
          ],
          filterValue: '',
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
            },
          ],
          filterValue: '',
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
