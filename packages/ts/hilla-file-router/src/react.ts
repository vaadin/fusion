import type { UIMatch } from '@remix-run/router';
import { type ComponentType, createElement } from 'react';
import { type RouteObject, useMatches } from 'react-router';
import { type AgnosticRoute, transformRoute } from './utils.js';

export type ViewConfig = Readonly<{
  /**
   * View title used in the main layout header, as <title> and as the default
   * for the menu entry. If not defined, then the view function name is converted
   * from CamelCase after removing any "View" postfix.
   */
  title?: string;

  /**
   * Same as in the explicit React Router configuration.
   */
  rolesAllowed?: string[];

  /**
   * Allows overriding the route path configuration. Uses the same syntax as
   * the path property with React Router.This can be used to define a route
   * that conflicts with the file name conventions, e.g. /foo/index
   */
  route?: string;

  /**
   * Controls whether the view implementation will be lazy loaded the first time
   * it's used or always included in the bundle. If set to undefined (which is
   * the default), views mapped to / and /login will be eager and any other view
   * will be lazy (this is in sync with defaults in Flow)
   */
  lazy?: boolean;

  /**
   * If set to false, then the route will not be registered with React Router,
   * but it will still be included in the main menu and used to configure
   * Spring Security
   */
  register?: boolean;

  menu?: Readonly<{
    /**
     * Title to use in the menu. Falls back the title property of the view
     * itself if not defined.
     */
    title?: string;

    /**
     * Used to determine the order in the menu. Ties are resolved based on the
     * used title. Entries without explicitly defined ordering are put below
     * entries with an order.
     */
    priority?: number;
    /**
     * Set to true to explicitly exclude a view from the automatically
     * populated menu.
     */
    exclude?: boolean;
  }>;
}>;

export type RouteModule<P = object> = Readonly<{
  default: ComponentType<P>;
  meta?: ViewConfig;
}>;

/**
 * Transforms generated routes into a format that can be used by React Router.
 *
 * @param routes - Generated routes
 */
export function toReactRouter(routes: AgnosticRoute<RouteModule>): RouteObject {
  return transformRoute(
    routes,
    (route) => route.children?.values(),
    ({ path, module }, children) =>
      ({
        path,
        element: module?.default ? createElement(module.default) : undefined,
        children: children.length > 0 ? (children as RouteObject[]) : undefined,
        handle: module?.meta,
      }) satisfies RouteObject,
  );
}

/**
 * Hook to return the {@link ViewConfig} for the current route.
 */
export function useViewConfig<M extends ViewConfig>(): M | undefined {
  const matches = useMatches() as ReadonlyArray<UIMatch<unknown, M>>;
  return matches[matches.length - 1]?.handle;
}
