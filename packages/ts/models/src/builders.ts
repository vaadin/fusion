import type { EmptyObject } from 'type-fest';
import type { ObjectModel } from './core';
import {
  $defaultValue,
  $key,
  $meta,
  $model,
  $name,
  $owner,
  $validators,
  type AnyObject,
  type DefaultValueProvider,
  type Model,
  type ModelMetadata,
} from './model.js';
import type { Validator } from './validators.js';

const { create, defineProperty } = Object;

/**
 * The options for creating the model property.
 */
export type ModelBuilderPropertyOptions = Readonly<{
  meta?: ModelMetadata;
}>;

/**
 * The flags for the model constructor that allow to determine specific characteristics of the model.
 */
export type Flags = Readonly<{
  /**
   * Defines if the model is named.
   */
  named: boolean;

  /**
   * The keys of the self-referencing properties.
   *
   * @remarks
   * The problem of self-reference models is that they cannot have intermediate
   * type because during the property definition, the model itself is in the
   * middle of construction. That's why we define the specific type-only flag
   * that allows us to know which model properties are self-referenced. We can
   * safely set it in the end of building using this flag.
   */
  selfRefKeys: keyof any;
}>;

/**
 * A builder class for creating all basic models.
 *
 * @typeParam V - The final value type of the model.
 * @typeParam EX - The extra properties of the model.
 * @typeParam F - The flags for the model constructor that allow to determine
 * specific characteristics of the model.
 */
export class CoreModelBuilder<
  V,
  EX extends AnyObject = EmptyObject,
  F extends Flags = { named: false; selfRefKeys: never },
> {
  static create<V, EX extends AnyObject, R extends keyof any>(
    base: Model<V, EX, R>,
  ): CoreModelBuilder<V, EX, { named: false; selfRefKeys: R }>;
  static create<V, EX extends AnyObject, R extends keyof any>(
    base: Model<unknown, EX, R>,
    defaultValueProvider: (model: Model<unknown, EX, R>) => V,
  ): CoreModelBuilder<V, EX, { named: false; selfRefKeys: R }>;
  static create(base: Model, defaultValueProvider?: (model: Model) => unknown): CoreModelBuilder<unknown> {
    return new CoreModelBuilder(base, defaultValueProvider);
  }

  protected readonly [$model]: Model<V, EX, F['selfRefKeys']>;

  /**
   * @param base - The base model to extend.
   * @param defaultValueProvider - The function that provides the default value
   * for the model.
   */
  protected constructor(base: Model, defaultValueProvider?: (model: Model) => V) {
    this[$model] = create(base);

    if (defaultValueProvider) {
      this.defaultValueProvider(defaultValueProvider);
    }
  }

  /**
   * Appends metadata to the model.
   *
   * @param value - The metadata to append.
   * @returns The current builder instance.
   */
  meta(value: ModelMetadata): this {
    this.define($meta, { value });
    return this;
  }

  /**
   * Defines a new property on the model. The property serves the purposes of
   * storing the extra data for specific types of models.
   *
   * @remarks
   * The key of the property should be a symbol to avoid conflicts with
   * properties defined via
   * {@link ObjectModelBuilder}.
   *
   * @param key - The key of the property.
   * @param value - The descriptor of the property.
   * @returns The current builder instance.
   */
  define<DK extends symbol, DV>(
    key: DK,
    value: TypedPropertyDescriptor<DV>,
  ): CoreModelBuilder<V, DK extends keyof Model ? EX : EX & Readonly<Record<DK, DV>>, F> {
    defineProperty(this[$model], key, value);
    return this as any;
  }

  /**
   * Sets the default value provider for the model. This is an alternative way
   * to provide the default value for the model if for some reason using the
   * constructor parameter is undesired.
   *
   * @param defaultValueProvider - The function that provides the default value
   * for the model.
   * @returns The current builder instance.
   */
  defaultValueProvider(defaultValueProvider: DefaultValueProvider<V, EX, F['selfRefKeys']>): this {
    this.define($defaultValue, {
      get(this: Model<V, EX, F['selfRefKeys']>) {
        return defaultValueProvider(this);
      },
    });
    return this;
  }

  /**
   * Sets the name of the model. The name is used for debugging purposes and is
   * displayed in the string representation. Setting the name is required;
   * otherwise, the {@link CoreModelBuilder.build} method won't be available.
   *
   * @param name - The name of the model.
   * @returns The current builder instance.
   */
  name<NV extends V = V>(
    this: F['named'] extends false ? this : never,
    name: string,
  ): CoreModelBuilder<NV, EX, { named: true; selfRefKeys: F['selfRefKeys'] }> {
    return this.define($name, { value: name }) as any;
  }

  /**
   * Adds a validator to the model. The validator is a function that checks if
   * the value is valid according to some criteria.
   */
  validator(validator: Validator<V>): this {
    this.define($validators, {
      value: [...this[$model][$validators], validator],
    });
    return this;
  }

  /**
   * Builds the model. On the typing level, it checks if all the model parts are
   * set correctly, and raises an error if not.
   *
   * @returns The model.
   */
  build(this: F['named'] extends true ? this : never): Model<V, EX, F['selfRefKeys']> {
    return this[$model];
  }
}

