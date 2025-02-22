import type {
  ComboBoxDataProvider,
  ComboBoxDataProviderCallback,
  ComboBoxDataProviderParams,
} from '@vaadin/react-components';
import type { GridDataProvider, GridDataProviderCallback, GridDataProviderParams } from '@vaadin/react-components/Grid';
import { useMemo, useState, type DependencyList } from 'react';
import type { CountService, ListService } from './crud';
import type FilterUnion from './types/com/vaadin/hilla/crud/filter/FilterUnion';
import type Pageable from './types/com/vaadin/hilla/mappedtypes/Pageable';
import type Sort from './types/com/vaadin/hilla/mappedtypes/Sort';
import Direction from './types/org/springframework/data/domain/Sort/Direction';
import NullHandling from './types/org/springframework/data/domain/Sort/NullHandling';

type MaybeCountService<TItem> = Partial<CountService<TItem>>;
type ListAndMaybeCountService<TItem> = ListService<TItem> & MaybeCountService<TItem>;
type ListAndCountService<TItem> = CountService<TItem> & ListService<TItem>;

type PageRequest = {
  pageNumber: number;
  pageSize: number;
  sort: Sort;
};

type DataPage<TItem> = {
  items: TItem[];
  pageRequest: PageRequest;
};

export type ItemCounts = {
  totalCount?: number;
  filteredCount?: number;
};

type AfterLoadCallback = (result: ItemCounts) => void;

type DataProviderOptions = {
  initialFilter?: FilterUnion;
  loadTotalCount?: boolean;
  afterLoad?: AfterLoadCallback;
};

function createSort<TItem>(params: GridDataProviderParams<TItem>): Sort {
  return {
    orders: params.sortOrders
      .filter((order) => order.direction != null)
      .map((order) => ({
        property: order.path,
        direction: order.direction === 'asc' ? Direction.ASC : Direction.DESC,
        ignoreCase: false,
        nullHandling: NullHandling.NATIVE,
      })),
  };
}

export function isCountService<TItem>(service: ListAndMaybeCountService<TItem>): service is ListAndCountService<TItem> {
  return !!service.count;
}

export abstract class DataProvider<TItem> {
  protected readonly service: ListAndMaybeCountService<TItem>;
  protected readonly loadTotalCount?: boolean;
  protected readonly afterLoadCallback?: AfterLoadCallback;

  protected filter: FilterUnion | undefined;
  protected totalCount: number | undefined;
  protected filteredCount: number | undefined;

  constructor(service: ListAndMaybeCountService<TItem>, options: DataProviderOptions = {}) {
    this.service = service;
    this.filter = options.initialFilter;
    this.loadTotalCount = options.loadTotalCount;
    this.afterLoadCallback = options.afterLoad;

    this.load = this.load.bind(this);
  }

  reset(): void {
    this.totalCount = undefined;
    this.filteredCount = undefined;
  }

  setFilter(filter: FilterUnion | undefined): void {
    this.reset();
    this.filter = filter;
  }

  async load(params: GridDataProviderParams<TItem>, callback: GridDataProviderCallback<TItem>): Promise<void> {
    // Fetch page and filtered count
    const page = await this.fetchPage(params);
    this.filteredCount = await this.fetchFilteredCount(page);
    // Only fetch total count if it's specific in options
    if (this.loadTotalCount) {
      this.totalCount = await this.fetchTotalCount(page);
    }

    // Pass results to grid
    callback(page.items, this.filteredCount);

    // Pass results to callback
    if (this.afterLoadCallback) {
      this.afterLoadCallback({
        totalCount: this.totalCount,
        filteredCount: this.filteredCount,
      });
    }
  }

  protected async fetchPage(params: GridDataProviderParams<TItem>): Promise<DataPage<TItem>> {
    const sort = createSort(params);
    const pageNumber = params.page;
    const { pageSize } = params;
    const pageRequest = {
      pageNumber,
      pageSize,
      sort,
    };
    const items = await this.service.list(pageRequest, this.filter);

    return { items, pageRequest };
  }

  protected abstract fetchTotalCount(page: DataPage<TItem>): Promise<number | undefined> | number | undefined;

  protected abstract fetchFilteredCount(page: DataPage<TItem>): Promise<number | undefined> | number | undefined;
}

