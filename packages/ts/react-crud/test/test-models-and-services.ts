import {
  BooleanModel,
  EnumModel,
  NumberModel,
  ObjectModel,
  StringModel,
  _enum,
  _getPropertyModel,
  makeEnumEmptyValueCreator,
  makeObjectEmptyValueCreator,
} from '@vaadin/hilla-lit-form';
import type { CountService, CrudService, ListService } from '../src/crud.js';
import type FilterUnion from '../src/types/com/vaadin/flow/spring/data/filter/FilterUnion.js';
import Matcher from '../src/types/com/vaadin/flow/spring/data/filter/PropertyStringFilter/Matcher.js';
import type Pageable from '../src/types/com/vaadin/hilla/mappedtypes/Pageable.js';
import type Sort from '../src/types/com/vaadin/hilla/mappedtypes/Sort.js';
import Direction from '../src/types/org/springframework/data/domain/Sort/Direction.js';

export interface Company extends HasIdVersion {
  name: string;
  foundedDate: string;
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  NON_BINARY = 'NON_BINARY',
}

export interface Named {
  firstName: string;
  lastName: string;
}

export interface Address {
  street: string;
  city: string;
  country: string;
}

export interface Department extends HasIdVersion {
  name?: string;
}

export interface Person extends HasIdVersion, Named {
  gender: Gender;
  email: string;
  someInteger: number;
  someDecimal: number;
  vip: boolean;
  birthDate: string;
  shiftStart: string;
  appointmentTime: string;
  address?: Address;
  department?: Department;
}

export interface NestedTestValues {
  nestedString: string;
  nestedNumber: number;
  nestedBoolean: boolean;
  nestedDate?: string;
}

export interface ColumnRendererTestValues extends HasIdVersion {
  string: string;
  integer: number;
  decimal: number;
  boolean: boolean;
  enum?: Gender;
  localDate?: string;
  localTime?: string;
  localDateTime?: string;
  nested?: NestedTestValues;
}

export interface UserData extends HasIdVersion {
  name?: string;
}

class GenderModel extends EnumModel<typeof Gender> {
  static override createEmptyValue = makeEnumEmptyValueCreator(GenderModel);
  readonly [_enum] = Gender;
}

export class NamedModel<T extends Named = Named> extends ObjectModel<T> {
  static override createEmptyValue = makeObjectEmptyValueCreator(NamedModel);

  get firstName(): StringModel {
    return this[_getPropertyModel]('firstName', (parent, key) => new StringModel(parent, key, false));
  }

  get lastName(): StringModel {
    return this[_getPropertyModel]('lastName', (parent, key) => new StringModel(parent, key, false));
  }
}

export class AddressModel<T extends Address = Address> extends ObjectModel<T> {
  static override createEmptyValue = makeObjectEmptyValueCreator(AddressModel);

  get street(): StringModel {
    return this[_getPropertyModel]('street', (parent, key) => new StringModel(parent, key, false));
  }

  get city(): StringModel {
    return this[_getPropertyModel]('city', (parent, key) => new StringModel(parent, key, false));
  }

  get country(): StringModel {
    return this[_getPropertyModel]('country', (parent, key) => new StringModel(parent, key, false));
  }
}

export class DepartmentModel<T extends Department = Department> extends ObjectModel<T> {
  static override createEmptyValue = makeObjectEmptyValueCreator(DepartmentModel);

  get id(): NumberModel {
    return this[_getPropertyModel](
      'id',
      (parent, key) =>
        new NumberModel(parent, key, true, { meta: { annotations: [{ name: 'jakarta.persistence.Id' }] } }),
    );
  }

  get version(): NumberModel {
    return this[_getPropertyModel](
      'version',
      (parent, key) =>
        new NumberModel(parent, key, true, { meta: { annotations: [{ name: 'jakarta.persistence.Version' }] } }),
    );
  }

  get name(): StringModel {
    return this[_getPropertyModel]('name', (parent, key) => new StringModel(parent, key, false));
  }
}

export class PersonModel<T extends Person = Person> extends NamedModel<T> {
  static override createEmptyValue = makeObjectEmptyValueCreator(PersonModel);

  get id(): NumberModel {
    return this[_getPropertyModel](
      'id',
      (parent, key) =>
        new NumberModel(parent, key, true, { meta: { annotations: [{ name: 'jakarta.persistence.Id' }] } }),
    );
  }

  get version(): NumberModel {
    return this[_getPropertyModel](
      'version',
      (parent, key) =>
        new NumberModel(parent, key, true, { meta: { annotations: [{ name: 'jakarta.persistence.Version' }] } }),
    );
  }

