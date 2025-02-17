import type { Constructor } from 'type-fest';

export type ClassStaticProperties<T extends Constructor<unknown>> = Omit<T, 'constructor'>;