export abstract class AbstractComboBoxDataProvider<TItem> {
  protected readonly list: ComboBoxFetchMethod<TItem>;
  protected readonly loadTotalCount?: boolean;

  protected sort: Sort | undefined;
  protected totalCount: number | undefined;
  protected filteredCount: number | undefined;

  constructor(list: ComboBoxFetchMethod<TItem>, sort: Sort | undefined) {
    this.list = list;
    this.sort = sort;
  }

  reset(): void {
    this.totalCount = undefined;
    this.filteredCount = undefined;
  }

  load(params: ComboBoxDataProviderParams, callback: ComboBoxDataProviderCallback<TItem>): void {
    this.fetchPage(params)
      .then(async (page) => {
        this.filteredCount = await this.fetchFilteredCount(page);
        // Only fetch total count if it's specific in options
        if (this.loadTotalCount) {
          this.totalCount = await this.fetchTotalCount(page);
        }

        // Pass results to the combobox
        callback(page.items, this.filteredCount);
      })
      .catch((error: unknown) => {
        throw error;
      });
  }

  protected async fetchPage(params: ComboBoxDataProviderParams): Promise<DataPage<TItem>> {
    const pageNumber = params.page;
    const { pageSize } = params;
    const pageRequest: Pageable = {
      pageNumber,
      pageSize,
      sort: this.sort ?? { orders: [] },
    };
    const items = await this.list(pageRequest, params.filter);

    return { items, pageRequest };
  }

  protected abstract fetchTotalCount(page: DataPage<TItem>): Promise<number | undefined> | number | undefined;

  protected abstract fetchFilteredCount(page: DataPage<TItem>): Promise<number | undefined> | number | undefined;
}

function determineInfiniteScrollingSize(page: DataPage<unknown>, lastKnownSize?: number): number {
  const { items, pageRequest } = page;
  const { pageNumber, pageSize } = pageRequest;
  let infiniteScrollingSize;

  if (items.length === pageSize) {
    infiniteScrollingSize = (pageNumber + 1) * pageSize + 1;
    if (lastKnownSize !== undefined && infiniteScrollingSize < lastKnownSize) {
      // Only allow size to grow here to avoid shrinking the size when scrolled down and sorting
      infiniteScrollingSize = lastKnownSize;
    }
  } else {
    infiniteScrollingSize = pageNumber * pageSize + items.length;
  }

  return infiniteScrollingSize;
}

export class InfiniteDataProvider<TItem> extends DataProvider<TItem> {
  // cannot be static, otherwise it does not implement superclass
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected fetchTotalCount(): undefined {
    return undefined;
  }

  protected fetchFilteredCount(page: DataPage<TItem>): number | undefined {
    return determineInfiniteScrollingSize(page, this.filteredCount);
  }
}
export class InfiniteComboBoxDataProvider<TItem> extends AbstractComboBoxDataProvider<TItem> {
  // cannot be static, otherwise it does not implement superclass
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected fetchTotalCount(): undefined {
    return undefined;
  }

  protected fetchFilteredCount(page: DataPage<TItem>): number | undefined {
    return determineInfiniteScrollingSize(page, this.filteredCount);
  }
}

export class FixedSizeDataProvider<TItem> extends DataProvider<TItem> {
  declare service: ListAndCountService<TItem>;

  constructor(service: ListAndMaybeCountService<TItem>, options: DataProviderOptions = {}) {
    if (!isCountService(service)) {
      throw new Error('The provided service does not implement the CountService interface.');
    }
    super(service, options);
  }

  protected async fetchTotalCount(): Promise<number | undefined> {
    // Use cached count if it's already known
    if (this.totalCount !== undefined) {
      return this.totalCount;
    }
    return this.service.count(undefined);
  }

  protected async fetchFilteredCount(): Promise<number | undefined> {
    // Use cached count if it's already known
    if (this.filteredCount !== undefined) {
      return this.filteredCount;
    }
    return this.service.count(this.filter);
  }
}

export function createDataProvider<TItem>(
  service: ListAndMaybeCountService<TItem>,
  options: DataProviderOptions = {},
): DataProvider<TItem> {
  if (isCountService(service)) {
    return new FixedSizeDataProvider(service, options);
  }
  return new InfiniteDataProvider(service, options);
}

