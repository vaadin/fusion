import type { EmptyObject } from 'type-fest';
import { CoreModelBuilder, ObjectModelBuilder } from './builders.js';
import { $parse, ArrayModel, EnumModel, ObjectModel, type PrimitiveModel, type UnionModel } from './core.js';
import {
  $defaultValue,
  $enum,
  $itemModel,
  $key,
  $members,
  $model,
  $name,
  $nothing,
  $optional,
  $owner,
  type AnyObject,
  type Enum,
  Model,
  type Target,
  type Value,
} from './model.js';

/**
 * Creates a new model that represents an array of items.
 *
 * @param itemModel - The model of the items in the array.
 */
export function array<V, EX extends AnyObject, R extends keyof any>(itemModel: Model<V, EX, R>): ArrayModel<V, EX, R> {
  return CoreModelBuilder.create(ArrayModel)
    .name<V[]>(`Array<${itemModel[$name]}>`)
    .define($itemModel, { value: itemModel })
    .build();
}

/**
 * Attaches the given model to the target.
 *
 * @param model - The model to attach.
 * @param target - The target to attach the model to. It could be a Binder
 * instance, a Signal, or another object. However, it could never be another
 * model.
 */
export function attach<V, EX extends AnyObject, R extends keyof any>(
  model: Model<V, EX, R>,
  target: Target<V>,
): Model<V, EX, R> {
  const attached = CoreModelBuilder.create(model).name(`@${model[$name]}`).define($owner, { value: target }).build();

  Object.defineProperty(target, $model, { value: attached });

  return attached;
}

/**
 * Creates a new model that extends the given base model.
 *
 * @param base - The base model to extend.
 */
export function extend<V extends AnyObject, EX extends AnyObject, R extends keyof any>(
  base: Model<V, EX, R>,
): ObjectModelBuilder<V, V, EX, { named: false; selfRefKeys: R }> {
  return ObjectModelBuilder.create(base);
}

/**
 * Creates a new model that represents an object.
 *
 * @param name - The name of the object.
 */
export function object<T extends AnyObject>(
  name: string,
): ObjectModelBuilder<T, EmptyObject, EmptyObject, { named: true; selfRefKeys: never }> {
  return ObjectModelBuilder.create(ObjectModel).object(name);
}

/**
 * Creates a new model that represents an optional value.
 *
 * @param base - The base model to extend.
 */
export function optional<M extends Model>(base: M): M {
  return (CoreModelBuilder.create(base) as CoreModelBuilder<unknown, EmptyObject, { named: true; selfRefKeys: never }>)
    .define($optional, { value: true })
    .build() as M;
}

/**
 * Creates a new model that represents an enum.
 *
 * @param obj - The enum object to represent.
 * @param name - The name of the model.
 */
export function enumeration<T extends typeof Enum>(obj: T, name: string): EnumModel<T> {
  return CoreModelBuilder.create(EnumModel).define($enum, { value: obj }).name(name).build() as EnumModel<T>;
}

/**
 * Creates a new model that represents a union of the values of the given
 * models.
 *
 * @param members - The models to create the union from.
 */
export function union<MM extends Model[]>(...members: MM): UnionModel<MM> {
  return CoreModelBuilder.create(Model, () => members[0][$defaultValue] as Value<MM[number]>)
    .name(members.map((model) => model[$name]).join(' | '))
    .define($members, { value: members })
    .build();
}

export function parse<V>(model: PrimitiveModel<V>, value: string): V {
  return model[$parse](value);
}

function hasCorrectShape(value: unknown): value is Record<keyof any, unknown> {
  return !!value && typeof value === 'object';
}

/**
 * Provides the value the given model represents. For attached models it will
 * be the owner value or its part, for detached models or in case the value
 * shape does not fit the model, it will be the default value of the model.
 *
 * @param model - The model to get the value.
 */
export function value<T>(model: Model<T>): T;
/**
 * Sets the value of the target object the given model represents on any
 * level of nesting. E.g., if the model that represents the `c` property
 * is attached to the object `a.b.c`, it will set only the `c` property.
 *
 * Along with it, the method will trigger the `value` setter of the target
 * object.
 *
 * @param model - The model to set the value.
 * @param newValue - The new value to set.
 */
