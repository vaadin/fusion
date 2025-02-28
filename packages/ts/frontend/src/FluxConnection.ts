import type { ReactiveControllerHost } from '@lit/reactive-element';
import type { Subscription } from './Connect.js';
import { getCsrfTokenHeadersForEndpointRequest } from './CsrfUtils.js';
import {
  isClientMessage,
  type ServerCloseMessage,
  type ServerConnectMessage,
  type ServerMessage,
} from './FluxMessages.js';

export enum State {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  RECONNECTING = 'reconnecting',
}

type ActiveEvent = CustomEvent<{ active: boolean }>;
interface EventMap {
  'state-changed': ActiveEvent;
}

type ListenerType<T extends keyof EventMap> =
  | ((this: FluxConnection, ev: EventMap[T]) => any)
  | {
      handleEvent(ev: EventMap[T]): void;
    }
  | null;

/**
 * Possible options for dealing with lost subscriptions after a websocket is reopened.
 */
export enum ActionOnLostSubscription {
  /**
   * The subscription should be resubscribed using the same server method and parameters.
   */
  RESUBSCRIBE = 'resubscribe',
  /**
   * The subscription should be removed.
   */
  REMOVE = 'remove',
}

/**
 * Possible states of a flux subscription.
 */
export enum FluxSubscriptionState {
  /**
   * The subscription is not connected and is trying to connect.
   */
  CONNECTING = 'connecting',
  /**
   * The subscription is connected and receiving updates.
   */
  CONNECTED = 'connected',
  /**
   * The subscription is closed and is not trying to reconnect.
   */
  CLOSED = 'closed',
}

/**
 * Event wrapper for flux subscription connection state change callback
 */
export type FluxSubscriptionStateChangeEvent = CustomEvent<{ state: FluxSubscriptionState }>;

type EndpointInfo = {
  endpointName: string;
  methodName: string;
  params: unknown[] | undefined;
  reconnect?(): ActionOnLostSubscription | void;
};

let atmosphere: Atmosphere.Atmosphere | undefined;

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (globalThis.document) {
  // In case we are in the browser environment, we have to load atmosphere.js
  try {
    atmosphere = await import('atmosphere.js').then((module) => module.default);
  } catch (e: unknown) {
    console.error('Failed to load atmosphere.js', e);
  }
}

/**
 * A representation of the underlying persistent network connection used for subscribing to Flux type endpoint methods.
 */
export class FluxConnection extends EventTarget {
  state: State = State.INACTIVE;
  wasClosed = false;
  readonly #endpointInfos = new Map<string, EndpointInfo>();
  #nextId = 0;
  readonly #onCompleteCallbacks = new Map<string, () => void>();
  readonly #onErrorCallbacks = new Map<string, (message: string) => void>();
  readonly #onNextCallbacks = new Map<string, (value: any) => void>();
  readonly #onStateChangeCallbacks = new Map<string, (event: FluxSubscriptionStateChangeEvent) => void>();
  readonly #statusOfSubscriptions = new Map<string, FluxSubscriptionState>();
  #pendingMessages: ServerMessage[] = [];
  #socket?: Atmosphere.Request;

  constructor(connectPrefix: string, atmosphereOptions?: Partial<Atmosphere.Request>) {
    super();
    this.#connectWebsocket(connectPrefix.replace(/connect$/u, ''), atmosphereOptions ?? {});
  }

