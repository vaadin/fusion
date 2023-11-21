import { type AbstractModel, type DetachedModelConstructor, ValidationError, type Value } from '@hilla/form';
import { EndpointError } from '@hilla/frontend';
import { Button } from '@hilla/react-components/Button.js';
import { ConfirmDialog } from '@hilla/react-components/ConfirmDialog';
import { FormLayout } from '@hilla/react-components/FormLayout';
import { VerticalLayout } from '@hilla/react-components/VerticalLayout.js';
import { useForm, type UseFormResult } from '@hilla/react-form';
import { type ComponentType, type JSX, type ReactElement, useEffect, useState } from 'react';
import { AutoFormField, type AutoFormFieldProps, type FieldOptions } from './autoform-field.js';
import css from './autoform.obj.css';
import type { CrudService } from './crud.js';
import { getIdProperty, getProperties, includeProperty, type PropertyInfo } from './property-info.js';
import { type ComponentStyleProps, registerStylesheet } from './util.js';

registerStylesheet(css);

export const emptyItem = Symbol();

export type SubmitErrorEvent = {
  error: EndpointError;
};
export type SubmitEvent<TItem> = {
  item: TItem;
};
export type DeleteErrorEvent = {
  error: EndpointError;
};
export type DeleteEvent<TItem> = {
  item: TItem;
};

export type AutoFormLayoutRendererProps<M extends AbstractModel> = Readonly<{
  form: UseFormResult<M>;
  children: ReadonlyArray<ReactElement<AutoFormFieldProps>>;
}>;