  get gender(): GenderModel {
    return this[_getPropertyModel]('gender', (parent, key) => new GenderModel(parent, key, false));
  }

  get email(): StringModel {
    return this[_getPropertyModel]('email', (parent, key) => new StringModel(parent, key, false));
  }

  get someInteger(): NumberModel {
    return this[_getPropertyModel](
      'someInteger',
      (parent, key) => new NumberModel(parent, key, false, { meta: { javaType: 'int' } }),
    );
  }

  get someDecimal(): NumberModel {
    return this[_getPropertyModel](
      'someDecimal',
      (parent, key) => new NumberModel(parent, key, false, { meta: { javaType: 'float' } }),
    );
  }

  get vip(): BooleanModel {
    return this[_getPropertyModel]('vip', (parent, key) => new BooleanModel(parent, key, false));
  }

  get birthDate(): StringModel {
    return this[_getPropertyModel](
      'birthDate',
      (parent, key) => new StringModel(parent, key, false, { meta: { javaType: 'java.time.LocalDate' } }),
    );
  }

  get shiftStart(): StringModel {
    return this[_getPropertyModel](
      'shiftStart',
      (parent, key) => new StringModel(parent, key, false, { meta: { javaType: 'java.time.LocalTime' } }),
    );
  }

  get appointmentTime(): StringModel {
    return this[_getPropertyModel](
      'appointmentTime',
      (parent, key) => new StringModel(parent, key, false, { meta: { javaType: 'java.time.LocalDateTime' } }),
    );
  }

  get address(): AddressModel {
    return this[_getPropertyModel](
      'address',
      (parent, key) =>
        new AddressModel(parent, key, false, { meta: { annotations: [{ name: 'jakarta.persistence.OneToOne' }] } }),
    );
  }

  get department(): DepartmentModel {
    return this[_getPropertyModel](
      'department',
      (parent, key) =>
        new DepartmentModel(parent, key, false, { meta: { annotations: [{ name: 'jakarta.persistence.ManyToOne' }] } }),
    );
  }
}

export class PersonWithSimpleIdPropertyModel<T extends Person = Person> extends NamedModel<T> {
  static override createEmptyValue = makeObjectEmptyValueCreator(PersonModel);

  get id(): NumberModel {
    return this[_getPropertyModel]('id', (parent, key) => new NumberModel(parent, key, false));
  }
}

export class PersonWithoutIdPropertyModel<T extends Person = Person> extends NamedModel<T> {
  static override createEmptyValue = makeObjectEmptyValueCreator(PersonModel);
}

export class CompanyModel<T extends Company = Company> extends ObjectModel<T> {
  declare static createEmptyValue: () => Company;

  get id(): NumberModel {
    return this[_getPropertyModel](
      'id',
      (parent, key) =>
        new NumberModel(parent, key, false, { meta: { annotations: [{ name: 'jakarta.persistence.Id' }] } }),
    );
  }

  get version(): NumberModel {
    return this[_getPropertyModel](
      'version',
      (parent, key) =>
        new NumberModel(parent, key, false, { meta: { annotations: [{ name: 'jakarta.persistence.Version' }] } }),
    );
  }

  get name(): StringModel {
    return this[_getPropertyModel]('name', (parent, key) => new StringModel(parent, key, false));
  }

  get foundedDate(): StringModel {
    return this[_getPropertyModel]('foundedDate', (parent, key) => new StringModel(parent, key, false));
  }
}

export class NestedTestModel<T extends NestedTestValues = NestedTestValues> extends ObjectModel<T> {
  declare static createEmptyValue: () => Company;

  get nestedString(): StringModel {
    return this[_getPropertyModel]('nestedString', (parent, key) => new StringModel(parent, key, false));
  }

  get nestedNumber(): NumberModel {
    return this[_getPropertyModel](
      'nestedNumber',
      (parent, key) => new NumberModel(parent, key, false, { meta: { javaType: 'int' } }),
    );
  }

  get nestedBoolean(): BooleanModel {
    return this[_getPropertyModel]('nestedBoolean', (parent, key) => new BooleanModel(parent, key, false));
  }

  get nestedDate(): StringModel {
    return this[_getPropertyModel](
      'nestedDate',
      (parent, key) => new StringModel(parent, key, false, { meta: { javaType: 'java.time.LocalDate' } }),
    );
  }
}

export class ColumnRendererTestModel<
  T extends ColumnRendererTestValues = ColumnRendererTestValues,
