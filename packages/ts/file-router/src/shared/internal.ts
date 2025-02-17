import type { ViewConfig } from '../types.js';
import type { RouteParamType } from './routeParamType.js';

/**
 * Internal type used for server communication and menu building. It extends the
 * view configuration with the route parameters.
 */
export type ServerViewConfig = Readonly<{
  children?: readonly ServerViewConfig[];
  params?: Readonly<Record<string, RouteParamType>>;
}> &
  ViewConfig;

export type VaadinObject = Readonly<{
  views: Readonly<Record<string, ViewConfig>>;
}>;

export type VaadinWindow = Readonly<{
  Vaadin?: VaadinObject;
}> &
  Window;
