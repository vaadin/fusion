import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GridColumn } from '@vaadin/react-components/GridColumn.js';
import { TextField } from '@vaadin/react-components/TextField.js';
import chaiAsPromised from 'chai-as-promised';
import chaiDom from 'chai-dom';
import { useEffect, useRef } from 'react';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { afterEach, beforeEach, chai, describe, expect, it } from 'vitest';
import { AutoGrid, type AutoGridProps, type AutoGridRef } from '../src/autogrid.js';
import type { CountService, CrudService, ListService } from '../src/crud.js';
import type { HeaderFilterRendererProps } from '../src/header-filter.js';
import { LocaleContext } from '../src/locale.js';
import type AndFilter from '../src/types/com/vaadin/hilla/crud/filter/AndFilter.js';
import type FilterUnion from '../src/types/com/vaadin/hilla/crud/filter/FilterUnion.js';
import Matcher from '../src/types/com/vaadin/hilla/crud/filter/PropertyStringFilter/Matcher.js';
import type PropertyStringFilter from '../src/types/com/vaadin/hilla/crud/filter/PropertyStringFilter.js';
import type Sort from '../src/types/com/vaadin/hilla/mappedtypes/Sort.js';
import Direction from '../src/types/org/springframework/data/domain/Sort/Direction.js';
import NullHandling from '../src/types/org/springframework/data/domain/Sort/NullHandling.js';
import GridController from './GridController.js';
import SelectController from './SelectController.js';
import {
  ColumnRendererTestModel,
  columnRendererTestService,
  CompanyModel,
  companyService,
  createService,
  Gender,
  getItem,
  type HasTestInfo,
  type Person,
  personData,
  personListService,
  PersonModel,
  personService,
  PersonWithoutIdPropertyModel,
  PersonWithSimpleIdPropertyModel,
} from './test-models-and-services.js';
import { nextFrame } from './test-utils.js';
import TextFieldController from './TextFieldController.js';

chai.use(sinonChai);
chai.use(chaiDom);
chai.use(chaiAsPromised);

async function assertColumnsOrder(grid: GridController, ...ids: string[]) {
  const columns = await grid.getColumns();
  expect(columns).to.have.length(ids.length);
  await expect(grid.getHeaderCellContents()).to.eventually.deep.equal(GridController.generateColumnHeaders(ids));
}

async function assertColumns(grid: GridController, ...ids: string[]) {
  await assertColumnsOrder(grid, ...ids);
  const columns = await grid.getColumns();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] === '') {
      expect(columns[i].path).to.equal(undefined);
    } else {
      expect(columns[i].path).to.equal(ids[i]);
    }
  }
}

