import type FilterUnion from './types/com/vaadin/hilla/crud/filter/FilterUnion.js';
import type Pageable from './types/com/vaadin/hilla/mappedtypes/Pageable.js';

export interface FormService<T> {
  save(value: T): Promise<T | undefined>;

  delete(id: any): Promise<void>;
}

export interface ListService<T> {
  list(request: Pageable, filter: FilterUnion | undefined): Promise<T[]>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface CountService<T> {
  count(filter: FilterUnion | undefined): Promise<number>;
}

export interface CrudService<T> extends FormService<T>, ListService<T> {}