  #resubscribeIfWasClosed() {
    if (this.wasClosed) {
      this.wasClosed = false;
      const toBeRemoved: string[] = [];
      this.#endpointInfos.forEach((endpointInfo, id) => {
        if (endpointInfo.reconnect?.() === ActionOnLostSubscription.RESUBSCRIBE) {
          this.#setSubscriptionConnState(id, FluxSubscriptionState.CONNECTING);
          this.#send({
            '@type': 'subscribe',
            endpointName: endpointInfo.endpointName,
            id,
            methodName: endpointInfo.methodName,
            params: endpointInfo.params,
          });
        } else {
          toBeRemoved.push(id);
        }
      });
      toBeRemoved.forEach((id) => this.#removeSubscription(id));
    }
  }

  /**
   * Subscribes to the flux returned by the given endpoint name + method name using the given parameters.
   *
   * @param endpointName - the endpoint to connect to
   * @param methodName - the method in the endpoint to connect to
   * @param parameters - the parameters to use
   * @returns a subscription
   */
  subscribe(endpointName: string, methodName: string, parameters?: unknown[]): Subscription<any> {
    const id: string = this.#nextId.toString();
    this.#nextId += 1;
    const params = parameters ?? [];

    const msg: ServerConnectMessage = { '@type': 'subscribe', endpointName, id, methodName, params };
    this.#send(msg);
    this.#endpointInfos.set(id, { endpointName, methodName, params });
    this.#setSubscriptionConnState(id, FluxSubscriptionState.CONNECTING);
    const hillaSubscription: Subscription<any> = {
      cancel: () => {
        if (!this.#endpointInfos.has(id)) {
          // Subscription already closed or canceled
          return;
        }

        const closeMessage: ServerCloseMessage = { '@type': 'unsubscribe', id };
        this.#send(closeMessage);
        this.#removeSubscription(id);
      },
      context(context: ReactiveControllerHost): Subscription<any> {
        context.addController({
          hostDisconnected() {
            hillaSubscription.cancel();
          },
        });
        return hillaSubscription;
      },
      onComplete: (callback: () => void): Subscription<any> => {
        this.#onCompleteCallbacks.set(id, callback);
        return hillaSubscription;
      },
      onError: (callback: (message: string) => void): Subscription<any> => {
        this.#onErrorCallbacks.set(id, callback);
        return hillaSubscription;
      },
      onNext: (callback: (value: any) => void): Subscription<any> => {
        this.#onNextCallbacks.set(id, callback);
        return hillaSubscription;
      },
      onSubscriptionLost: (callback: () => ActionOnLostSubscription | void): Subscription<any> => {
        if (this.#endpointInfos.has(id)) {
          this.#endpointInfos.get(id)!.reconnect = callback;
        } else {
          console.warn(`"onReconnect" value not set for subscription "${id}" because it was already canceled`);
        }
        return hillaSubscription;
      },
      onConnectionStateChange: (callback: (event: FluxSubscriptionStateChangeEvent) => void): Subscription<any> => {
        this.#onStateChangeCallbacks.set(id, callback);
        callback(
          new CustomEvent('subscription-state-change', { detail: { state: this.#statusOfSubscriptions.get(id)! } }),
        );
        return hillaSubscription;
      },
    };
    return hillaSubscription;
  }

  #connectWebsocket(prefix: string, atmosphereOptions: Partial<Atmosphere.Request>) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const extraHeaders = globalThis.document ? getCsrfTokenHeadersForEndpointRequest(globalThis.document) : {};
    const pushUrl = 'HILLA/push';
    const url = prefix.length === 0 ? pushUrl : (prefix.endsWith('/') ? prefix : `${prefix}/`) + pushUrl;
    this.#socket = atmosphere?.subscribe?.({
      contentType: 'application/json; charset=UTF-8',
      enableProtocol: true,
      transport: 'websocket',
      fallbackTransport: 'websocket',
      headers: extraHeaders,
      maxReconnectOnClose: 10000000,
      reconnectInterval: 5000,
      timeout: -1,
      trackMessageLength: true,
      url,
      onClose: () => {
        this.wasClosed = true;
        if (this.state !== State.INACTIVE) {
          this.state = State.INACTIVE;
          this.dispatchEvent(new CustomEvent('state-changed', { detail: { active: false } }));
        }
      },
      onError: (response) => {
        // eslint-disable-next-line no-console
        console.error('error in push communication', response);
      },
      onMessage: (response) => {
        if (response.responseBody) {
          this.#handleMessage(JSON.parse(response.responseBody));
        }
      },
      onMessagePublished: (response) => {
        if (response?.responseBody) {
          this.#handleMessage(JSON.parse(response.responseBody));
        }
      },
      onOpen: () => {
        if (this.state !== State.ACTIVE) {
          this.#resubscribeIfWasClosed();
          this.state = State.ACTIVE;
          this.dispatchEvent(new CustomEvent('state-changed', { detail: { active: true } }));
          this.#sendPendingMessages();
        }
      },
      onReopen: () => {
        if (this.state !== State.ACTIVE) {
          this.#resubscribeIfWasClosed();
          this.state = State.ACTIVE;
          this.dispatchEvent(new CustomEvent('state-changed', { detail: { active: true } }));
          this.#sendPendingMessages();
        }
      },
      onReconnect: () => {
        if (this.state !== State.RECONNECTING) {
          this.state = State.RECONNECTING;
          this.#endpointInfos.forEach((_, id) => {
            this.#setSubscriptionConnState(id, FluxSubscriptionState.CONNECTING);
          });
        }
      },
      onFailureToReconnect: () => {
        if (this.state !== State.INACTIVE) {
          this.state = State.INACTIVE;
          this.dispatchEvent(new CustomEvent('state-changed', { detail: { active: false } }));
          this.#endpointInfos.forEach((_, id) => this.#setSubscriptionConnState(id, FluxSubscriptionState.CLOSED));
        }
      },
      ...atmosphereOptions,
    } satisfies Atmosphere.Request);
  }

  #setSubscriptionConnState(id: string, state: FluxSubscriptionState) {
    const currentState = this.#statusOfSubscriptions.get(id);
    if (!currentState) {
      this.#statusOfSubscriptions.set(id, state);
      this.#onStateChangeCallbacks.get(id)?.(
        new CustomEvent('subscription-state-change', { detail: { state: this.#statusOfSubscriptions.get(id)! } }),
      );
    } else if (currentState !== state) {
      this.#statusOfSubscriptions.set(id, state);
      this.#onStateChangeCallbacks.get(id)?.(
        new CustomEvent('subscription-state-change', { detail: { state: this.#statusOfSubscriptions.get(id)! } }),
      );
    }
  }

  #handleMessage(message: unknown) {
    if (isClientMessage(message)) {
      const { id } = message;
      const endpointInfo = this.#endpointInfos.get(id);

      if (message['@type'] === 'update') {
        const callback = this.#onNextCallbacks.get(id);
        if (callback) {
          callback(message.item);
        }
        this.#setSubscriptionConnState(id, FluxSubscriptionState.CONNECTED);
      } else if (message['@type'] === 'complete') {
        this.#onCompleteCallbacks.get(id)?.();
        this.#removeSubscription(id);
      } else {
        const callback = this.#onErrorCallbacks.get(id);
        if (callback) {
          callback(message.message);
        }
        this.#removeSubscription(id);
        if (!callback) {
          throw new Error(
            endpointInfo
              ? `Error in ${endpointInfo.endpointName}.${endpointInfo.methodName}(${JSON.stringify(endpointInfo.params)}): ${message.message}`
              : `Error in unknown subscription: ${message.message}`,
          );
        }
      }
    } else {
      throw new Error(`Unknown message from server: ${String(message)}`);
    }
  }

  #removeSubscription(id: string) {
    this.#setSubscriptionConnState(id, FluxSubscriptionState.CLOSED);
    this.#statusOfSubscriptions.delete(id);
    this.#onStateChangeCallbacks.delete(id);
    this.#onNextCallbacks.delete(id);
    this.#onCompleteCallbacks.delete(id);
    this.#onErrorCallbacks.delete(id);
    this.#endpointInfos.delete(id);
  }

  #send(message: ServerMessage) {
    if (this.state === State.INACTIVE) {
      this.#pendingMessages.push(message);
    } else {
      this.#socket?.push?.(JSON.stringify(message));
    }
  }

  #sendPendingMessages() {
    this.#pendingMessages.forEach((msg) => this.#send(msg));
    this.#pendingMessages = [];
  }
}

export interface FluxConnection {
  addEventListener<T extends keyof EventMap>(type: T, listener: ListenerType<T>): void;
  removeEventListener<T extends keyof EventMap>(type: T, listener: ListenerType<T>): void;
}