/**
 * A registry for the property models of the object model. Since the property
 * registration is lazy, we cannot store the property models directly on the
 * object model, so the registry plays a role of a private storage for them.
 *
 * @internal
 */
const propertyRegistry = new WeakMap<Model, Record<string, Model>>();

/**
 * A builder class for creating object models.
 *
 * @typeParam V - The final value type of the model.
 * @typeParam CV - The current value type of the model. It changes as the model
 * is being built and defines if the
 * {@link ObjectModelBuilder.build} method can be called.
 * @typeParam EX - The extra properties of the model.
 * @typeParam F - The flags for the model constructor that allow to determine
 * specific characteristics of the model.
 */
export class ObjectModelBuilder<
  V extends AnyObject,
  CV extends AnyObject = EmptyObject,
  EX extends AnyObject = EmptyObject,
  F extends Flags = { named: false; selfRefKeys: never },
> extends CoreModelBuilder<V, EX, F> {
  static override create<V extends AnyObject, EX extends AnyObject, R extends keyof any>(
    base: Model<V, EX, R>,
  ): ObjectModelBuilder<V, V, EX, { named: false; selfRefKeys: R }> {
    return new ObjectModelBuilder(base);
  }

  protected constructor(base: Model) {
    super(base, (m) => {
      const result = create(null);

      // eslint-disable-next-line no-restricted-syntax
      for (const key in m) {
        defineProperty(result, key, {
          enumerable: true,
          get: () => (m[key as keyof Model] as Model)[$defaultValue],
        });
      }

      return result;
    });
  }

  /**
   * The method that should follow the {@link m.extend} method. It allows to
   * declare the extension for the model and properly name it.
   *
   * @param name - The name of the model.
   */
  object<NV extends V = V>(
    this: F['named'] extends false ? this : never,
    name: string,
  ): ObjectModelBuilder<NV & V, CV, EX, { named: true; selfRefKeys: F['selfRefKeys'] }> {
    // @ts-expect-error: too generic
    return this.name(name);
  }

  declare ['name']: <NV extends V = V>(
    this: F['named'] extends false ? this : never,
    name: string,
  ) => ObjectModelBuilder<NV, CV, EX, { named: true; selfRefKeys: F['selfRefKeys'] }>;

  /**
   * {@inheritDoc CoreModelBuilder.define}
   */
  declare ['define']: <DK extends symbol, DV>(
    key: DK,
    value: TypedPropertyDescriptor<DV>,
  ) => ObjectModelBuilder<V, CV, DK extends keyof Model ? EX : EX & Readonly<Record<DK, DV>>, F>;

  /**
   * {@inheritDoc CoreModelBuilder.meta}
   */
  declare ['meta']: (value: ModelMetadata) => this;

  /**
   * Defines a new model property on the model. Unlike the
   * {@link ObjectModelBuilder.define}, this property is public and allows the
   * user to interact with the model data structure. It also updates the current
   * value type of the model to make it closer to the final value type.
   *
   * @param key - The key of the property.
   * @param model - The model of the property value. You can also provide a
   * function that produces the model based on the current model.
   * @param options - Additional options for the property.
   *
   * @returns The current builder instance updated with the new property type.
   * In case there is a self-referencing property, the {@link Flags.selfRefKeys}
   * flag for the specific property is set.
   */
  property<PK extends string & keyof V, EXK extends AnyObject = EmptyObject>(
    key: PK,
    model: Model<V[PK], EXK> | ((model: Model<V, EX & Readonly<Record<PK, Model<V[PK], EXK>>>>) => Model<V[PK], EXK>),
    options?: ModelBuilderPropertyOptions,
  ): // It is a workaround for the self-referencing models.
  // If the type of the model property is not the model itself,
  Extract<V[PK], V> extends never
    ? // Then we simply extend the model with the property, and update the
      // current value type of the model.
      ObjectModelBuilder<V, CV & Readonly<Record<PK, V[PK]>>, EX & Readonly<Record<PK, Model<V[PK], EXK>>>, F>
    : // Otherwise, we set a flag of the model that it contains a self-reference
      // property.
      ObjectModelBuilder<
        V,
        CV & Readonly<Record<PK, V[PK]>>,
        EX,
        {
          // Just inheriting the current flag.
          named: F['named'];
          // Adding the property name to all existing self-referencing
          // properties.
          selfRefKeys: F['selfRefKeys'] | PK;
        }
      > {
    defineProperty(this[$model], key, {
      enumerable: true,
      get(this: Model<V, EX & Readonly<Record<PK, Model<V[PK], EXK>>>>) {
        if (!propertyRegistry.has(this)) {
          propertyRegistry.set(this, {});
        }

        const props = propertyRegistry.get(this)!;

        props[key] ??= (
          CoreModelBuilder.create(typeof model === 'function' ? model(this) : model) as CoreModelBuilder<
            V[PK],
            EXK,
            { named: true; selfRefKeys: never }
          >
        )
          .define($key, { value: key })
          .define($owner, { value: this })
          .define($meta, { value: options?.meta })
          .build();

        return props[key];
      },
    });

    return this as any;
  }

  /**
   * {@inheritDoc CoreModelBuilder.build}
   */
  declare build: (
    this: F['named'] extends true ? (CV extends V ? this : never) : never,
  ) => ObjectModel<V, EX, F['selfRefKeys']>;
}