> extends ObjectModel<T> {
  declare static createEmptyValue: () => Company;

  get id(): NumberModel {
    return this[_getPropertyModel](
      'id',
      (parent, key) =>
        new NumberModel(parent, key, false, { meta: { annotations: [{ name: 'jakarta.persistence.Id' }] } }),
    );
  }

  get string(): StringModel {
    return this[_getPropertyModel]('string', (parent, key) => new StringModel(parent, key, false));
  }

  get integer(): NumberModel {
    return this[_getPropertyModel](
      'integer',
      (parent, key) => new NumberModel(parent, key, false, { meta: { javaType: 'int' } }),
    );
  }

  get decimal(): NumberModel {
    return this[_getPropertyModel](
      'decimal',
      (parent, key) => new NumberModel(parent, key, false, { meta: { javaType: 'float' } }),
    );
  }

  get boolean(): BooleanModel {
    return this[_getPropertyModel]('boolean', (parent, key) => new BooleanModel(parent, key, false));
  }

  get enum(): GenderModel {
    return this[_getPropertyModel]('enum', (parent, key) => new GenderModel(parent, key, false));
  }

  get localDate(): StringModel {
    return this[_getPropertyModel](
      'localDate',
      (parent, key) => new StringModel(parent, key, false, { meta: { javaType: 'java.time.LocalDate' } }),
    );
  }

  get localTime(): StringModel {
    return this[_getPropertyModel](
      'localTime',
      (parent, key) => new StringModel(parent, key, false, { meta: { javaType: 'java.time.LocalTime' } }),
    );
  }

  get localDateTime(): StringModel {
    return this[_getPropertyModel](
      'localDateTime',
      (parent, key) => new StringModel(parent, key, false, { meta: { javaType: 'java.time.LocalDateTime' } }),
    );
  }

  get nested(): NestedTestModel {
    return this[_getPropertyModel](
      'nested',
      (parent, key) =>
        new NestedTestModel(parent, key, false, { meta: { annotations: [{ name: 'jakarta.persistence.OneToOne' }] } }),
    );
  }
}

export class UserDataModel<T extends UserData = UserData> extends ObjectModel<T> {
  static override createEmptyValue = makeObjectEmptyValueCreator(UserDataModel);

  get id(): NumberModel {
    return this[_getPropertyModel](
      'id',
      (parent, key) =>
        new NumberModel(parent, key, true, { meta: { annotations: [{ name: 'jakarta.persistence.Id' }] } }),
    );
  }

  get version(): NumberModel {
    return this[_getPropertyModel](
      'version',
      (parent, key) =>
        new NumberModel(parent, key, true, { meta: { annotations: [{ name: 'jakarta.persistence.Version' }] } }),
    );
  }

  get name(): StringModel {
    return this[_getPropertyModel]('name', (parent, key) => new StringModel(parent, key, true));
  }
}

type HasIdVersion = {
  id?: number;
  version?: number;
};

