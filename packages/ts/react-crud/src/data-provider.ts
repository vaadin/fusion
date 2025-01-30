import type { GridDataProviderCallback, GridDataProviderParams } from '@vaadin/react-components/Grid';
import type { GridDataProvider } from '@vaadin/react-components/Grid';
import { useMemo, useState } from 'react';
import type { CountService, ListService } from './crud';
import type FilterUnion from './types/com/vaadin/flow/spring/data/filter/FilterUnion';
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

export class InfiniteDataProvider<TItem> extends DataProvider<TItem> {
  // cannot be static, otherwise it does not implement superclass
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected fetchTotalCount(): undefined {
    return undefined;
  }

  protected fetchFilteredCount(page: DataPage<TItem>): number | undefined {
    const { items, pageRequest } = page;
    const { pageNumber, pageSize } = pageRequest;
    let infiniteScrollingSize;

    if (items.length === pageSize) {
      infiniteScrollingSize = (pageNumber + 1) * pageSize + 1;
      if (this.filteredCount !== undefined && infiniteScrollingSize < this.filteredCount) {
        // Only allow size to grow here to avoid shrinking the size when scrolled down and sorting
        infiniteScrollingSize = this.filteredCount;
      }
    } else {
      infiniteScrollingSize = pageNumber * pageSize + items.length;
    }

    return infiniteScrollingSize;
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
