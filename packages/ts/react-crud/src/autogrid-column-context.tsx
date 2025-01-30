import type { GridSorterDirection } from '@vaadin/react-components/GridSorter.js';
import { type Dispatch, type SetStateAction, createContext, type ComponentType } from 'react';
import type { ColumnOptions } from './autogrid-columns';
import type { HeaderFilterRendererProps } from './header-filter';
import type { PropertyInfo } from './model-info';
import type FilterUnion from './types/com/vaadin/flow/spring/data/filter/FilterUnion';

export interface SorterState {
  direction: GridSorterDirection;
}

export type SortState = Record<string, SorterState | undefined>;

export type ColumnContext = Readonly<{
  propertyInfo: PropertyInfo;
  setColumnFilter(filter: FilterUnion, filterKey: string): void;
  sortState: SortState;
  setSortState: Dispatch<SetStateAction<SortState>>;
  customColumnOptions?: ColumnOptions;
  headerFilterRenderer: ComponentType<HeaderFilterRendererProps>;
  filterKey: string;
}>;

export const ColumnContext = createContext<ColumnContext | null>(null);

export type CustomColumnContext = Readonly<{
  setColumnFilter(filter: FilterUnion, filterKey: string): void;
  headerFilterRenderer: ComponentType<HeaderFilterRendererProps>;
  filterKey: string;
}>;

export const CustomColumnContext = createContext<CustomColumnContext | null>(null);
