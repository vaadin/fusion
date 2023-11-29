import { _enum, type EnumModel, type Validator } from '@hilla/form';
import { Checkbox, type CheckboxProps } from '@hilla/react-components/Checkbox.js';
import { DatePicker, type DatePickerProps } from '@hilla/react-components/DatePicker.js';
import { DateTimePicker, type DateTimePickerProps } from '@hilla/react-components/DateTimePicker.js';
import { IntegerField, type IntegerFieldProps } from '@hilla/react-components/IntegerField.js';
import { NumberField, type NumberFieldProps } from '@hilla/react-components/NumberField.js';
import { Select, type SelectProps } from '@hilla/react-components/Select.js';
import { TextField, type TextFieldProps } from '@hilla/react-components/TextField.js';
import { TimePicker, type TimePickerProps } from '@hilla/react-components/TimePicker.js';
import type { FieldDirectiveResult, UseFormResult } from '@hilla/react-form';
import { useFormPart } from '@hilla/react-form';
import type { JSX } from 'react';
import { useEffect } from 'react';
import { useDatePickerI18n, useDateTimePickerI18n } from './locale.js';
import type { PropertyInfo } from './model-info.js';
import { convertToTitleCase } from './util.js';

export type SharedFieldProps = Readonly<{
  propertyInfo: PropertyInfo;
  colSpan?: number;
  form: UseFormResult<any>;
  options?: FieldOptions;
}>;

type CustomFormFieldProps = FieldDirectiveResult & Readonly<{ label?: string; disabled?: boolean }>;

export type FieldOptions = Readonly<{
  /**
   * The label to show for the field. If not specified, a human-readable label
   * is generated from the property name.
   */
  label?: string;
  /**
   * Allows to specify a custom renderer for the field, for example to render a
   * custom type of field or apply an additional layout around the field. The
   * renderer receives field props that must be applied to the custom field
   * component in order to connect it to the form.
   *
   * Example:
   * ```tsx
   * {
   *   renderer: ({ field }) => (
   *     <TextArea {...field} />
   *   )
   * }
   * ```
   */
  renderer?(props: { field: CustomFormFieldProps }): JSX.Element;
  /**
   * The number of columns to span. This value is passed to the underlying
   * FormLayout, unless a custom layout is used. In that case, the value is
   * ignored.
   */
  colspan?: number;
  /**
   * Validators to apply to the field. The validators are added to the form
   * when the field is rendered.
   */
  validators?: Validator[];
}>;

function getPropertyModel(form: UseFormResult<any>, propertyInfo: PropertyInfo) {
  const pathParts = propertyInfo.name.split('.');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return pathParts.reduce<any>((model, property) => (model ? model[property] : undefined), form.model);
}

type AutoFormTextFieldProps = SharedFieldProps & TextFieldProps;

function AutoFormTextField({ propertyInfo, form, options, label, ...other }: AutoFormTextFieldProps) {
  const model = getPropertyModel(form, propertyInfo);
  return <TextField {...other} {...form.field(model)} label={label} />;
}

type AutoFormIntegerFieldProps = IntegerFieldProps & SharedFieldProps;

function AutoFormIntegerField({ propertyInfo, form, label, ...other }: AutoFormIntegerFieldProps) {
  const model = getPropertyModel(form, propertyInfo);
  return <IntegerField {...other} {...form.field(model)} label={label} />;
}

type AutoFormNumberFieldProps = NumberFieldProps & SharedFieldProps;

function AutoFormDecimalField({ propertyInfo, form, label, ...other }: AutoFormNumberFieldProps) {
  const model = getPropertyModel(form, propertyInfo);
  return <NumberField {...other} {...form.field(model)} label={label} />;
}

type AutoFormDateFieldProps = DatePickerProps & SharedFieldProps;

function AutoFormDateField({ propertyInfo, form, label, ...other }: AutoFormDateFieldProps) {
  const i18n = useDatePickerI18n();
  const model = getPropertyModel(form, propertyInfo);
  return <DatePicker i18n={i18n} {...other} {...form.field(model)} label={label} />;
}

type AutoFormTimeFieldProps = SharedFieldProps & TimePickerProps;

function AutoFormTimeField({ propertyInfo, form, label, ...other }: AutoFormTimeFieldProps) {
  const model = getPropertyModel(form, propertyInfo);
  return <TimePicker {...other} {...form.field(model)} label={label} />;
}

type AutoFormDateTimeFieldProps = DateTimePickerProps & SharedFieldProps;

function AutoFormDateTimeField({ propertyInfo, form, label, ...other }: AutoFormDateTimeFieldProps) {
  const i18n = useDateTimePickerI18n();
  const model = getPropertyModel(form, propertyInfo);
  return <DateTimePicker i18n={i18n} {...other} {...form.field(model)} label={label} />;
}

type AutoFormEnumFieldProps = SelectProps & SharedFieldProps;

function AutoFormEnumField({ propertyInfo, form, label, ...other }: AutoFormEnumFieldProps) {
  const model = getPropertyModel(form, propertyInfo) as EnumModel;
  const options = Object.keys(model[_enum]).map((value) => ({
    label: convertToTitleCase(value),
    value,
  }));
  return <Select {...other} {...form.field(model)} label={label} items={options} />;
}

type AutoFormBooleanFieldProps = CheckboxProps & SharedFieldProps;

function AutoFormBooleanField({ propertyInfo, form, label, ...other }: AutoFormBooleanFieldProps) {
  const model = getPropertyModel(form, propertyInfo);
  return <Checkbox {...other} {...form.field(model)} label={label} />;
}

export type AutoFormFieldProps = CheckboxProps &
  DatePickerProps &
  DateTimePickerProps &
  IntegerFieldProps &
  NumberFieldProps &
  SelectProps &
  SharedFieldProps &
  TextFieldProps &
  TimePickerProps;

export function AutoFormField(props: AutoFormFieldProps): JSX.Element | null {
  const { form, propertyInfo, options } = props;
  const label = options?.label ?? propertyInfo.humanReadableName;

  const formPart = useFormPart(getPropertyModel(form, propertyInfo));
  useEffect(() => {
    if (options?.validators) {
      options.validators.forEach((validator) => {
        formPart.addValidator(validator);
      });
    }
  }, [formPart, options]);

  if (options?.renderer) {
    const customFieldProps = { ...form.field(getPropertyModel(form, propertyInfo)), disabled: props.disabled, label };
    return options.renderer({ field: customFieldProps });
  }
  switch (props.propertyInfo.type) {
    case 'string':
      return <AutoFormTextField {...props} label={label}></AutoFormTextField>;
    case 'integer':
      return <AutoFormIntegerField {...props} label={label}></AutoFormIntegerField>;
    case 'decimal':
      return <AutoFormDecimalField {...props} label={label}></AutoFormDecimalField>;
    case 'date':
      return <AutoFormDateField {...props} label={label}></AutoFormDateField>;
    case 'time':
      return <AutoFormTimeField {...props} label={label}></AutoFormTimeField>;
    case 'datetime':
      return <AutoFormDateTimeField {...props} label={label}></AutoFormDateTimeField>;
    case 'enum':
      return <AutoFormEnumField {...props} label={label}></AutoFormEnumField>;
    case 'boolean':
      return <AutoFormBooleanField {...props} label={label}></AutoFormBooleanField>;
    default:
      return null;
  }
}