export type AutoFormProps<M extends AbstractModel = AbstractModel> = ComponentStyleProps &
  Readonly<{
    /**
     * The service to use for saving and deleting items. This must be a
     * TypeScript service that has been generated by Hilla from a backend Java
     * service that implements the `dev.hilla.crud.CrudService` interface.
     */
    service: CrudService<Value<M>>;
    /**
     * The entity model to use, which determines which fields to show in the
     * form. This must be a Typescript model class that has been generated by
     * Hilla from a backend Java class. The model must match with the type of
     * the items handled by the service. For example, a `PersonModel` can be
     * used with a service that handles `Person` instances.
     *
     * By default, the form shows fields for all properties of the model which
     * have a type that is supported. Use the `visibleFields` option to customize
     * which fields to show and in which order.
     */
    model: DetachedModelConstructor<M>;
    /**
     * The item to edit in the form. The form fields are automatically populated
     * with values from the item's properties. In order to create a new item,
     * either pass `null`, or leave this prop as undefined.
     *
     * Use the `onSubmitSuccess` callback to get notified when the item has been
     * saved.
     *
     * When submitting a new item (i.e. when `item` is null or undefined), the
     * form will be automatically cleared, allowing to submit another new item.
     * In order to keep editing the same item after submitting, set the `item`
     * prop to the new item.
     */
    item?: Value<M> | typeof emptyItem | null;
    /**
     * Whether the form should be disabled. This disables all form fields and
     * all buttons.
     */
    disabled?: boolean;
    /**
     * Allows to customize the layout of the form by providing a custom
     * renderer. The renderer receives the form instance and the pre-rendered
     * fields as props. The renderer can either reuse the pre-rendered fields in
     * the custom layout, or render custom fields and connect them to the form
     * manually.
     *
     * Check the component documentation for details and examples.
     *
     * Example using pre-rendered fields:
     * ```tsx
     * <AutoForm layoutRenderer={({ children }) =>
     *   <VerticalLayout>
     *     {children}
     *     <p>All data is collected anonymously.</p>
     *   </VerticalLayout>
     * } />
     * ```
     *
     * Example rendering custom fields:
     * ```tsx
     * <AutoForm layoutRenderer={({ form }) =>
     *   <VerticalLayout>
     *     <TextField {...form.field(form.model.name)} />
     *     ...
     *   </VerticalLayout>
     * } />
     * ```
     */
    layoutRenderer?: ComponentType<AutoFormLayoutRendererProps<M>>;
    /**
     * Defines the fields to show in the form, and in which order. This takes
     * an array of property names. Properties that are not included in this
     * array will not be shown in the form, and properties that are included,
     * but don't exist in the model, will be ignored.
     */
    visibleFields?: string[];
    /**
     * Allows to customize the FormLayout used by default. This is especially useful
     * to define the `responsiveSteps`. See the
     * {@link https://hilla.dev/docs/react/components/form-layout | FormLayout documentation}
     * for details.
     */
    formLayoutProps?: ComponentStyleProps & Pick<Parameters<typeof FormLayout>[0], 'responsiveSteps'>;
    /**
     * Allows to customize individual fields of the form. This takes an object
     * where the keys are property names, and the values are options for the
     * respective field for editing that property.
     */
    fieldOptions?: Record<string, FieldOptions>;
    /**
     * Whether to show the delete button in the form. This is disabled by
     * default. If enabled, the delete button will only be shown when editing
     * an existing item, which means that `item` is not null.
     *
     * Use the `onDeleteSuccess` callback to get notified when the item has been
     * deleted.
     *
     * NOTE: This only hides the button, it does not prevent from calling the
     * delete method on the service. To completely disable deleting, you must
     * override the `delete` method in the backend Java service to either throw
     * an exception or annotate it with `@DenyAll` to prevent access.
     */
    deleteButtonVisible?: boolean;
    /**
     * A callback that will be called if an unexpected error occurs while
     * submitting the form.
     *
     * Note that this will not be called for validation errors, which are
     * handled automatically.
     */
    onSubmitError?({ error }: SubmitErrorEvent): void;
    /**
     * A callback that will be called after the form has been successfully
     * submitted and the item has been saved.
     *
     * When submitting a new item (i.e. when `item` is null or undefined), the
     * form will be automatically cleared, allowing to submit another new item.
     * In order to keep editing the same item after submitting, set the `item`
     * prop to the new item.
     */
    onSubmitSuccess?({ item }: SubmitEvent<Value<M>>): void;
    /**
     * A callback that will be called if an unexpected error occurs while
     * deleting an item.
     */
    onDeleteError?({ error }: DeleteErrorEvent): void;
    /**
     * A callback that will be called after the form has been successfully
     * deleted.
     */
    onDeleteSuccess?({ item }: DeleteEvent<Value<M>>): void;
  }>;

/**
 * Auto Form is a component that automatically generates a form for editing,
 * updating and deleting items from a backend service.
 *
 * Example usage:
 * ```tsx
 * import { AutoForm } from '@hilla/react-crud';
 * import PersonService from 'Frontend/generated/endpoints';
 * import PersonModel from 'Frontend/generated/com/example/application/Person';
 *
 * <AutoForm
 *   service={PersonService}
 *   model={PersonModel}
 *   onSubmitSuccess={({ item }) => {
 *     console.log('Submitted item:', item);
 *   }}
 * />
 * ```
 */
