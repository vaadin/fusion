import type { ReactiveControllerHost } from '@lit/reactive-element';
import { ConnectionIndicator, ConnectionState } from '@vaadin/common-frontend';
import { getCsrfTokenHeadersForEndpointRequest } from './CsrfUtils.js';
import {
  EndpointError,
  EndpointResponseError,
  EndpointValidationError,
  ForbiddenResponseError,
  UnauthorizedResponseError,
  type ValidationErrorData,
} from './EndpointErrors.js';
import {
  type ActionOnLostSubscription,
  FluxConnection,
  type FluxSubscriptionStateChangeEvent,
} from './FluxConnection.js';
import type { VaadinGlobal } from './types.js';

const $wnd = globalThis as VaadinGlobal;

$wnd.Vaadin ??= {};
$wnd.Vaadin.registrations ??= [];
$wnd.Vaadin.registrations.push({
  is: 'endpoint',
});

export const bodyPartName = 'hilla_body_part';

export type MaybePromise<T> = Promise<T> | T;

/**
 * Represents the connection to and endpoint returning a subscription rather than a value.
 */
export interface Subscription<T> {
  /** Cancels the subscription.  No values are made available after calling this. */
  cancel(): void;

  /*
   * Binds to the given context (element) so that when the context is deactivated (element detached), the subscription is closed.
   */
  context(context: ReactiveControllerHost): Subscription<T>;

  /** Called when the subscription has completed. No values are made available after calling this. */
  onComplete(callback: () => void): Subscription<T>;

  /** Called when an exception occured in the subscription. */
  onError(callback: (message: string) => void): Subscription<T>;

  /** Called when a new value is available. */
  onNext(callback: (value: T) => void): Subscription<T>;

  /** Called when the subscription state changes. */
  onConnectionStateChange(callback: (event: FluxSubscriptionStateChangeEvent) => void): Subscription<T>;

  /**
   * Called when the connection is restored, but there's no longer a valid subscription. If the callback returns
   * `ActionOnLostSubscription.RESUBSCRIBE`, the subscription will be re-established by connecting to the same
   * server method again. If the callback returns `ActionOnLostSubscription.REMOVE`, the subscription will be
   * forgotten. This is also the default behavior if the callback is not set or if it returns `undefined`.
   */
  onSubscriptionLost(callback: () => ActionOnLostSubscription | void): Subscription<T>;
}

interface ConnectExceptionData {
  detail?: any;
  message: string;
  type: string;
  validationErrorData?: ValidationErrorData[];
}

/**
 * Throws a TypeError if the response is not 200 OK.
 * @param response - The response to assert.
 */
const assertResponseIsOk = async (response: Response): Promise<void> => {
  if (!response.ok) {
    const errorText = await response.text();
    let errorJson: ConnectExceptionData | null;
    try {
      errorJson = JSON.parse(errorText);
    } catch {
      // not a json
      errorJson = null;
    }

    const message =
      errorJson?.message ??
      (errorText.length > 0
        ? errorText
        : `expected "200 OK" response, but got ${response.status} ${response.statusText}`);
    const type = errorJson?.type;

    if (errorJson?.validationErrorData) {
      throw new EndpointValidationError(message, errorJson.validationErrorData, type);
    }

    if (type) {
      throw new EndpointError(message, type, errorJson?.detail);
    }

    switch (response.status) {
      case 401:
        throw new UnauthorizedResponseError(message, response);
      case 403:
        throw new ForbiddenResponseError(message, response);
      default:
        throw new EndpointResponseError(message, response);
    }
  }
};

/**
 * The `ConnectClient` constructor options.
 */
export interface ConnectClientOptions {
  /**
   * The `middlewares` property value.
   */
  middlewares?: Middleware[];
  /**
   * The `prefix` property value.
   */
  prefix?: string;
  /**
   * The Atmosphere options for the FluxConnection.
   */
  atmosphereOptions?: Partial<Atmosphere.Request>;
}

export interface EndpointCallMetaInfo {
  /**
   * The endpoint name.
   */
  endpoint: string;

  /**
   * The method name to call on in the endpoint class.
   */
  method: string;

  /**
   * Optional object with method call arguments.
   */
  params?: Record<string, unknown>;
}

/**
 * An object with the call arguments and the related Request instance.
 * See also {@link ConnectClient.call | the call() method in ConnectClient}.
 */
export interface MiddlewareContext extends EndpointCallMetaInfo {
  /**
   * The Fetch API Request object reflecting the other properties.
   */
  request: Request;
}