export function value<T>(model: Model<T>, newValue: T): void;
// eslint-disable-next-line consistent-return
export function value(...args: [Model, unknown?]): unknown {
  const [model] = args;

  const keys: Array<keyof any> = [];
  let target: Target;

  // We go up the model nesting branch and collect all the keys. E.g. if we
  // have the following object:
  // ```ts
  // const value = {
  //   foo: {
  //     bar: {
  //       baz: 42,
  //     }
  //   }
  // };
  // ```
  // and the model that represents the `baz` property, the collected keys will
  // be stored like `['baz', 'bar', 'foo']`.
  for (let cursor: Model | Target = model; ; cursor = cursor[$owner]) {
    if (cursor instanceof Model) {
      if (cursor[$key] !== $nothing) {
        keys.push(cursor[$key]);
      }
    } else {
      target = cursor as Target;
      break;
    }
  }

  // If the method is called with a single argument, it means we need to get
  // the value of the target object the given model represents
  if (args.length === 1) {
    if (target.value === $nothing) {
      // If the model is detached, we return the default value of the model.
      return model[$defaultValue];
    }

    let current = target.value;

    // We execute the collected keys in reverse order to get the value of the
    // nested property the model represents.
    for (let i = keys.length - 1; i >= 0; i--) {
      // If we are not at the model's level, and the current value is not an
      // object we can take a key of, we throw an error.
      if (!hasCorrectShape(current)) {
        throw new Error('The value shape does not fit the model.');
      }

      // Otherwise, we take a key of the current value and continue the loop.
      current = current[keys[i]];
    }

    return current;
  }

  // If the method is called with two arguments, it means we need to set the
  // value of the nested property the model represents.
  const [, newValue] = args;

  // Here we check if we are at the root (top) level of the model structure, and
  // the model represents the whole `value` of the target.
  if (keys.length) {
    // In case we collected some keys, it means that we are working with the
    // nested properties of the target object.
    let current = target.value;

    // We execute the collected keys in reverse order to get the nested property
    // the model represents. Since we have to stop one step before the last key,
    // the condition is `i > 0`, not `i >= 0` like it was in previous case.
    for (let i = keys.length - 1; i >= 0; i--) {
      // If we are not at the model's level, and the current value is not an
      // object we can take a key of, we throw an error.
      if (!hasCorrectShape(current)) {
        // eslint-disable-next-line consistent-return
        throw new Error('The value shape does not fit the model.');
      }

      if (i === 0) {
        // We are at the end of the loop, so we have to assign the new value to
        // a property the model describes.
        current[keys[i]] = newValue;
      } else {
        // Otherwise, we take a key of the current value and continue the loop.
        current = current[keys[i]];
      }
    }

    // Then we have to trigger a setter of the target value. E.g., it's needed
    // for the Signal to update.
    // eslint-disable-next-line no-self-assign
    target.value = target.value;
  } else {
    // If we are at the root level, we just set the whole value.
    target.value = newValue;
  }
}

const arrayItemModels = new WeakMap<ArrayModel, Model[]>();

/**
 * Iterates over the given array model yielding an item model for each item
 * the model value has.
 *
 * @param model - The array model to iterate over.
 */
export function* items<V, EX extends AnyObject, R extends keyof any>(
  model: ArrayModel<V, EX, R>,
): Generator<Model<V, EX, R>, undefined, void> {
  const list = (arrayItemModels.get(model) ?? []) as Array<Model<V, EX, R>>;
  arrayItemModels.set(model, list);
  const v = value(model);

  list.length = v.length;

  for (let i = 0; i < v.length; i++) {
    if (!list[i]) {
      list[i] = CoreModelBuilder.create(model[$itemModel], () => v[i])
        .name(`${model[$itemModel][$name]}[${i}]`)
        .define($key, { value: i })
        .define($owner, { value: model })
        .build();
    }

    yield list[i];
  }
}