export function AutoForm<M extends AbstractModel>({
  service,
  model,
  item = emptyItem,
  onSubmitError,
  onSubmitSuccess,
  disabled,
  layoutRenderer: LayoutRenderer,
  visibleFields,
  formLayoutProps,
  fieldOptions,
  style,
  id,
  className,
  deleteButtonVisible,
  onDeleteSuccess,
  onDeleteError,
}: AutoFormProps<M>): JSX.Element {
  const form = useForm(model, {
    onSubmit: async (formItem) => service.save(formItem),
  });
  const [formError, setFormError] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isEditMode = item !== undefined && item !== null && item !== emptyItem;

  useEffect(() => {
    if (item !== emptyItem) {
      form.read(item);
    } else {
      form.clear();
    }
  }, [item]);

  async function handleSubmit(): Promise<void> {
    try {
      setFormError('');
      const newItem = await form.submit();
      if (newItem === undefined) {
        // If update returns an empty object, then no update was performed
        throw new EndpointError('No update performed');
      } else if (onSubmitSuccess) {
        onSubmitSuccess({ item: newItem });
      }
      // Automatically clear the form after submitting a new item.
      // Otherwise, there would be no way for the developer to clear it, as the
      // there is no new value to set for the item prop to trigger the above
      // effect in case the prop is already null, undefined or the empty item.
      if (!item || item === emptyItem) {
        form.clear();
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        // Handled automatically
        return;
      }
      if (error instanceof EndpointError) {
        if (onSubmitError) {
          onSubmitError({ error });
        } else {
          setFormError(error.message);
        }
      } else {
        throw error;
      }
    }
  }

  function deleteItem() {
    setShowDeleteDialog(true);
  }

  async function confirmDelete() {
    // At this point, item can not be null or emptyItem
    const deletedItem = item as Value<M>;
    try {
      const properties = getProperties(model);
      const idProperty = getIdProperty(properties)!;
      // eslint-disable-next-line
      const id = (item as any)[idProperty.name];
      await service.delete(id);
      if (onDeleteSuccess) {
        onDeleteSuccess({ item: deletedItem });
      }
    } catch (error) {
      if (error instanceof EndpointError) {
        if (onDeleteError) {
          onDeleteError({ error });
        } else {
          setFormError(error.message);
        }
      } else {
        throw error;
      }
    } finally {
      setShowDeleteDialog(false);
    }
  }

  function cancelDelete() {
    setShowDeleteDialog(false);
  }

  function createAutoFormField(propertyInfo: PropertyInfo): JSX.Element {
    const fieldOptionsForProperty = fieldOptions?.[propertyInfo.name];
    const colspanValue = fieldOptionsForProperty?.colspan;
    const colspan = colspanValue ? { colspan: colspanValue } : {};

    return (
      <AutoFormField
        key={propertyInfo.name}
        propertyInfo={propertyInfo}
        form={form}
        disabled={disabled}
        options={fieldOptionsForProperty}
        {...colspan}
      />
    );
  }

  const defaultProperties = getProperties(model);

  const visibleProperties = visibleFields
    ? visibleFields.reduce<PropertyInfo[]>((foundProperties, propertyName) => {
        const maybeProperty = defaultProperties.find((p) => p.name === propertyName);
        return maybeProperty ? [...foundProperties, maybeProperty] : foundProperties;
      }, [])
    : defaultProperties.filter(includeProperty);

  const fields = visibleProperties.map(createAutoFormField);

  const layout = LayoutRenderer ? (
    <LayoutRenderer form={form}>{fields}</LayoutRenderer>
  ) : (
    <FormLayout {...formLayoutProps}>{fields}</FormLayout>
  );

  return (
    <div className={`auto-form ${className ?? ''}`} id={id} style={style} data-testid="auto-form">
      <VerticalLayout className="auto-form-fields">
        {layout}
        {formError ? <div style={{ color: 'var(--lumo-error-color)' }}>{formError}</div> : <></>}
      </VerticalLayout>
      <div className="auto-form-toolbar">
        <Button
          theme="primary"
          disabled={!!disabled || (isEditMode && !form.dirty)}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onClick={handleSubmit}
        >
          Submit
        </Button>
        {form.dirty ? (
          <Button theme="tertiary" onClick={() => form.reset()}>
            Discard
          </Button>
        ) : null}
        {deleteButtonVisible && isEditMode && (
          <Button className="auto-form-delete-button" theme="tertiary error" onClick={deleteItem}>
            Delete...
          </Button>
        )}
      </div>
      {showDeleteDialog && (
        <ConfirmDialog
          opened
          header="Delete item"
          confirmTheme="error"
          cancelButtonVisible
          // eslint-disable-next-line
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        >
          Are you sure you want to delete the selected item?
        </ConfirmDialog>
      )}
    </div>
  );
}
