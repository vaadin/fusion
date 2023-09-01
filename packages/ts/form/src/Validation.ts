import type { BinderNode } from './BinderNode.js';
import { getBinderNode } from './BinderNode.js';
import type { BinderRoot } from './BinderRoot.js';
import { type AbstractModel, NumberModel, type Value } from './Models.js';
import { Required } from './Validators.js';

export interface ValueError<T> {
  property: AbstractModel<any> | string;
  message: string;
  value: T;
  validator: Validator<T>;
}

export interface ValidationResult {
  property: AbstractModel<any> | string;
  message?: string;
}

export class ValidationError extends Error {
  errors: ReadonlyArray<ValueError<any>>;

  constructor(errors: ReadonlyArray<ValueError<any>>) {
    super(
      [
        'There are validation errors in the form.',
        ...errors.map(
          (e) => `${e.property.toString()} - ${e.validator.constructor.name}${e.message ? `: ${e.message}` : ''}`,
        ),
      ].join('\n - '),
    );
    this.errors = errors;
    this.name = this.constructor.name;
  }
}

export type InterpolateMessageCallback<M extends AbstractModel> = (
  message: string,
  validator: Validator<Value<M>>,
  binderNode: BinderNode<M>,
) => string;

export interface Validator<T> {
  message: string;
  impliesRequired?: boolean;
  validate(
    value: T,
    binder: BinderRoot,
  ):
    | Promise<ValidationResult | boolean | readonly ValidationResult[]>
    | ValidationResult
    | boolean
    | readonly ValidationResult[];
}

export class ServerValidator implements Validator<any> {
  message: string;

  constructor(message: string) {
    this.message = message;
  }

  validate = (): boolean => false;
}

// The `property` field of `ValidationResult`s is a path relative to the parent.
function setPropertyAbsolutePath(binderNodeName: string, result: ValidationResult): ValidationResult {
  if (typeof result.property === 'string' && binderNodeName.length > 0) {
    result.property = `${binderNodeName}.${result.property}`;
  }
  return result;
}

export async function runValidator<M extends AbstractModel>(
  model: M,
  validator: Validator<Value<M>>,
  interpolateMessageCallback?: InterpolateMessageCallback<M>,
): Promise<ReadonlyArray<ValueError<Value<M>>>> {
  const binderNode = getBinderNode(model);
  const value = binderNode.value as Value<M>;

  const interpolateMessage = (message: string) => {
    if (!interpolateMessageCallback) {
      return message;
    }
    return interpolateMessageCallback(message, validator, binderNode);
  };

  // If model is not required and value empty, do not run any validator. Except
  // always validate NumberModel, which has a mandatory builtin validator
  // to indicate NaN input.
  if (!binderNode.required && !new Required().validate(value) && !(model instanceof NumberModel)) {
    return [];
  }

  const result = await validator.validate(value, binderNode.binder);

  if (result === false) {
    return [{ message: interpolateMessage(validator.message), property: binderNode.name, validator, value }];
  }

  if (result === true || (Array.isArray(result) && result.length === 0)) {
    return [];
  }

  if (Array.isArray(result)) {
    return result.map((result2) => ({
      message: interpolateMessage(validator.message),
      ...setPropertyAbsolutePath(binderNode.name, result2),
      validator,
      value,
    }));
  }

  return [
    {
      message: interpolateMessage(validator.message),
      ...setPropertyAbsolutePath(binderNode.name, result as ValidationResult),
      validator,
      value,
    },
  ];
}