/**
 * An async middleware callback that invokes the next middleware in the chain
 * or makes the actual request.
 * @param context - The information about the call and request
 */
export type MiddlewareNext = (context: MiddlewareContext) => MaybePromise<Response>;

/**
 * An interface that allows defining a middleware as a class.
 */
export interface MiddlewareClass {
  /**
   * @param context - The information about the call and request
   * @param next - Invokes the next in the call chain
   */
  invoke(context: MiddlewareContext, next: MiddlewareNext): MaybePromise<Response>;
}

/**
 * An async callback function that can intercept the request and response
 * of a call.
 */
export type MiddlewareFunction = (context: MiddlewareContext, next: MiddlewareNext) => MaybePromise<Response>;

/**
 * An async callback that can intercept the request and response
 * of a call, could be either a function or a class.
 */
export type Middleware = MiddlewareClass | MiddlewareFunction;

function isFlowLoaded(): boolean {
  return $wnd.Vaadin?.Flow?.clients?.TypeScript !== undefined;
}

/**
 * Extracts file objects from the object that is used to build the request body.
 *
 * @param obj - The object to extract files from.
 * @returns A tuple with the object without files and a map of files.
 */
function extractFiles(obj: Record<string, unknown>): [Record<string, unknown>, Map<string, File>] {
  const fileMap = new Map<string, File>();

  function recursiveExtract(prop: unknown, path: string): unknown {
    if (prop !== null && typeof prop === 'object') {
      if (prop instanceof File) {
        fileMap.set(path, prop);
        return null;
      }
      if (Array.isArray(prop)) {
        return prop.map((item, index) => recursiveExtract(item, `${path}/${index}`));
      }
      return Object.entries(prop).reduce<Record<string, unknown>>((acc, [key, value]) => {
        const newPath = `${path}/${key}`;
        if (value instanceof File) {
          fileMap.set(newPath, value);
        } else {
          acc[key] = recursiveExtract(value, newPath);
        }
        return acc;
      }, {});
    }
    return prop;
  }

  return [recursiveExtract(obj, '') as Record<string, unknown>, fileMap];
}

/**
 * A list of parameters supported by {@link ConnectClient.call | the call() method in ConnectClient}.
 */
export interface EndpointRequestInit {
  /**
   * An AbortSignal to set request's signal.
   */
  signal?: AbortSignal | null;
}

/**
 * A low-level network calling utility. It stores
 * a prefix and facilitates remote calls to endpoint class methods
 * on the Hilla backend.
 *
 * Example usage:
 *
 * ```js
 * const client = new ConnectClient();
 * const responseData = await client.call('MyEndpoint', 'myMethod');
 * ```
 *
 * ### Prefix
 *
 * The client supports an `prefix` constructor option:
 * ```js
 * const client = new ConnectClient({prefix: '/my-connect-prefix'});
 * ```
 *
 * The default prefix is '/connect'.
 *
 */
export class ConnectClient {
  /**
   * The array of middlewares that are invoked during a call.
   */
  middlewares: Middleware[] = [];
  /**
   * The Hilla endpoint prefix
   */
  prefix = '/connect';
  /**
   * The Atmosphere options for the FluxConnection.
   */
  atmosphereOptions: Partial<Atmosphere.Request> = {};

  #fluxConnection?: FluxConnection;

  /**
   * @param options - Constructor options.
   */
  constructor(options: ConnectClientOptions = {}) {
    if (options.prefix) {
      this.prefix = options.prefix;
    }

    if (options.middlewares) {
      this.middlewares = options.middlewares;
    }

    if (options.atmosphereOptions) {
      this.atmosphereOptions = options.atmosphereOptions;
    }

    // add connection indicator to DOM
    ConnectionIndicator.create();

    // Listen to browser online/offline events and update the loading indicator accordingly.
    // Note: if Flow.ts is loaded, it instead handles the state transitions.
    addEventListener('online', () => {
      if (!isFlowLoaded() && $wnd.Vaadin?.connectionState) {
        $wnd.Vaadin.connectionState.state = ConnectionState.CONNECTED;
      }
    });
    addEventListener('offline', () => {
      if (!isFlowLoaded() && $wnd.Vaadin?.connectionState) {
        $wnd.Vaadin.connectionState.state = ConnectionState.CONNECTION_LOST;
      }
    });
  }