export const createService = <T extends HasIdVersion>(
  initialData: T[],
): CountService<T> & CrudService<T> & HasTestInfo => {
  let _lastSort: Sort | undefined;
  let _lastFilter: FilterUnion | undefined;
  let data = initialData;
  let _callCount = 0;

  function filterData(filter: FilterUnion | undefined): T[] {
    if (filter && filter['@type'] === 'propertyString') {
      return data.filter((item) => {
        const propertyValue = (item as Record<string, any>)[filter.propertyId];
        if (filter.matcher === Matcher.CONTAINS && typeof propertyValue === 'string') {
          return propertyValue.includes(filter.filterValue);
        }
        return propertyValue === filter.filterValue;
      });
    }
    return data;
  }

  return {
    // eslint-disable-next-line @typescript-eslint/require-await
    async list(request: Pageable, filter: FilterUnion | undefined): Promise<T[]> {
      _lastSort = request.sort;
      _lastFilter = filter;
      _callCount += 1;

      let filteredData: T[] = [];
      if (request.pageNumber === 0) {
        filteredData = filterData(filter);
      }

      if (request.sort.orders.length === 1) {
        const sortPropertyId = request.sort.orders[0]!.property;
        const directionMod = request.sort.orders[0]!.direction === Direction.ASC ? 1 : -1;
        filteredData.sort((a, b) =>
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          (a as any)[sortPropertyId] > (b as any)[sortPropertyId] ? Number(directionMod) : -1 * directionMod,
        );
      }
      return filteredData;
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    async save(value: T): Promise<T | undefined> {
      const currentValue = data.find((item) => item.id === value.id);
      if (currentValue) {
        if (currentValue.version !== value.version) {
          // Trying to update an old value
          throw new Error('Trying to update an old value');
        }
      }
      const newValue = { ...value };
      if (currentValue) {
        newValue.version = currentValue.version ? currentValue.version + 1 : 0;
        data = data.map((item) => (item.id === newValue.id ? newValue : item));
      } else {
        newValue.id = data.map((item) => item.id ?? 0).reduce((prev, curr) => Math.max(prev, curr)) + 1;
        newValue.version = 1;
        data = [...data, newValue];
      }
      return data.find((item) => item.id === newValue.id);
    },
    // eslint-disable-next-line
    async delete(id: any): Promise<void> {
      data = data.filter((item) => item.id !== id);
    },
    get lastSort() {
      return _lastSort;
    },
    get lastFilter() {
      return _lastFilter;
    },
    get callCount() {
      return _callCount;
    },
    async count(filter: FilterUnion | undefined): Promise<number> {
      return Promise.resolve(filterData(filter).length);
    },
  };
};

export const createListService = <T extends HasIdVersion>(initialData: T[]): HasTestInfo & ListService<T> => {
  const service = createService(initialData);
  return {
    callCount: service.callCount,
    lastFilter: service.lastFilter,
    lastSort: service.lastSort,
    list: async (request: Pageable, filter: FilterUnion | undefined): Promise<T[]> => service.list(request, filter),
  };
};

export const personData: Person[] = [
  {
    id: 1,
    version: 1,
    firstName: 'John',
    lastName: 'Dove',
    gender: Gender.MALE,
    email: 'john@example.com',
    someInteger: -12,
    someDecimal: 0.12,
    vip: true,
    birthDate: '1999-12-31',
    shiftStart: '08:30',
    appointmentTime: '2021-05-13T08:45',
    address: {
      street: '122 North Street',
      city: 'North Town',
      country: 'US',
    },
    department: {
      id: 1,
      version: 1,
      name: 'Sales',
    },
  },
  {
    id: 2,
    version: 1,
    firstName: 'Jane',
    lastName: 'Love',
    gender: Gender.FEMALE,
    email: 'jane@example.com',
    someInteger: 123456,
    someDecimal: 123.456,
    vip: false,
    birthDate: '1999-12-31',
    shiftStart: '08:30',
    appointmentTime: '2025-08-21T14:30',
    address: {
      street: '122 South Street',
      city: 'South Town',
      country: 'US',
    },
    department: {
      id: 2,
      version: 1,
      name: 'IT',
    },
  },
];

export const companyData: Company[] = [
  { id: 1, version: 1, name: 'Vaadin Ltd', foundedDate: '2000-05-06' },
  { id: 2, version: 1, name: 'Google', foundedDate: '1998-09-04' },
];

export const columnRendererTestData: ColumnRendererTestValues[] = [
  {
    id: 1,
    version: 1,
    string: 'Hello World 1',
    integer: 123456,
    decimal: 123.456,
    boolean: true,
    enum: Gender.MALE,
    localDate: '2021-05-13',
    localTime: '08:45:00',
    localDateTime: '2021-05-13T08:45:00',
    nested: {
      nestedString: 'Nested string 1',
      nestedNumber: 123456,
      nestedBoolean: true,
      nestedDate: '2021-05-13',
    },
  },
  {
    id: 2,
    version: 1,
    string: 'Hello World 2',
    integer: -12,
    decimal: -0.12,
    boolean: false,
    enum: Gender.FEMALE,
    localDate: '2021-05-14',
    localTime: '20:45:00',
    localDateTime: '2021-05-14T20:45:00',
  },
  {
    id: 3,
    version: 1,
    string: 'Hello World 3',
    enum: Gender.NON_BINARY,
    integer: 123456,
    decimal: 123.4,
    boolean: false,
  },
  {
    id: 4,
    version: 1,
    string: 'Hello World 4',
    integer: -12,
    decimal: -12,
    boolean: false,
    localDate: 'foo',
    localTime: 'foo',
    localDateTime: 'foo',
  },
];

export type HasTestInfo = {
  lastSort: Sort | undefined;
  lastFilter: FilterUnion | undefined;
  callCount: number;
};

export const personService = (): CountService<Person> & CrudService<Person> & HasTestInfo => createService(personData);
export const personListService = (): ListService<Person> => createListService(personData);
export const companyService = (): CountService<Company> & CrudService<Company> & HasTestInfo =>
  createService(companyData);
export const columnRendererTestService = (): CountService<ColumnRendererTestValues> &
  CrudService<ColumnRendererTestValues> &
  HasTestInfo => createService(columnRendererTestData);

const noSort: Sort = { orders: [] };

export async function getItem<T extends HasIdVersion>(
  service: CrudService<T> & HasTestInfo,
  id: number,
): Promise<T | undefined> {
  return (await service.list({ pageNumber: 0, pageSize: 1000, sort: noSort }, undefined)).find((p) => p.id === id);
}
