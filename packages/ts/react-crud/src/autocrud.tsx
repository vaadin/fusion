import type { AbstractModel, DetachedModelConstructor } from '@hilla/form';
import { Button } from '@hilla/react-components/Button.js';
import { SplitLayout } from '@hilla/react-components/SplitLayout';
import { type JSX, useState } from 'react';
import { AutoCrudDialog } from './autocrud-dialog';
import css from './autocrud.obj.css';
import { type AutoFormProps, emptyItem, ExperimentalAutoForm } from './autoform.js';
import { AutoGrid, type AutoGridProps } from './autogrid.js';
import type { CrudService } from './crud.js';
import { useMediaQuery } from './media-query';
import type { ComponentStyleProps } from './util';

document.adoptedStyleSheets.unshift(css);

export type AutoCrudFormProps<TItem> = Omit<
  Partial<AutoFormProps<AbstractModel<TItem>>>,
  'afterSubmit' | 'disabled' | 'item' | 'model' | 'service'
>;

export type AutoCrudGridProps<TItem> = Omit<
  Partial<AutoGridProps<TItem>>,
  'model' | 'onActiveItemChanged' | 'refreshTrigger' | 'selectedItems' | 'service'
>;

export type AutoCrudProps<TItem> = ComponentStyleProps &
  Readonly<{
    /**
     * The service to use for fetching the data, as well saving and deleting
     * items. This must be a TypeScript service that has been generated by Hilla
     * from a backend Java service that implements the
     * `dev.hilla.crud.CrudService` interface.
     */
    service: CrudService<TItem>;
    /**
     * The entity model to use for the CRUD. This determines which columns to
     * show in the grid, and which fields to show in the form. This must be a
     * Typescript model class that has been generated by Hilla from a backend
     * Java class. The model must match with the type of the items returned by
     * the service. For example, a `PersonModel` can be used with a service that
     * returns `Person` instances.
     *
     * By default, the grid shows columns for all properties of the model which
     * have a type that is supported. Use the `gridProps.visibleColumns` option
     * to customize which columns to show and in which order.
     *
     * By default, the form shows fields for all properties of the model which
     * have a type that is supported. Use the `formProps.customLayoutRenderer`
     * option to customize which fields to show and in which order.
     */
    model: DetachedModelConstructor<AbstractModel<TItem>>;
    /**
     * Allows to disable the delete functionality, which means that no delete
     * button is shown in the form.
     */
    noDelete?: boolean;
    /**
     * Props to pass to the form. See the `AutoForm` component for details.
     */
    formProps?: AutoCrudFormProps<TItem>;
    /**
     * Props to pass to the grid. See the `AutoGrid` component for details.
     */
    gridProps?: AutoCrudGridProps<TItem>;
  }>;

/**
 * Auto CRUD is a component that provides CRUD (create, read, update, delete)
 * functionality based on a Java backend service. It automatically generates a
 * grid that shows data from the service, and a form for creating, updating and
 * deleting items.
 *
 * Example usage:
 * ```tsx
 * import { AutoCrud } from '@hilla/react-crud';
 * import PersonService from 'Frontend/generated/endpoints';
 * import PersonModel from 'Frontend/generated/com/example/application/Person';
 *
 * <AutoCrud service={PersonService} model={PersonModel} />
 * ```
 */
export function ExperimentalAutoCrud<TItem>({
  service,
  model,
  noDelete,
  formProps,
  gridProps,
  style,
  id,
  className,
}: AutoCrudProps<TItem>): JSX.Element {
  const [item, setItem] = useState<TItem | typeof emptyItem | undefined>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const fullScreen = useMediaQuery('(max-width: 600px), (max-height: 600px)');

  function refreshGrid() {
    setRefreshTrigger(refreshTrigger + 1);
  }

  function editItem(itemToEdit: TItem) {
    setItem(itemToEdit);
  }

  function handleCancel() {
    setItem(undefined);
  }

  const mainSection = (
    <div className="auto-crud-main">
      <AutoGrid
        {...gridProps}
        refreshTrigger={refreshTrigger}
        service={service}
        model={model}
        selectedItems={item && item !== emptyItem ? [item] : []}
        onActiveItemChanged={(e) => {
          const activeItem = e.detail.value;
          setItem(activeItem ?? undefined);
        }}
      ></AutoGrid>
      <div className="auto-crud-toolbar">
        <Button theme="primary" onClick={() => setItem(emptyItem)}>
          + New
        </Button>
      </div>
    </div>
  );

  const autoForm = (
    <ExperimentalAutoForm
      {...formProps}
      disabled={!item}
      service={service}
      model={model}
      item={item}
      deleteButtonVisible={!noDelete}
      afterSubmit={({ item: submittedItem }) => {
        if (fullScreen) {
          setItem(undefined);
        } else {
          setItem(submittedItem);
        }
        refreshGrid();
      }}
      afterDelete={() => {
        setItem(undefined);
        refreshGrid();
      }}
    />
  );

  return (
    <div className={`auto-crud ${className ?? ''}`} id={id} style={style}>
      {fullScreen ? (
        <>
          {mainSection}
          <AutoCrudDialog opened={!!item} onClose={handleCancel}>
            {autoForm}
          </AutoCrudDialog>
        </>
      ) : (
        <SplitLayout theme="small">
          {mainSection}
          {autoForm}
        </SplitLayout>
      )}
    </div>
  );
}
