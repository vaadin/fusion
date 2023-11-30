import type { GridColumnProps } from '@hilla/react-components/GridColumn.js';
import {
  AutoGridBooleanRenderer,
  AutoGridDateRenderer,
  AutoGridDateTimeRenderer,
  AutoGridDecimalRenderer,
  AutoGridEnumRenderer,
  AutoGridIntegerRenderer,
  AutoGridTimeRenderer,
} from './autogrid-renderers';
import {
  BooleanHeaderFilter,
  DateHeaderFilter,
  EnumHeaderFilter,
  NoHeaderFilter,
  NumberHeaderFilter,
  StringHeaderFilter,
  TimeHeaderFilter,
} from './header-filter';
import type { PropertyInfo } from './model-info';

export type ColumnOptions = Omit<GridColumnProps<any>, 'dangerouslySetInnerHTML'> & {
  /**
   * If true, the column can be sorted. This is useful to disable sorting for
   * properties that are not sortable in the backend, or that require excessive processing.
   */
  sortable?: boolean;
  /**
   * If true, the column can be filtered. This is useful to disable filtering for
   * properties that are not sortable in the backend, or that require excessive processing.
   */
  filterable?: boolean;
};

// eslint-disable-next-line consistent-return
function getTypeColumnOptions(propertyInfo: PropertyInfo): ColumnOptions {
  // eslint-disable-next-line default-case
  switch (propertyInfo.type) {
    case 'integer':
      return {
        autoWidth: true,
        textAlign: 'end',
        flexGrow: 0,
        renderer: AutoGridIntegerRenderer,
        headerRenderer: NumberHeaderFilter,
      };
    case 'decimal':
      return {
        autoWidth: true,
        textAlign: 'end',
        flexGrow: 0,
        renderer: AutoGridDecimalRenderer,
        headerRenderer: NumberHeaderFilter,
      };
    case 'boolean':
      return {
        autoWidth: true,
        textAlign: 'end',
        flexGrow: 0,
        renderer: AutoGridBooleanRenderer,
        headerRenderer: BooleanHeaderFilter,
      };
    case 'date':
      return {
        autoWidth: true,
        textAlign: 'end',
        flexGrow: 0,
        renderer: AutoGridDateRenderer,
        headerRenderer: DateHeaderFilter,
      };
    case 'time':
      return {
        autoWidth: true,
        textAlign: 'end',
        flexGrow: 0,
        renderer: AutoGridTimeRenderer,
        headerRenderer: TimeHeaderFilter,
      };
    case 'datetime':
      return {
        autoWidth: true,
        textAlign: 'end',
        flexGrow: 0,
        renderer: AutoGridDateTimeRenderer,
        headerRenderer: DateHeaderFilter,
      };
    case 'enum':
      return {
        autoWidth: true,
        renderer: AutoGridEnumRenderer,
        headerRenderer: EnumHeaderFilter,
      };
    case 'string':
      return {
        autoWidth: true,
        headerRenderer: StringHeaderFilter,
      };
    default:
      return {
        autoWidth: true,
        headerRenderer: NoHeaderFilter,
      };
  }
}

export function getColumnOptions(
  propertyInfo: PropertyInfo,
  customColumnOptions: ColumnOptions | undefined,
): ColumnOptions {
  const typeColumnOptions = getTypeColumnOptions(propertyInfo);
  const finalHeaderRenderer =
    customColumnOptions?.filterable === false ? NoHeaderFilter : typeColumnOptions.headerRenderer;
  // TODO: Remove eslint-disable when all TypeScript version issues are resolved
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const columnOptions = customColumnOptions
    ? { ...typeColumnOptions, ...customColumnOptions, headerRenderer: finalHeaderRenderer }
    : typeColumnOptions;
  if (!columnOptions.headerRenderer) {
    console.error(`No header renderer defined for column ${propertyInfo.name}`);
  }
  return columnOptions;
}
