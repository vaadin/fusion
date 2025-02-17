import { Signal as _Signal } from '@preact/signals-react';

declare module './core.js' {
  // @ts-expect-error: Overwrite Signal type
  export class Signal<T> extends _Signal<T> {
    protected S(node: unknown): void;
    protected U(node: unknown): void;
  }
}