type UseDataProviderResult<TItem> = Readonly<{
  dataProvider: GridDataProvider<TItem>;
  refresh(): void;
}>;

export function useDataProvider<TItem>(
  service: ListAndMaybeCountService<TItem>,
  filter?: FilterUnion,
): UseDataProviderResult<TItem> {
  const [refreshCounter, setRefreshCounter] = useState(0);
  const dataProvider = useMemo(() => createDataProvider(service, { initialFilter: filter }), [service]);

  // Update filter in data provider
  dataProvider.setFilter(filter);

  // Create a new data provider function reference when the filter changes or the refresh counter is incremented.
  // This effectively forces the grid to reload
  const dataProviderFn = useMemo(() => dataProvider.load.bind(dataProvider), [dataProvider, filter, refreshCounter]);

  return {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    dataProvider: dataProviderFn,
    refresh: () => {
      dataProvider.reset();
      setRefreshCounter(refreshCounter + 1);
    },
  };
}

export type UseGridDataProviderResult<TItem> = GridDataProvider<TItem> & {
  refresh(): void;
};

export type GridFetchMethod<TItem> = (pageable: Pageable) => Promise<TItem[]>;

/**
 * Creates a data provider for a grid component that fetches data using the provided fetch callback.
 *
 * @param fetch - the callback that fetches the data for the grid. The callback should return a promise that resolves to an array of items.
 * @param dependencies - A list of all reactive values referenced inside of the fetch callback. A change to any of the listed values will cause the grid to refresh its data.
 * @returns a data provider that can be assigned to a <Grid> component usings its dataProvider property and additionally contains a refresh method that can be called to force a reload of the grid data.
 */
export function useGridDataProvider<TItem>(
  fetch: GridFetchMethod<TItem>,
  dependencies?: DependencyList,
): UseGridDataProviderResult<TItem> {
  const result = useDataProvider(
    useMemo(
      () => ({
        list: async (pageable: Pageable) => fetch(pageable),
      }),
      dependencies ?? [],
    ),
  );
  const dataProvider: UseGridDataProviderResult<TItem> = result.dataProvider as UseGridDataProviderResult<TItem>;
  dataProvider.refresh = result.refresh;
  return dataProvider;
}

export type UseComboBoxDataProviderResult<TItem> = ComboBoxDataProvider<TItem> & {
  refresh(): void;
};

export type ComboBoxFetchMethod<TItem> = (pageable: Pageable, filterString: string) => Promise<TItem[]>;

function createComboBoxDataProvider<TItem>(
  list: ComboBoxFetchMethod<TItem>,
  sort: Sort | undefined,
): AbstractComboBoxDataProvider<TItem> {
  return new InfiniteComboBoxDataProvider(list, sort);
}

type ComboboxDataProviderOptions = {
  sort?: Sort;
};

/**
 * Creates a data provider for a combo box component that fetches data using the provided fetch callback.
 *
 * @param fetch - the method that fetches the data for the grid. The method should return a promise that resolves to an array of items.
 * @param dependencies - A list of all reactive values referenced inside of the fetch callback. A change to any of the listed values will cause the combo box to refresh its data.
 * @returns a data provider that can be assigned to a <ComboBox> component usings its dataProvider property and additionally contains a refresh method that can be called to force a reload of the combo box data.
 */
export function useComboBoxDataProvider<TItem>(
  fetch: ComboBoxFetchMethod<TItem>,
  options?: ComboboxDataProviderOptions,
  dependencies?: DependencyList,
): UseComboBoxDataProviderResult<TItem> {
  const [refreshCounter, setRefreshCounter] = useState(0);

  const dataProvider = useMemo(
    () => createComboBoxDataProvider(fetch, options?.sort),
    [options?.sort, ...(dependencies ?? [])],
  );

  // Create a new data provider function reference when the refresh counter is incremented.
  // This effectively forces the combo box to reload
  return useMemo(() => {
    const dataProviderWithRefresh = (...args: Parameters<typeof dataProvider.load>) => dataProvider.load(...args);
    dataProviderWithRefresh.refresh = () => {
      dataProvider.reset();
      setRefreshCounter(refreshCounter + 1);
    };
    return dataProviderWithRefresh;
  }, [dataProvider, refreshCounter]);
}