describe('@vaadin/hilla-react-crud', () => {
  describe('Auto grid', () => {
    function TestAutoGridNoHeaderFilters(customProps: Partial<AutoGridProps<Person>>) {
      return <AutoGrid service={personService()} model={PersonModel} headerFilters={false} {...customProps} />;
    }

    function TestAutoGrid(customProps: Partial<AutoGridProps<Person>>) {
      return <AutoGrid service={personService()} model={PersonModel} {...customProps} />;
    }

    let user: ReturnType<(typeof userEvent)['setup']>;

    beforeEach(() => {
      user = userEvent.setup();
      sinon.spy(console, 'error');
    });

    afterEach(() => {
      cleanup();
      sinon.restore();
    });

    describe('basics', () => {
      it('creates columns based on model', async () => {
        const grid = await GridController.init(render(<TestAutoGridNoHeaderFilters />), user);
        await assertColumns(
          grid,
          'firstName',
          'lastName',
          'gender',
          'email',
          'someInteger',
          'someDecimal',
          'vip',
          'birthDate',
          'shiftStart',
          'appointmentTime',
          'address.street',
          'address.city',
          'address.country',
          'department',
        );
      });

      it('can change model and recreate columns', async () => {
        const result = render(<AutoGrid service={personService()} model={PersonModel} />);
        await assertColumns(
          await GridController.init(result, user),
          'firstName',
          'lastName',
          'gender',
          'email',
          'someInteger',
          'someDecimal',
          'vip',
          'birthDate',
          'shiftStart',
          'appointmentTime',
          'address.street',
          'address.city',
          'address.country',
          'department',
        );
        result.rerender(<AutoGrid service={companyService()} model={CompanyModel} />);
        await assertColumns(await GridController.init(result, user), 'name', 'foundedDate');
      });

      it('sorts according to first column by default', async () => {
        const service = personService();
        const grid = await GridController.init(render(<TestAutoGridNoHeaderFilters service={service} />), user);

        const expectedSort: Sort = {
          orders: [
            { property: 'firstName', direction: Direction.ASC, ignoreCase: false, nullHandling: NullHandling.NATIVE },
          ],
        };
        expect(service.lastSort).to.deep.equal(expectedSort);
        await expect(grid.getSortOrder()).to.eventually.deep.equal([
          { property: 'firstName', direction: Direction.ASC },
        ]);
      });

      it('retains sorting when re-rendering', async () => {
        const result = render(<TestAutoGridNoHeaderFilters />);
        const grid = await GridController.init(result, user);

        await grid.sort('lastName', 'desc');
        await expect(grid.getSortOrder()).to.eventually.deep.equal([
          { property: 'lastName', direction: Direction.DESC },
        ]);

        result.rerender(<TestAutoGridNoHeaderFilters />);
        await expect(grid.getSortOrder()).to.eventually.deep.equal([
          { property: 'lastName', direction: Direction.DESC },
        ]);
      });

      it('creates sortable columns', async () => {
        const service = personService();
        const grid = await GridController.init(render(<TestAutoGridNoHeaderFilters service={service} />), user);
        await grid.sort('firstName', 'desc');

        const expectedSort: Sort = {
          orders: [
            { property: 'firstName', direction: Direction.DESC, ignoreCase: false, nullHandling: NullHandling.NATIVE },
          ],
        };
        expect(service.lastSort).to.deep.equal(expectedSort);
        await expect(grid.getSortOrder()).to.eventually.deep.equal([
          { property: 'firstName', direction: Direction.DESC },
        ]);
      });

      it('allows to disable sorting on specific columns', async () => {
        const service = personService();
        const grid = await GridController.init(
          render(<TestAutoGridNoHeaderFilters service={service} columnOptions={{ lastName: { sortable: false } }} />),
          user,
        );

        try {
          await grid.sort('firstName', 'desc');
          await grid.sort('lastName', 'desc');
        } catch (error) {
          expect(error).to.be.an.instanceOf(Error);
          expect((error as Error).message).to.equal('No sorter found for path lastName');
        }
      });

      it('sets a data provider, but only once', async () => {
        const service = personService();
        const result = render(<TestAutoGridNoHeaderFilters service={service} />);
        let grid = await GridController.init(result, user);
        const dp = grid.instance.dataProvider;
        expect(dp).to.not.be.undefined;
        result.rerender(<TestAutoGridNoHeaderFilters service={service} />);
        grid = await GridController.init(result, user);
        expect(dp).to.equal(grid.instance.dataProvider);
      });

      it('data provider provides data', async () => {
        const grid = await GridController.init(render(<TestAutoGridNoHeaderFilters />), user);
        expect(grid.getRowCount()).to.equal(2);
        const firstNameColumnIndex = await grid.findColumnIndexByHeaderText('First name');
        const lastNameColumnIndex = await grid.findColumnIndexByHeaderText('Last name');
        expect(grid.getBodyCellContent(0, firstNameColumnIndex)).to.have.rendered.text('Jane');
        expect(grid.getBodyCellContent(0, lastNameColumnIndex)).to.have.rendered.text('Love');
        expect(grid.getBodyCellContent(1, firstNameColumnIndex)).to.have.rendered.text('John');
        expect(grid.getBodyCellContent(1, lastNameColumnIndex)).to.have.rendered.text('Dove');
      });

      it('does not pass its own parameters to the underlying grid', async () => {
        const grid = await GridController.init(render(<TestAutoGridNoHeaderFilters />), user);
        expect(grid.instance.getAttribute('model')).to.be.null;
        expect(grid.instance.getAttribute('service')).to.be.null;
      });

      it('calls data provider list() only once for initial data', async () => {
        const testService = personService();
        expect(testService.callCount).to.equal(0);
        await GridController.init(render(<AutoGrid service={testService} model={PersonModel} />), user);
        expect(testService.callCount).to.equal(1);
      });

      it('passes filter to the data provider', async () => {
        const filter: PropertyStringFilter = {
          '@type': 'propertyString',
          filterValue: 'Jan',
          matcher: Matcher.CONTAINS,
          propertyId: 'firstName',
        };

        const grid = await GridController.init(render(<TestAutoGrid experimentalFilter={filter} />), user);
        expect(grid.getRowCount()).to.equal(1);
        const firstNameColumnIndex = await grid.findColumnIndexByHeaderText('First name');
        const lastNameColumnIndex = await grid.findColumnIndexByHeaderText('Last name');
        expect(grid.getBodyCellContent(0, firstNameColumnIndex)).to.have.rendered.text('Jane');
        expect(grid.getBodyCellContent(0, lastNameColumnIndex)).to.have.rendered.text('Love');
      });

      describe('Grid item count', () => {
        let autoGridRef: AutoGridRef;

        const AutoGridWithCountAndRefresh = ({ service }: { service: CountService<any> & ListService<any> }) => {
          const ref = useRef<AutoGridRef>(null);
          useEffect(() => {
            if (ref.current) {
              autoGridRef = ref.current;
            }
          }, []);
          return (
            <span>
              <AutoGrid service={service} model={PersonModel} totalCount filteredCount ref={ref} />
            </span>
          );
        };

        it('Works with a larger data set', async () => {
          const service = personService();
          const personTestData: Person[] = Array(387)
            .fill(null)
            .map((i) => ({ ...personData[i % 2], id: i }) satisfies Person);
          sinon.stub(service, 'list').resolves(personTestData);
          sinon.stub(service, 'count').resolves(personTestData.length);
          const result = render(<TestAutoGridNoHeaderFilters service={service} />);
          const grid = await GridController.init(result, user);

          expect(grid.getRowCount()).to.equal(387);
        });

        it('Shows total item count', async () => {
          const service = personService();
          const personTestData: Person[] = Array(387)
            .fill(null)
            .map((i) => ({ ...personData[i % 2], id: i }) satisfies Person);
          sinon.stub(service, 'list').resolves(personTestData);
          sinon.stub(service, 'count').resolves(personTestData.length);
          const result = render(<TestAutoGridNoHeaderFilters service={service} totalCount />);
          const grid = await GridController.init(result, user);

          expect(grid.getRowCount()).to.equal(387);
          await waitFor(() => expect(grid.getFooterCellContent(1, 0)).to.have.rendered.text('Total: 387'));
        });

        it('Shows filtered item count', async () => {
          const service = personService();
          const personTestData: Person[] = Array(156)
            .fill(null)
            .map((i) => ({ ...personData[i % 2], id: i }) satisfies Person);
          sinon.stub(service, 'list').resolves(personTestData);
          sinon.stub(service, 'count').resolves(personTestData.length);
          const result = render(<TestAutoGridNoHeaderFilters service={service} filteredCount />);
          const grid = await GridController.init(result, user);

          expect(grid.getRowCount()).to.equal(156);
          await waitFor(() => expect(grid.getFooterCellContent(1, 0)).to.have.rendered.text('Showing: 156'));
        });

        it('Shows zero as total item count', async () => {
          const service = personService();
          const personTestData: Person[] = [];
          sinon.stub(service, 'list').resolves(personTestData);
          sinon.stub(service, 'count').resolves(personTestData.length);
          const result = render(<TestAutoGridNoHeaderFilters service={service} totalCount />);
          const grid = await GridController.init(result, user);

          expect(grid.getRowCount()).to.equal(0);
          await waitFor(() => expect(grid.getFooterCellContent(1, 0)).to.have.rendered.text('Total: 0'));
        });

        it('Shows zero as filtered item count', async () => {
          const service = personService();
          const personTestData: Person[] = [];
          sinon.stub(service, 'list').resolves(personTestData);
          sinon.stub(service, 'count').resolves(personTestData.length);
          const result = render(<TestAutoGridNoHeaderFilters service={service} filteredCount />);
          const grid = await GridController.init(result, user);

          expect(grid.getRowCount()).to.equal(0);
          await waitFor(() => expect(grid.getFooterCellContent(1, 0)).to.have.rendered.text('Showing: 0'));
        });

        it('Shows zero as total and filtered item count', async () => {
          const service = personService();
          const personTestData: Person[] = [];
          sinon.stub(service, 'list').resolves(personTestData);
          sinon.stub(service, 'count').resolves(personTestData.length);
          const result = render(<TestAutoGridNoHeaderFilters service={service} filteredCount totalCount />);
          const grid = await GridController.init(result, user);

          expect(grid.getRowCount()).to.equal(0);
          await waitFor(() => expect(grid.getFooterCellContent(1, 0)).to.have.rendered.text('Showing: 0 out of 0'));
        });

        it('Shows filtered item count and changes', async () => {
          const service = personService();
          const personTestData: Person[] = Array(387)
            .fill(null)
            .map((i) => ({ ...personData[i % 2], id: i }) satisfies Person);
          const listStub = sinon.stub(service, 'list').resolves(personTestData);
          const countStub = sinon.stub(service, 'count').resolves(personTestData.length);

          const result = render(<TestAutoGrid service={service} model={PersonModel} filteredCount />);
          const grid = await GridController.init(result, user);

          expect(grid.getRowCount()).to.equal(387);
          await waitFor(() => expect(grid.getFooterCellContent(2, 0)).to.have.rendered.text('Showing: 387'));

          sinon.reset();
          listStub.resolves([personTestData[0], personTestData[1]]);
          countStub.resolves(2);

          const firstNameFilterField = grid.getHeaderCellContent(2, 0).querySelector('vaadin-text-field')!;
          firstNameFilterField.value = 'field-value';
          firstNameFilterField.dispatchEvent(new CustomEvent('input'));

          await waitFor(() => expect(grid.getFooterCellContent(2, 0)).to.have.rendered.text('Showing: 2'));
        });

        it('Shows both filtered item count and total item count ', async () => {
          const service = personService();
          const personTestData: Person[] = Array(3)
            .fill(null)
            .map((i) => ({ ...personData[i % 2], id: i }) satisfies Person);
          const listStub = sinon.stub(service, 'list').resolves(personTestData);
          const countStub = sinon.stub(service, 'count');
          countStub.withArgs(undefined).resolves(100);
          countStub.withArgs(sinon.match.defined).resolves(personTestData.length);

          const result = render(<TestAutoGrid service={service} model={PersonModel} totalCount filteredCount />);
          const grid = await GridController.init(result, user);

          expect(grid.getRowCount()).to.equal(3);
          await waitFor(() => expect(grid.getFooterCellContent(2, 0)).to.have.rendered.text('Showing: 3 out of 100'));

          sinon.reset();
          listStub.resolves([personTestData[0], personTestData[1]]);
          countStub.withArgs(undefined).resolves(100);
          countStub.withArgs(sinon.match.defined).resolves(2);

          const firstNameFilterField = grid.getHeaderCellContent(2, 0).querySelector('vaadin-text-field')!;
          firstNameFilterField.value = 'field-value';
          firstNameFilterField.dispatchEvent(new CustomEvent('input'));

          await waitFor(() => expect(grid.getFooterCellContent(2, 0)).to.have.rendered.text('Showing: 2 out of 100'));
        });

        it('Shows custom renderer for total and filtered item count ', async () => {
          const service = personService();
          const personTestData: Person[] = Array(3)
            .fill(null)
            .map((i) => ({ ...personData[i % 2], id: i }) satisfies Person);
          sinon.stub(service, 'list').resolves(personTestData);
          const countStub = sinon.stub(service, 'count');
          countStub.withArgs(undefined).resolves(100);
          countStub.withArgs(sinon.match.defined).resolves(personTestData.length);
          const result = render(
            <TestAutoGridNoHeaderFilters
              service={service}
              filteredCount
              totalCount
              footerCountRenderer={({ filteredCount, totalCount }) => (
                <p>
                  Custom: {filteredCount} / {totalCount}
                </p>
              )}
            />,
          );
          const grid = await GridController.init(result, user);

          expect(grid.getRowCount()).to.equal(3);
          await waitFor(() => expect(grid.getFooterCellContent(1, 0)).to.have.rendered.text('Custom: 3 / 100'));
        });

        it('Shows correct counts after adding and removing an item and calling refresh', async () => {
          const service = personService();
          const result = render(<AutoGridWithCountAndRefresh service={service} />);
          const grid = await GridController.init(result, user);

          expect(grid.getRowCount()).to.equal(2);
          await waitFor(() => expect(grid.getFooterCellContent(2, 0)).to.have.rendered.text('Showing: 2 out of 2'));

          await service.save({ ...personData[0], id: 3 });
          autoGridRef.refresh();
          await nextFrame();

          expect(grid.getRowCount()).to.equal(3);
          await waitFor(() => expect(grid.getFooterCellContent(2, 0)).to.have.rendered.text('Showing: 3 out of 3'));

          await service.delete(3);
          autoGridRef.refresh();
          await nextFrame();

          expect(grid.getRowCount()).to.equal(2);
          await waitFor(() => expect(grid.getFooterCellContent(2, 0)).to.have.rendered.text('Showing: 2 out of 2'));
        });

        it('does not render footer row to display counts when the service does not implement CountService', async () => {
          const service = personListService();
          const personTestData: Person[] = Array(387)
            .fill(null)
            .map((i) => ({ ...personData[i % 2], id: i }) satisfies Person);
          sinon.stub(service, 'list').resolves(personTestData);
          const result = render(<TestAutoGrid service={service} />);
          const grid = await GridController.init(result, user);

          expect(grid.getRowCount()).to.equal(387);
          expect(grid.getFooterRows().length).to.equal(2);
        });

        it('provides error in console when either of totalCount or filterCount are present and the service does not implement CountService', async () => {
          const service = personListService();
          const personTestData: Person[] = Array(3)
            .fill(null)
            .map((i) => ({ ...personData[i % 2], id: i }) satisfies Person);
          sinon.stub(service, 'list').resolves(personTestData);

          const result = render(<TestAutoGrid service={service} model={PersonModel} filteredCount totalCount />);
          await GridController.init(result, user);

          expect(console.error).to.have.been.calledWith(
            '"totalCount" and "filteredCount" props require the provided service to implement the CountService interface.',
          );
        });
      });

      describe('multi-sort', () => {
        let grid: GridController;
        let service: CrudService<Person> & HasTestInfo;

        function TestAutoGridWithMultiSort(customProps: Partial<AutoGridProps<Person>>) {
          return (
            <AutoGrid
              service={personService()}
              model={PersonModel}
              headerFilters={false}
              multiSort
              multiSortPriority="append"
              {...customProps}
            ></AutoGrid>
          );
        }

        beforeEach(async () => {
          service = personService();
          grid = await GridController.init(render(<TestAutoGridWithMultiSort service={service} />), user);
        });

        it('sorts according to first column by default', async () => {
          const expectedSort = {
            orders: [
              { property: 'firstName', direction: Direction.ASC, ignoreCase: false, nullHandling: NullHandling.NATIVE },
            ],
          };
          expect(service.lastSort).to.deep.equal(expectedSort);

          await expect(grid.getSortOrder()).to.eventually.deep.equal([
            { property: 'firstName', direction: Direction.ASC },
          ]);
        });

        it('sorts by multiple columns', async () => {
          await grid.sort('lastName', 'asc');
          expect(service.lastSort).to.deep.equal({
            orders: [
              { property: 'firstName', direction: Direction.ASC, ignoreCase: false, nullHandling: NullHandling.NATIVE },
              { property: 'lastName', direction: Direction.ASC, ignoreCase: false, nullHandling: NullHandling.NATIVE },
            ],
          });

          await expect(grid.getSortOrder()).to.eventually.deep.equal([
            { property: 'firstName', direction: Direction.ASC },
            { property: 'lastName', direction: Direction.ASC },
          ]);

          await grid.sort('lastName', 'desc');
          expect(service.lastSort).to.deep.equal({
            orders: [
              { property: 'firstName', direction: Direction.ASC, ignoreCase: false, nullHandling: NullHandling.NATIVE },
              { property: 'lastName', direction: Direction.DESC, ignoreCase: false, nullHandling: NullHandling.NATIVE },
            ],
          });

          await expect(grid.getSortOrder()).to.eventually.deep.equal([
            { property: 'firstName', direction: Direction.ASC },
            { property: 'lastName', direction: Direction.DESC },
          ]);

          await grid.sort('lastName', null);
          expect(service.lastSort).to.deep.equal({
            orders: [
              { property: 'firstName', direction: Direction.ASC, ignoreCase: false, nullHandling: NullHandling.NATIVE },
            ],
          });

          await expect(grid.getSortOrder()).to.eventually.deep.equal([
            { property: 'firstName', direction: Direction.ASC },
          ]);
        });
      });

      describe('header filters', () => {
        let clock: sinon.SinonFakeTimers;

        beforeEach(() => {
          clock = sinon.useFakeTimers({ shouldAdvanceTime: true });
        });

        afterEach(() => {
          clock.restore();
        });

        it('created for string columns', async () => {
          const grid = await GridController.init(render(<TestAutoGrid />), user);
          const cell = grid.getHeaderCellContent(1, 0);
          expect(cell.querySelector('vaadin-text-field')).to.exist;
        });

        it('created for number columns', async () => {
          const grid = await GridController.init(render(<TestAutoGrid />), user);
          const cell = grid.getHeaderCellContent(1, 4);
          expect(cell.querySelector('vaadin-select')).to.exist;
        });

        it('filter comparison options changes based on type', async () => {
          const grid = await GridController.init(
            render(<TestAutoGrid visibleColumns={['someInteger', 'someDecimal', 'birthDate', 'shiftStart']} />),
            user,
          );
          // Number type
          await user.click(grid.getHeaderCellContent(1, 0).querySelector('vaadin-select-value-button')!);
          let findResult = await screen.findByText('> Greater than');
          let filterOptions = findResult.closest('vaadin-select-overlay')!.querySelectorAll('vaadin-item');
          expect(filterOptions).to.have.length(3);
          expect(filterOptions[1]).to.have.rendered.text('< Less than');

          await user.keyboard('{Escape}');

          // Date type
          await user.click(grid.getHeaderCellContent(1, 2).querySelector('vaadin-select-value-button')!);
          // When the previous filter options is closing, for a short period of time there are two overlays in the DOM
          // (because of animation), and to avoid selecting the wrong one, we need to first find the correct text and
          // go up in the DOM to find the correct overlay.
          findResult = await screen.findByText('> After');
          filterOptions = findResult.closest('vaadin-select-overlay')!.querySelectorAll('vaadin-item');
          expect(filterOptions).to.have.length(3);
          expect(filterOptions[1]).to.have.rendered.text('< Before');

          await user.keyboard('{Escape}');

          // Time type
          await user.click(grid.getHeaderCellContent(1, 3).querySelector('vaadin-select-value-button')!);
          findResult = await screen.findByText('> After');
          filterOptions = findResult.closest('vaadin-select-overlay')!.querySelectorAll('vaadin-item');
          expect(filterOptions).to.have.length(3);
          expect(filterOptions[1]).to.have.rendered.text('< Before');
        });

        it('filter when you type in the field for a string column', async () => {
          const service = personService();
          const grid = await GridController.init(render(<TestAutoGrid service={service} />), user);

          const firstNameFilterField = grid.getHeaderCellContent(1, 0).querySelector('vaadin-text-field')!;
          firstNameFilterField.value = 'filter-value';
          firstNameFilterField.dispatchEvent(new CustomEvent('input'));
          await clock.tickAsync(200);

          const expectedPropertyFilter: FilterUnion = {
            '@type': 'propertyString',
            filterValue: 'filter-value',
            propertyId: 'firstName',
            key: 'firstName',
            matcher: Matcher.CONTAINS,
          };
          const expectedFilter: AndFilter = { '@type': 'and', children: [expectedPropertyFilter] };
          expect(service.lastFilter).to.deep.equal(expectedFilter);
        });

        it('filter when you type in the field for a number column', async () => {
          const service = personService();
          const grid = await GridController.init(render(<TestAutoGrid service={service} />), user);
          const someNumberFilter = grid.getHeaderCellContent(1, 4);
          const [someNumberFilterField, someNumberFieldSelect] = await Promise.all([
            TextFieldController.initByParent(someNumberFilter, user, 'vaadin-number-field'),
            SelectController.init(someNumberFilter, user),
          ]);
          await someNumberFilterField.type('123');
          await clock.tickAsync(200);

          const expectedPropertyFilter: FilterUnion = {
            '@type': 'propertyString',
            filterValue: '123',
            propertyId: 'someInteger',
            key: 'someInteger',
            matcher: Matcher.GREATER_THAN,
          };
          const expectedFilter: AndFilter = { '@type': 'and', children: [expectedPropertyFilter] };
          expect(service.lastFilter).to.deep.equal(expectedFilter);

          await someNumberFieldSelect.select(Matcher.EQUALS);

          const expectedPropertyFilter2: FilterUnion = {
            '@type': 'propertyString',
            filterValue: '123',
            propertyId: 'someInteger',
            key: 'someInteger',
            matcher: Matcher.EQUALS,
          };

          const expectedFilter2: AndFilter = { '@type': 'and', children: [expectedPropertyFilter2] };
          expect(service.lastFilter).to.deep.equal(expectedFilter2);
        });

        it('filters for a boolean column', async () => {
          const service = personService();
          const grid = await GridController.init(render(<TestAutoGrid service={service} />), user);
          const controller = await SelectController.init(grid.getHeaderCellContent(1, 6), user);
          await controller.select('True');

          const expectedPropertyFilter: FilterUnion = {
            '@type': 'propertyString',
            filterValue: 'True',
            propertyId: 'vip',
            matcher: Matcher.EQUALS,
            key: 'vip',
          };
          const expectedFilter: AndFilter = { '@type': 'and', children: [expectedPropertyFilter] };
          expect(service.lastFilter).to.deep.equal(expectedFilter);

          await controller.select('False');

          const expectedPropertyFilter2: FilterUnion = {
            '@type': 'propertyString',
            filterValue: 'False',
            propertyId: 'vip',
            matcher: Matcher.EQUALS,
            key: 'vip',
          };
          const expectedFilter2: AndFilter = { '@type': 'and', children: [expectedPropertyFilter2] };
          expect(service.lastFilter).to.deep.equal(expectedFilter2);
        });

        it('filters for an enum column', async () => {
          const service = personService();
          const grid = await GridController.init(render(<TestAutoGrid service={service} />), user);
          const controller = await SelectController.init(grid.getHeaderCellContent(1, 2), user);
          await controller.select(Gender.MALE);

          const expectedPropertyFilter: FilterUnion = {
            '@type': 'propertyString',
            filterValue: Gender.MALE,
            propertyId: 'gender',
            matcher: Matcher.EQUALS,
            key: 'gender',
          };
          const expectedFilter: AndFilter = { '@type': 'and', children: [expectedPropertyFilter] };
          expect(service.lastFilter).to.deep.equal(expectedFilter);

          await controller.select(Gender.FEMALE);

          const expectedPropertyFilter2: FilterUnion = {
            '@type': 'propertyString',
            filterValue: Gender.FEMALE,
            propertyId: 'gender',
            matcher: Matcher.EQUALS,
            key: 'gender',
          };
          const expectedFilter2: AndFilter = { '@type': 'and', children: [expectedPropertyFilter2] };
          expect(service.lastFilter).to.deep.equal(expectedFilter2);
        });

        it('filter for nested properties that are not included by default', async () => {
          const service = personService();
          const grid = await GridController.init(
            render(<TestAutoGrid service={service} visibleColumns={['department.name']} />),
            user,
          );

          const departmentNameField = grid.getHeaderCellContent(1, 0).querySelector('vaadin-text-field')!;
          departmentNameField.value = 'filter-value';
          departmentNameField.dispatchEvent(new CustomEvent('input'));
          await clock.tickAsync(200);

          const expectedPropertyFilter: FilterUnion = {
            '@type': 'propertyString',
            filterValue: 'filter-value',
            propertyId: 'department.name',
            matcher: Matcher.CONTAINS,
            key: 'department.name',
          };
          const expectedFilter: AndFilter = { '@type': 'and', children: [expectedPropertyFilter] };
          expect(service.lastFilter).to.deep.equal(expectedFilter);
        });

        it('does not show a filter for object column', async () => {
          const service = personService();
          const grid = await GridController.init(
            render(<TestAutoGrid service={service} visibleColumns={['address', 'department']} />),
            user,
          );

          expect(grid.getHeaderCellContent(1, 0).childElementCount).to.equal(0);
          expect(grid.getHeaderCellContent(1, 1).childElementCount).to.equal(0);
        });

        it('can be disabled on specific columns', async () => {
          const service = personService();
          const grid = await GridController.init(
            render(
              <TestAutoGrid
                service={service}
                visibleColumns={['firstName', 'lastName']}
                columnOptions={{ lastName: { filterable: false } }}
              />,
            ),
            user,
          );

          expect(grid.getHeaderCellContent(1, 0).childElementCount).to.be.greaterThan(0);
          expect(grid.getHeaderCellContent(1, 1).childElementCount).to.equal(0);
        });

        it('combine filters (and) when you type in multiple fields', async () => {
          const service = personService();
          const grid = await GridController.init(render(<TestAutoGrid service={service} />), user);
          const firstNameFilterField = await TextFieldController.initByParent(grid.getHeaderCellContent(1, 0), user);
          await firstNameFilterField.type('filterFirst');
          const lastNameFilterField = await TextFieldController.initByParent(grid.getHeaderCellContent(1, 1), user);
          await lastNameFilterField.type('filterLast');
          await clock.tickAsync(200);

          const expectedFirstNameFilter: FilterUnion = {
            '@type': 'propertyString',
            filterValue: 'filterFirst',
            propertyId: 'firstName',
            matcher: Matcher.CONTAINS,
            key: 'firstName',
          };
          const expectedLastNameFilter: FilterUnion = {
            '@type': 'propertyString',
            filterValue: 'filterLast',
            propertyId: 'lastName',
            matcher: Matcher.CONTAINS,
            key: 'lastName',
          };
          const expectedFilter: AndFilter = {
            '@type': 'and',
            children: [expectedFirstNameFilter, expectedLastNameFilter],
          };
          expect(service.lastFilter).to.deep.equal(expectedFilter);
        });
        it('removes filters if turning header filters off', async () => {
          const service = personService();
          const result = render(<TestAutoGrid service={service} model={PersonModel} />);
          let grid = await GridController.init(result, user);
          expect(grid.getHeaderRows().length).to.equal(2);

          const companyNameFilter = await TextFieldController.initByParent(grid.getHeaderCellContent(1, 0), user);
          await companyNameFilter.type('Joh');
          await clock.tickAsync(200);

          const filter: FilterUnion = {
            '@type': 'propertyString',
            filterValue: 'Joh',
            matcher: Matcher.CONTAINS,
            propertyId: 'firstName',
            key: 'firstName',
          };
          const expectedFilter1: AndFilter = {
            '@type': 'and',
            children: [filter],
          };
          expect(service.lastFilter).to.deep.equal(expectedFilter1);

          result.rerender(<AutoGrid service={service} model={PersonModel} headerFilters={false} />);
          grid = await GridController.init(result, user);
          expect(grid.getHeaderRows().length).to.equal(1);

          const expectedFilter2: AndFilter = {
            '@type': 'and',
            children: [],
          };
          expect(service.lastFilter).to.deep.equal(expectedFilter2);
        });

        it('disables header filters when deprecated noHeaderFilters is true', async () => {
          const service = personService();
          const grid = await GridController.init(
            render(<TestAutoGrid service={service} model={PersonModel} noHeaderFilters />),
            user,
          );
          expect(grid.getHeaderRows().length).to.equal(1);
        });

        it('gives priority to headerFilters over deprecated noHeaderFilters', async () => {
          const service = personService();
          const grid = await GridController.init(
            render(<TestAutoGrid service={service} model={PersonModel} headerFilters={true} noHeaderFilters />),
            user,
          );
          expect(grid.getHeaderRows().length).to.equal(2);
        });

        it('filters correctly after changing model', async () => {
          const _personService = personService();
          const _companyService = companyService();

          const result = render(<AutoGrid service={_personService} model={PersonModel} />);
          await GridController.init(result, user);
          result.rerender(<AutoGrid service={_companyService} model={CompanyModel} />);
          const grid = await GridController.init(result, user);

          const companyNameFilter = await TextFieldController.initByParent(grid.getHeaderCellContent(1, 0), user);
          await companyNameFilter.type('vaad');

          await clock.tickAsync(200);

          const expectedPropertyFilter: FilterUnion = {
            '@type': 'propertyString',
            filterValue: 'vaad',
            propertyId: 'name',
            matcher: Matcher.CONTAINS,
            key: 'name',
          };
          const expectedFilter: AndFilter = { '@type': 'and', children: [expectedPropertyFilter] };
          expect(_personService.lastFilter).to.deep.equal(expectedFilter);
        });

        it('shows custom placeholder of filter', async () => {
          const grid = await GridController.init(
            render(
              <TestAutoGrid
                columnOptions={{
                  firstName: { filterPlaceholder: 'Custom placeholder' },
                  someInteger: { filterPlaceholder: 'Custom placeholder' },
                  birthDate: { filterPlaceholder: 'Custom placeholder' },
                  shiftStart: { filterPlaceholder: 'Custom placeholder' },
                }}
              />,
            ),
            user,
          );

          const firstNameFilterField = grid.getHeaderCellContent(1, 0).querySelector('vaadin-text-field')!;
          expect(firstNameFilterField.placeholder).to.deep.equal('Custom placeholder');
          const someIntegerFilterField = grid.getHeaderCellContent(1, 4).querySelector('vaadin-number-field')!;
          expect(someIntegerFilterField.placeholder).to.deep.equal('Custom placeholder');
          const birthDateFilterField = grid.getHeaderCellContent(1, 7).querySelector('vaadin-date-picker')!;
          expect(birthDateFilterField.placeholder).to.deep.equal('Custom placeholder');
          const shiftStartFilterField = grid.getHeaderCellContent(1, 8).querySelector('vaadin-time-picker')!;
          expect(shiftStartFilterField.placeholder).to.deep.equal('Custom placeholder');
        });

        it('waits custom debounce time to filter string column', async () => {
          const service = personService();
          const grid = await GridController.init(
            render(<TestAutoGrid columnOptions={{ firstName: { filterDebounceTime: 1000 } }} service={service} />),
            user,
          );

          const firstNameFilterField = grid.getHeaderCellContent(1, 0).querySelector('vaadin-text-field')!;
          firstNameFilterField.value = 'filter-value';
          firstNameFilterField.dispatchEvent(new CustomEvent('input'));

          expect(service.lastFilter).to.deep.equal({ '@type': 'and', children: [] });
          await clock.tickAsync(500);
          expect(service.lastFilter).to.deep.equal({ '@type': 'and', children: [] });
          await clock.tickAsync(500);

          const expectedPropertyFilter: FilterUnion = {
            '@type': 'propertyString',
            filterValue: 'filter-value',
            propertyId: 'firstName',
            matcher: Matcher.CONTAINS,
            key: 'firstName',
          };
          const expectedFilter: AndFilter = { '@type': 'and', children: [expectedPropertyFilter] };
          expect(service.lastFilter).to.deep.equal(expectedFilter);
        });

        it('waits custom debounce time to filter number column', async () => {
          const service = personService();
          const grid = await GridController.init(
            render(<TestAutoGrid columnOptions={{ someInteger: { filterDebounceTime: 1000 } }} service={service} />),
            user,
          );

          const someNumberFilter = grid.getHeaderCellContent(1, 4);
          const [someNumberFilterField] = await Promise.all([
            TextFieldController.initByParent(someNumberFilter, user, 'vaadin-number-field'),
            SelectController.init(someNumberFilter, user),
          ]);
          await someNumberFilterField.type('123');

          expect(service.lastFilter).to.deep.equal({ '@type': 'and', children: [] });
          await clock.tickAsync(500);
          expect(service.lastFilter).to.deep.equal({ '@type': 'and', children: [] });
          await clock.tickAsync(500);

          const expectedPropertyFilter: FilterUnion = {
            '@type': 'propertyString',
            filterValue: '123',
            propertyId: 'someInteger',
            matcher: Matcher.GREATER_THAN,
            key: 'someInteger',
          };
          const expectedFilter: AndFilter = { '@type': 'and', children: [expectedPropertyFilter] };
          expect(service.lastFilter).to.deep.equal(expectedFilter);
          clock.restore();
        });

        it('filters with custom min length of filter and clears filter', async () => {
          const service = personService();
          const grid = await GridController.init(
            render(<TestAutoGrid columnOptions={{ firstName: { filterMinLength: 3 } }} service={service} />),
            user,
          );

          const firstNameFilterField = grid.getHeaderCellContent(1, 0).querySelector('vaadin-text-field')!;
          firstNameFilterField.value = 'fi';
          firstNameFilterField.dispatchEvent(new CustomEvent('input'));
          await clock.tickAsync(200);

          expect(service.lastFilter).to.deep.equal({ '@type': 'and', children: [] });

          firstNameFilterField.value = 'filter-value';
          firstNameFilterField.dispatchEvent(new CustomEvent('input'));
          await clock.tickAsync(200);

          const expectedPropertyFilter: FilterUnion = {
            '@type': 'propertyString',
            filterValue: 'filter-value',
            propertyId: 'firstName',
            matcher: Matcher.CONTAINS,
            key: 'firstName',
          };
          const expectedFilter: AndFilter = { '@type': 'and', children: [expectedPropertyFilter] };
          expect(service.lastFilter).to.deep.equal(expectedFilter);

          firstNameFilterField.value = 'fi';
          firstNameFilterField.dispatchEvent(new CustomEvent('input'));
          await clock.tickAsync(200);

          expect(service.lastFilter).to.deep.equal({ '@type': 'and', children: [] });
        });

        it('removes the filters when you clear the fields', async () => {
          const service = personService();
          const grid = await GridController.init(render(<TestAutoGrid service={service} />), user);
          const [firstNameFilter, lastNameFilter] = await Promise.all([
            TextFieldController.initByParent(grid.getHeaderCellContent(1, 0), user),
            TextFieldController.initByParent(grid.getHeaderCellContent(1, 1), user),
          ]);
          await firstNameFilter.type('filterFirst');
          await clock.tickAsync(200);
          await lastNameFilter.type('filterLast');
          await clock.tickAsync(200);

          const expectedFilter: AndFilter = {
            '@type': 'and',
            children: [],
          };
          expect(service.lastFilter).not.to.deep.equal(expectedFilter);

          await firstNameFilter.type('[Delete]');
          await clock.tickAsync(200);
          await lastNameFilter.type('[Delete]');
          await clock.tickAsync(200);
          expect(service.lastFilter).to.deep.equal(expectedFilter);
        });

        it('renders header filter with custom renderer', async () => {
          const grid = await GridController.init(
            render(
              <TestAutoGrid
                columnOptions={{
                  firstName: {
                    headerFilterRenderer: () => <TextField placeholder="Custom filter"></TextField>,
                  },
                }}
              />,
            ),
            user,
          );

          const firstNameFilterField = grid.getHeaderCellContent(1, 0).querySelector('vaadin-text-field')!;
          expect(firstNameFilterField.placeholder).to.deep.equal('Custom filter');
        });

        // eslint-disable-next-line @typescript-eslint/unbound-method
        const CustomFirstNameFilterRenderer = ({ setFilter }: HeaderFilterRendererProps) => (
          <TextField
            id="firstNameFilter"
            placeholder="Custom filter"
            onValueChanged={({ detail: { value } }) => {
              const firstNameFilter = {
                '@type': 'propertyString',
                propertyId: 'firstName',
                matcher: 'CONTAINS',
                filterValue: value,
              };
              const firstNameUpperCasedFilter = {
                '@type': 'propertyString',
                propertyId: 'firstName',
                matcher: 'CONTAINS',
                filterValue: value.toUpperCase(),
              };

              const filter: FilterUnion = {
                '@type': 'or',
                children: [firstNameFilter, firstNameUpperCasedFilter],
                key: 'firstName',
              };

              setFilter(filter as FilterUnion);
            }}
          ></TextField>
        );

        it('renders header filter with custom renderer', async () => {
          const service = personService();

          const grid = await GridController.init(
            render(
              <TestAutoGrid
                service={service}
                columnOptions={{
                  firstName: {
                    headerFilterRenderer: CustomFirstNameFilterRenderer,
                  },
                }}
              />,
            ),
            user,
          );

          const firstNameFilterField = grid.getHeaderCellContent(1, 0).querySelector('vaadin-text-field')!;
          expect(firstNameFilterField.placeholder).to.deep.equal('Custom filter');

          await grid.typeInHeaderFilter(1, 0, 'filter-value', clock);

          const expectedFirstNameFilter = {
            '@type': 'propertyString',
            propertyId: 'firstName',
            matcher: 'CONTAINS',
            filterValue: 'filter-value',
          };
          const expectedFirstNameUpperCasedFilter = {
            '@type': 'propertyString',
            propertyId: 'firstName',
            matcher: 'CONTAINS',
            filterValue: 'FILTER-VALUE',
          };

          const expectedOrFilter: FilterUnion = {
            '@type': 'or',
            children: [expectedFirstNameFilter, expectedFirstNameUpperCasedFilter],
            key: 'firstName',
          };

          expect(service.lastFilter).to.deep.equal({ '@type': 'and', children: [expectedOrFilter] });
        });
      });
    });

    describe('customize columns', () => {
      it('should only show configured columns in specified order', async () => {
        const grid = await GridController.init(render(<TestAutoGrid visibleColumns={['email', 'firstName']} />), user);
        await assertColumns(grid, 'email', 'firstName');
      });

      it('should show columns that would be excluded by default', async () => {
        const grid = await GridController.init(render(<TestAutoGrid visibleColumns={['id', 'version']} />), user);
        await assertColumns(grid, 'id', 'version');
      });

      it('should show columns for nested properties that are not included by default', async () => {
        const grid = await GridController.init(render(<TestAutoGrid visibleColumns={['department.name']} />), user);
        await assertColumns(grid, 'department.name');
        expect(grid.getBodyCellContent(0, 0)).to.have.rendered.text('IT');
      });

      it('should ignore unknown columns when using visibleColumns', async () => {
        const grid = await GridController.init(
          render(
            <TestAutoGrid visibleColumns={['foo', 'email', 'bar', 'firstName', 'address.foo', 'department.foo']} />,
          ),
          user,
        );
        await assertColumns(grid, 'email', 'firstName');
      });

      it('should hide columns and keep default order', async () => {
        const grid = await GridController.init(
          render(<TestAutoGrid hiddenColumns={['gender', 'birthDate', 'address.country']} />),
          user,
        );
        await assertColumns(
          grid,
          'firstName',
          'lastName',
          'email',
          'someInteger',
          'someDecimal',
          'vip',
          'shiftStart',
          'appointmentTime',
          'address.street',
          'address.city',
          'department',
        );
      });

      it('should ignore unknown columns when using hiddenColumns', async () => {
        const grid = await GridController.init(
          render(
            <TestAutoGrid hiddenColumns={['foo', 'gender', 'bar', 'birthDate', 'address.foo', 'department.foo']} />,
          ),
          user,
        );
        await assertColumns(
          grid,
          'firstName',
          'lastName',
          'email',
          'someInteger',
          'someDecimal',
          'vip',
          'shiftStart',
          'appointmentTime',
          'address.street',
          'address.city',
          'address.country',
          'department',
        );
      });

      it('uses custom column options on top of the type defaults', async () => {
        const NameRenderer = ({ item }: { item: Person }): React.JSX.Element => (
          <span>{item.firstName.toUpperCase()}</span>
        );
        const StreetRenderer = ({ item }: { item: Person }): React.JSX.Element => (
          <span>{item.address?.street.toUpperCase()}</span>
        );
        const grid = await GridController.init(
          render(
            <TestAutoGrid
              columnOptions={{
                firstName: { renderer: NameRenderer },
                'address.street': { renderer: StreetRenderer },
              }}
            />,
          ),
          user,
        );
        await assertColumns(
          grid,
          'firstName',
          'lastName',
          'gender',
          'email',
          'someInteger',
          'someDecimal',
          'vip',
          'birthDate',
          'shiftStart',
          'appointmentTime',
          'address.street',
          'address.city',
          'address.country',
          'department',
        );
        expect(grid.getBodyCellContent(0, 0)).to.have.rendered.text('JANE');
        expect(grid.getBodyCellContent(0, 1)).to.have.rendered.text('Love');
        expect(grid.getBodyCellContent(0, 10)).to.have.rendered.text('122 SOUTH STREET');
        expect(grid.getBodyCellContent(0, 11)).to.have.rendered.text('South Town');
        // The header filter was not overridden
        const cell = grid.getHeaderCellContent(1, 0);
        expect(cell.firstElementChild!.querySelector('vaadin-text-field')).to.exist;
      });

      it('respects the header setting from custom column options', async () => {
        // With header filters
        let result = render(<TestAutoGrid columnOptions={{ firstName: { header: 'FIRSTNAME' } }} />);
        let grid = await GridController.init(result, user);
        expect(grid.getHeaderCellContent(0, 0).innerText).to.equal('FIRSTNAME');

        // Without header filters
        result.unmount();
        result = render(<TestAutoGrid headerFilters={false} columnOptions={{ firstName: { header: 'FIRSTNAME' } }} />);
        grid = await GridController.init(result, user);
        expect(grid.getHeaderCellContent(0, 0).innerText).to.equal('FIRSTNAME');
      });

      it('renders row numbers if requested', async () => {
        const grid = await GridController.init(render(<TestAutoGrid rowNumbers />), user);
        await assertColumns(
          grid,
          '',
          'firstName',
          'lastName',
          'gender',
          'email',
          'someInteger',
          'someDecimal',
          'vip',
          'birthDate',
          'shiftStart',
          'appointmentTime',
          'address.street',
          'address.city',
          'address.country',
          'department',
        );
        expect(grid.getBodyCellContent(0, 0)).to.have.rendered.text('1');
        expect(grid.getBodyCell(0, 0).style.flexGrow).to.equal('0');
      });
    });

    describe('custom columns', () => {
      const FullNameRenderer = ({ item }: { item: Person }): React.JSX.Element => (
        <span>
          {item.firstName} {item.lastName}
        </span>
      );
      const FullNameHyphenRenderer = ({ item }: { item: Person }): React.JSX.Element => (
        <span>
          {item.firstName}-{item.lastName}
        </span>
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const FullNameFilterRenderer = ({ setFilter }: HeaderFilterRendererProps) => (
        <TextField
          id="full-name-filter"
          placeholder="Custom filter"
          onValueChanged={({ detail: { value } }) => {
            const firstNameFilter = {
              '@type': 'propertyString',
              propertyId: 'firstName',
              matcher: 'CONTAINS',
              filterValue: value,
            };
            const lastNameFilter = {
              '@type': 'propertyString',
              propertyId: 'lastName',
              matcher: 'CONTAINS',
              filterValue: value,
            };

            const filter: FilterUnion = {
              '@type': 'or',
              children: [firstNameFilter, lastNameFilter],
              key: 'fullName',
            };

            setFilter(filter as FilterUnion);
          }}
        ></TextField>
      );

      it('renders custom columns at the specified index by visibleColumns', async () => {
        const grid = await GridController.init(
          render(
            <TestAutoGrid
              headerFilters={false}
              visibleColumns={['fullName', 'gender', 'email', 'secondFullName', 'vip', 'birthDate', 'shiftStart']}
              customColumns={[
                <GridColumn key="fullName" header="Full name" autoWidth renderer={FullNameRenderer}></GridColumn>,
                <GridColumn
                  key="secondFullName"
                  header="Second full name"
                  autoWidth
                  renderer={FullNameHyphenRenderer}
                ></GridColumn>,
              ]}
            />,
          ),
          user,
        );
        await assertColumnsOrder(
          grid,
          'fullName',
          'gender',
          'email',
          'secondFullName',
          'vip',
          'birthDate',
          'shiftStart',
        );
        expect(grid.getBodyCellContent(0, 0)).to.have.rendered.text('Jane Love');
        expect(grid.getBodyCellContent(0, 3)).to.have.rendered.text('Jane-Love');
      });

      it('renders custom columns at the end if visibleColumns is absent', async () => {
        const grid = await GridController.init(
          render(
            <TestAutoGrid
              headerFilters={false}
              customColumns={[
                <GridColumn key="fullName" header="Full name" autoWidth renderer={FullNameRenderer}></GridColumn>,
                <GridColumn
                  key="secondFullName"
                  header="Second full name"
                  autoWidth
                  renderer={FullNameHyphenRenderer}
                ></GridColumn>,
              ]}
            />,
          ),
          user,
        );
        await assertColumnsOrder(
          grid,
          'firstName',
          'lastName',
          'gender',
          'email',
          'someInteger',
          'someDecimal',
          'vip',
          'birthDate',
          'shiftStart',
          'appointmentTime',
          'address.street',
          'address.city',
          'address.country',
          'department',
          'fullName',
          'secondFullName',
        );
        expect(grid.getBodyCellContent(0, 14)).to.have.rendered.text('Jane Love');
        expect(grid.getBodyCellContent(0, 15)).to.have.rendered.text('Jane-Love');
      });

      it('if visibleColumns is present, renders only the custom columns listed in visibleColumns', async () => {
        const grid = await GridController.init(
          render(
            <TestAutoGrid
              headerFilters={false}
              visibleColumns={['fullName', 'gender', 'email', 'vip', 'birthDate', 'shiftStart']}
              customColumns={[
                <GridColumn key="fullName" header="Full name" autoWidth renderer={FullNameRenderer}></GridColumn>,
                <GridColumn
                  key="secondFullName"
                  header="Second full name"
                  autoWidth
                  renderer={FullNameHyphenRenderer}
                ></GridColumn>,
              ]}
            />,
          ),
          user,
        );
        await assertColumnsOrder(grid, 'fullName', 'gender', 'email', 'vip', 'birthDate', 'shiftStart');
        expect(grid.getBodyCellContent(0, 0)).to.have.rendered.text('Jane Love');
      });

      it('should hide configured columns and render remaining columns including custom columns at the end', async () => {
        const grid = await GridController.init(
          render(
            <TestAutoGrid
              headerFilters={false}
              hiddenColumns={[
                'email',
                'someInteger',
                'someDecimal',
                'vip',
                'shiftStart',
                'appointmentTime',
                'address.street',
                'address.city',
                'address.country',
                'department',
                'secondFullName',
              ]}
              customColumns={[
                <GridColumn key="fullName" header="Full name" autoWidth renderer={FullNameRenderer}></GridColumn>,
                <GridColumn
                  key="secondFullName"
                  header="Second full name"
                  autoWidth
                  renderer={FullNameHyphenRenderer}
                ></GridColumn>,
              ]}
            />,
          ),
          user,
        );
        await assertColumnsOrder(grid, 'firstName', 'lastName', 'gender', 'birthDate', 'fullName');
        expect(grid.getBodyCellContent(0, 4)).to.have.rendered.text('Jane Love');
      });

      describe('with header filters', () => {
        let clock: sinon.SinonFakeTimers;

        beforeEach(() => {
          clock = sinon.useFakeTimers({ shouldAdvanceTime: true });
        });

        afterEach(() => {
          clock.restore();
        });

        it('wraps custom columns in a column group and moves header text', async () => {
          const grid = await GridController.init(
            render(
              <TestAutoGrid
                visibleColumns={['fullName']}
                customColumns={[
                  <GridColumn key="fullName" header="Full name" autoWidth renderer={FullNameRenderer}></GridColumn>,
                ]}
              />,
            ),
            user,
          );
          // Group header row has header text
          expect(grid.getHeaderCellContent(0, 0)).to.have.rendered.text('Full name');
          // Column header row is empty
          expect(grid.getHeaderCellContent(1, 0)).to.be.rendered.empty;
          expect(grid.getHeaderCellContent(1, 0)).to.be.rendered.text('');
        });

        it('renders custom column with header without key property', async () => {
          const grid = await GridController.init(
            render(
              <TestAutoGrid
                customColumns={[<GridColumn header="Full Name" autoWidth renderer={FullNameRenderer}></GridColumn>]}
              />,
            ),
            user,
          );

          const firstNameFilterField = grid.getHeaderCellContent(0, 14);
          expect(firstNameFilterField).to.have.rendered.text('Full Name');
        });

        it('wraps custom columns in a column group and moves header renderer', async () => {
          function HeaderRenderer() {
            return <span>Full name</span>;
          }

          const grid = await GridController.init(
            render(
              <TestAutoGrid
                visibleColumns={['fullName']}
                customColumns={[
                  <GridColumn
                    key="fullName"
                    headerRenderer={HeaderRenderer}
                    autoWidth
                    renderer={FullNameRenderer}
                  ></GridColumn>,
                ]}
              />,
            ),
            user,
          );
          // Group header row has header text
          expect(grid.getHeaderCellContent(0, 0)).to.have.rendered.text('Full name');
          // Column header row is empty
          expect(grid.getHeaderCellContent(1, 0)).to.be.rendered.empty;
          expect(grid.getHeaderCellContent(1, 0)).to.be.rendered.text('');
        });

        it('renders custom column header filter with custom renderers', async () => {
          const grid = await GridController.init(
            render(
              <TestAutoGrid
                visibleColumns={['fullName']}
                customColumns={[<GridColumn key="fullName" autoWidth renderer={FullNameRenderer}></GridColumn>]}
                columnOptions={{
                  fullName: {
                    headerRenderer: () => <div>Custom Column</div>,
                    headerFilterRenderer: FullNameFilterRenderer,
                  },
                }}
              />,
            ),
            user,
          );
          const firstNameHeaderField = grid.getHeaderCellContent(0, 0).querySelector('div')!;
          expect(firstNameHeaderField).to.have.rendered.text('Custom Column');

          const firstNameFilterField = grid.getHeaderCellContent(1, 0).querySelector('vaadin-text-field')!;
          expect(firstNameFilterField.placeholder).to.deep.equal('Custom filter');
        });

        it('filters custom column with custom header filter', async () => {
          const service = personService();
          const grid = await GridController.init(
            render(
              <TestAutoGrid
                service={service}
                visibleColumns={['fullName']}
                customColumns={[<GridColumn key="fullName" autoWidth renderer={FullNameRenderer}></GridColumn>]}
                columnOptions={{
                  fullName: {
                    headerFilterRenderer: FullNameFilterRenderer,
                  },
                }}
              />,
            ),
            user,
          );

          const rootFilter: AndFilter = { '@type': 'and', children: [] };
          expect(service.lastFilter).to.deep.equal(rootFilter);

          await grid.typeInHeaderFilter(1, 0, 'filter-value', clock);

          const firstNameFilter = {
            '@type': 'propertyString',
            propertyId: 'firstName',
            matcher: 'CONTAINS',
            filterValue: 'filter-value',
          };
          const lastNameFilter = {
            '@type': 'propertyString',
            propertyId: 'lastName',
            matcher: 'CONTAINS',
            filterValue: 'filter-value',
          };

          const filter: FilterUnion = {
            '@type': 'or',
            children: [firstNameFilter, lastNameFilter],
            key: 'fullName',
          };

          expect(service.lastFilter).to.deep.equal({ '@type': 'and', children: [filter] });

          await grid.typeInHeaderFilter(1, 0, '', clock);

          expect(service.lastFilter).to.deep.equal(rootFilter);
        });

        it('filter chaining works with custom header filter', async () => {
          const service = personService();
          const grid = await GridController.init(
            render(
              <TestAutoGrid
                service={service}
                visibleColumns={['gender', 'fullName']}
                customColumns={[<GridColumn key="fullName" autoWidth renderer={FullNameRenderer}></GridColumn>]}
                columnOptions={{
                  fullName: {
                    headerFilterRenderer: FullNameFilterRenderer,
                  },
                }}
              />,
            ),
            user,
          );

          const controller = await SelectController.init(grid.getHeaderCellContent(1, 0), user);
          await controller.select(Gender.MALE);
          await clock.runAllAsync();

          const expectedGenderFilter: FilterUnion = {
            '@type': 'propertyString',
            filterValue: Gender.MALE,
            propertyId: 'gender',
            matcher: Matcher.EQUALS,
            key: 'gender',
          };

          const rootFilter: AndFilter = { '@type': 'and', children: [expectedGenderFilter] };
          expect(service.lastFilter).to.deep.equal(rootFilter);

          await grid.typeInHeaderFilter(1, 1, 'filter-value', clock);

          const firstNameFilter = {
            '@type': 'propertyString',
            propertyId: 'firstName',
            matcher: 'CONTAINS',
            filterValue: 'filter-value',
          };
          const lastNameFilter = {
            '@type': 'propertyString',
            propertyId: 'lastName',
            matcher: 'CONTAINS',
            filterValue: 'filter-value',
          };

          const filter: FilterUnion = {
            '@type': 'or',
            children: [firstNameFilter, lastNameFilter],
            key: 'fullName',
          };

          expect(service.lastFilter).to.deep.equal({
            '@type': 'and',
            children: [expectedGenderFilter, filter],
          });

          await grid.typeInHeaderFilter(1, 1, '', clock);

          expect(service.lastFilter).to.deep.equal(rootFilter);
        });

        it('renders custom column without key', async () => {
          const gridColumn = <GridColumn autoWidth header="Full name" renderer={FullNameRenderer}></GridColumn>;
          const grid = await GridController.init(render(<TestAutoGrid customColumns={[gridColumn]} />), user);

          const firstNameFilterField = grid.getHeaderCellContent(0, 14);
          expect(firstNameFilterField).to.have.rendered.text('Full name');
        });
      });
    });

    describe('default renderers', () => {
      let grid: GridController;

      beforeEach(async () => {
        grid = await GridController.init(
          render(
            <LocaleContext.Provider value="en-US">
              <AutoGrid service={columnRendererTestService()} model={ColumnRendererTestModel} />,
            </LocaleContext.Provider>,
          ),
          user,
        );
      });

      it('renders strings without formatting and with default alignment', async () => {
        const columnIndex = await grid.findColumnIndexByHeaderText('String');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.style('text-align', 'start');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.rendered.text('Hello World 1');
        expect(grid.getBodyCellContent(1, columnIndex)).to.have.rendered.text('Hello World 2');
      });

      it('renders integers as right aligned numbers', async () => {
        const columnIndex = await grid.findColumnIndexByHeaderText('Integer');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.style('text-align', 'end');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.rendered.text('123,456');
        expect(grid.getBodyCellContent(1, columnIndex)).to.have.rendered.text('-12');
      });

      it('renders decimals as right aligned numbers', async () => {
        const columnIndex = await grid.findColumnIndexByHeaderText('Decimal');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.style('text-align', 'end');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.rendered.text('123.46');
        expect(grid.getBodyCellContent(1, columnIndex)).to.have.rendered.text('-0.12');
        expect(grid.getBodyCellContent(2, columnIndex)).to.have.rendered.text('123.40');
        expect(grid.getBodyCellContent(3, columnIndex)).to.have.rendered.text('-12.00');
      });

      it('renders booleans as icons', async () => {
        const columnIndex = await grid.findColumnIndexByHeaderText('Boolean');
        expect(grid.getBodyCellContent(0, columnIndex).querySelector('vaadin-icon')).to.have.attribute(
          'icon',
          'lumo:checkmark',
        );
        expect(grid.getBodyCellContent(1, columnIndex).querySelector('vaadin-icon')).to.have.attribute(
          'icon',
          'lumo:minus',
        );
      });

      it('renders enum values as title case', async () => {
        const columnIndex = await grid.findColumnIndexByHeaderText('Enum');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.rendered.text('Male');
        expect(grid.getBodyCellContent(1, columnIndex)).to.have.rendered.text('Female');
        expect(grid.getBodyCellContent(2, columnIndex)).to.have.rendered.text('Non Binary');
        expect(grid.getBodyCellContent(3, columnIndex)).to.have.rendered.text('');
      });

      it('renders java.time.LocalDate as right aligned', async () => {
        const columnIndex = await grid.findColumnIndexByHeaderText('Local date');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.style('text-align', 'end');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.text('5/13/2021');
        expect(grid.getBodyCellContent(1, columnIndex)).to.have.text('5/14/2021');
        expect(grid.getBodyCellContent(2, columnIndex)).to.have.text('');
        expect(grid.getBodyCellContent(3, columnIndex)).to.have.text('');
      });

      it('renders java.time.LocalTime as right aligned', async () => {
        const columnIndex = await grid.findColumnIndexByHeaderText('Local time');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.style('text-align', 'end');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.text('8:45 AM');
        expect(grid.getBodyCellContent(1, columnIndex)).to.have.text('8:45 PM');
        expect(grid.getBodyCellContent(2, columnIndex)).to.have.text('');
        expect(grid.getBodyCellContent(3, columnIndex)).to.have.text('');
      });

      it('renders java.time.LocalDateTime as right aligned', async () => {
        const columnIndex = await grid.findColumnIndexByHeaderText('Local date time');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.style('text-align', 'end');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.text('5/13/2021, 8:45 AM');
        expect(grid.getBodyCellContent(1, columnIndex)).to.have.text('5/14/2021, 8:45 PM');
        expect(grid.getBodyCellContent(2, columnIndex)).to.have.text('');
        expect(grid.getBodyCellContent(3, columnIndex)).to.have.text('');
      });

      it('renders nested strings without formatting and with default alignment', async () => {
        const columnIndex = await grid.findColumnIndexByHeaderText('Nested string');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.style('text-align', 'start');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.rendered.text('Nested string 1');
        expect(grid.getBodyCellContent(1, columnIndex)).to.have.rendered.text('');
      });

      it('renders nested numbers as right aligned numbers', async () => {
        const columnIndex = await grid.findColumnIndexByHeaderText('Nested number');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.style('text-align', 'end');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.rendered.text('123,456');
        expect(grid.getBodyCellContent(1, columnIndex)).to.have.rendered.text('');
      });

      it('renders nested booleans as icons', async () => {
        const columnIndex = await grid.findColumnIndexByHeaderText('Nested boolean');
        expect(grid.getBodyCellContent(0, columnIndex).querySelector('vaadin-icon')).to.have.attribute(
          'icon',
          'lumo:checkmark',
        );
        expect(grid.getBodyCellContent(1, columnIndex).querySelector('vaadin-icon')).to.have.attribute(
          'icon',
          'lumo:minus',
        );
      });

      it('renders nested java.util.Date as right aligned', async () => {
        const columnIndex = await grid.findColumnIndexByHeaderText('Nested date');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.style('text-align', 'end');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.text('5/13/2021');
        expect(grid.getBodyCellContent(1, columnIndex)).to.have.text('');
      });

      it('renders objects as JSON string', async () => {
        const service = personService();
        const person = (await getItem(service, 1))!;
        grid = await GridController.init(
          render(<AutoGrid service={service} model={PersonModel} visibleColumns={['address', 'department']} />),
          user,
        );

        // JSON is truncated to fifty chars
        // Assert that test data matches that
        const addressJson = JSON.stringify(person.address);
        expect(addressJson.length).to.be.greaterThan(50);
        const truncatedAddressJson = `${addressJson.substring(0, 50)}...`;
        expect(grid.getBodyCellContent(0, 0)).to.have.text(truncatedAddressJson);
        expect(grid.getBodyCellContent(0, 1)).to.have.text(JSON.stringify(person.department));
      });

      it('renders object with custom path as string', async () => {
        const service = personService();
        grid = await GridController.init(
          render(
            <AutoGrid
              service={service}
              model={PersonModel}
              columnOptions={{ department: { path: 'department.name' } }}
            />,
          ),
          user,
        );
        const columnIndex = await grid.findColumnIndexByHeaderText('Department');
        expect(grid.getBodyCellContent(0, columnIndex)).to.have.text('IT');
      });

      it('renders undefined objects as empty string', async () => {
        const service = createService(personData.map((p) => ({ ...p, address: undefined })));
        grid = await GridController.init(
          render(<AutoGrid service={service} model={PersonModel} visibleColumns={['address']} />),
          user,
        );

        expect(grid.getBodyCellContent(0, 0)).to.have.text('');
      });
    });

    describe('auto grid ref', () => {
      let autoGridRef: AutoGridRef;

      const AutoGridRefreshTestWrapper = ({ service }: { service: ListService<any> }) => {
        const ref = useRef<AutoGridRef>(null);
        useEffect(() => {
          if (ref.current) {
            autoGridRef = ref.current;
          }
        }, []);
        return (
          <span>
            <AutoGrid service={service} model={PersonModel} ref={ref} />
          </span>
        );
      };

      it('reloads data when refresh is called on ref', async () => {
        const service = personService();
        const listSpy = sinon.spy(service, 'list');
        render(<AutoGridRefreshTestWrapper service={service} />);
        await nextFrame();
        await nextFrame();
        expect(listSpy).to.have.been.calledOnce;
        autoGridRef.refresh();
        expect(listSpy).to.have.been.calledTwice;
      });

      it('exposes vaadin-grid element on ref', () => {
        render(<AutoGridRefreshTestWrapper service={personService()} />);
        expect(autoGridRef.grid).to.exist;
        expect(autoGridRef.grid!.localName).to.equal('vaadin-grid');
      });
    });

    describe('item id path', () => {
      it('properly configures item ID path for models that have an ID property', async () => {
        // Model with JPA annotations
        let grid = await GridController.init(render(<AutoGrid service={personService()} model={PersonModel} />), user);
        expect(grid.instance.itemIdPath).to.equal('id');

        // Model with simple ID property
        grid = await GridController.init(
          render(<AutoGrid service={personService()} model={PersonWithSimpleIdPropertyModel} />),
          user,
        );
        expect(grid.instance.itemIdPath).to.equal('id');

        // Model with custom ID property
        grid = await GridController.init(
          render(<AutoGrid service={personService()} model={PersonModel} itemIdProperty="email" />),
          user,
        );
        expect(grid.instance.itemIdPath).to.equal('email');

        // Model without discernible ID property
        grid = await GridController.init(
          render(<AutoGrid service={personService()} model={PersonWithoutIdPropertyModel} />),
          user,
        );
        expect(grid.instance.itemIdPath).to.be.undefined;
      });
    });
  });
});