  /**
   * Gets a representation of the underlying persistent network connection used for subscribing to Flux type endpoint
   * methods.
   */
  get fluxConnection(): FluxConnection {
    if (!this.#fluxConnection) {
      this.#fluxConnection = new FluxConnection(this.prefix, this.atmosphereOptions);
    }
    return this.#fluxConnection;
  }

  /**
   * Calls the given endpoint method defined using the endpoint and method
   * parameters with the parameters given as params.
   * Asynchronously returns the parsed JSON response data.
   *
   * @param endpoint - Endpoint name.
   * @param method - Method name to call in the endpoint class.
   * @param params - Optional parameters to pass to the method.
   * @param init - Optional parameters for the request
   * @returns Decoded JSON response data.
   */
  async call(
    endpoint: string,
    method: string,
    params?: Record<string, unknown>,
    init?: EndpointRequestInit,
  ): Promise<any> {
    if (arguments.length < 2) {
      throw new TypeError(`2 arguments required, but got only ${arguments.length}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const csrfHeaders = globalThis.document ? getCsrfTokenHeadersForEndpointRequest(globalThis.document) : {};
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...csrfHeaders,
    };

    const [paramsWithoutFiles, files] = extractFiles(params ?? {});
    let body;

    if (files.size > 0) {
      // in this case params is not undefined, otherwise there would be no files
      body = new FormData();
      body.append(
        bodyPartName,
        JSON.stringify(paramsWithoutFiles, (_, value) => (value === undefined ? null : value)),
      );

      for (const [path, file] of files) {
        body.append(path, file);
      }
    } else {
      headers['Content-Type'] = 'application/json';
      body =
        params !== undefined ? JSON.stringify(params, (_, value) => (value === undefined ? null : value)) : undefined;
    }

    const request = new Request(`${this.prefix}/${endpoint}/${method}`, {
      body, // automatically sets Content-Type header
      headers,
      method: 'POST',
    });

    // The middleware `context`, includes the call arguments and the request
    // constructed from them
    const initialContext: MiddlewareContext = {
      endpoint,
      method,
      params,
      request,
    };

    // The internal middleware to assert and parse the response. The internal
    // response handling should come last after the other middlewares are done
    // with processing the response. That is why this middleware is first
    // in the final middlewares array.
    async function responseHandlerMiddleware(context: MiddlewareContext, next: MiddlewareNext): Promise<Response> {
      const response = await next(context);
      await assertResponseIsOk(response);
      const text = await response.text();
      return JSON.parse(text, (_, value: any) => (value === null ? undefined : value));
    }

    // The actual fetch call itself is expressed as a middleware
    // chain item for our convenience. Always having an ending of the chain
    // this way makes the folding down below more concise.
    async function fetchNext(context: MiddlewareContext) {
      $wnd.Vaadin?.connectionState?.loadingStarted();
      try {
        const response = await fetch(context.request, { signal: init?.signal });
        $wnd.Vaadin?.connectionState?.loadingFinished();
        return response;
      } catch (error: unknown) {
        // don't bother about connections aborted by purpose
        if (error instanceof Error && error.name === 'AbortError') {
          $wnd.Vaadin?.connectionState?.loadingFinished();
        } else {
          $wnd.Vaadin?.connectionState?.loadingFailed();
        }
        throw error;
      }
    }

    // Assemble the final middlewares array from internal
    // and external middlewares
    const middlewares = [responseHandlerMiddleware as Middleware, ...this.middlewares];

    // Fold the final middlewares array into a single function
    const chain = middlewares.reduceRight(
      (next: MiddlewareNext, middleware) =>
        // Compose and return the new chain step, that takes the context and
        // invokes the current middleware with the context and the further chain
        // as the next argument
        async (context) => {
          if (typeof middleware === 'function') {
            return middleware(context, next);
          }
          return middleware.invoke(context, next);
        },
      // Initialize reduceRight the accumulator with `fetchNext`
      fetchNext,
    );

    // Invoke all the folded async middlewares and return
    return chain(initialContext);
  }

  /**
   * Subscribes to the given method defined using the endpoint and method
   * parameters with the parameters given as params. The method must return a
   * compatible type such as a Flux.
   * Returns a subscription that is used to fetch values as they become available.
   *
   * @param endpoint - Endpoint name.
   * @param method - Method name to call in the endpoint class.
   * @param params - Optional parameters to pass to the method.
   * @returns A subscription used to handles values as they become available.
   */
  subscribe(endpoint: string, method: string, params?: any): Subscription<any> {
    return this.fluxConnection.subscribe(endpoint, method, params ? Object.values(params) : []);
  }
}
