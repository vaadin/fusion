import type { ReactiveControllerHost } from '@lit/reactive-element';
import atmosphere from 'atmosphere.js';
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

export enum HandleSubscriptionLoss {
  RESUBSCRIBE = 'resubscribe',
  REMOVE = 'remove',
}

type EndpointInfo = {
  endpointName: string;
  methodName: string;
  params: unknown[] | undefined;
  reconnect?(): HandleSubscriptionLoss | undefined;
};

/**
 * A representation of the underlying persistent network connection used for subscribing to Flux type endpoint methods.
 */
export class FluxConnection extends EventTarget {
  state: State = State.INACTIVE;
  readonly #endpointInfos = new Map<string, EndpointInfo>();
  #nextId = 0;
  readonly #onCompleteCallbacks = new Map<string, () => void>();
  readonly #onErrorCallbacks = new Map<string, () => void>();
  readonly #onNextCallbacks = new Map<string, (value: any) => void>();
  readonly #onDisconnectCallbacks = new Map<string, () => void>();
  #pendingMessages: ServerMessage[] = [];
  #socket?: Atmosphere.Request;

  constructor(connectPrefix: string, atmosphereOptions?: Partial<Atmosphere.Request>) {
    super();
    this.#connectWebsocket(connectPrefix.replace(/connect$/u, ''), atmosphereOptions ?? {});
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
      onError: (callback: () => void): Subscription<any> => {
        this.#onErrorCallbacks.set(id, callback);
        return hillaSubscription;
      },
      onNext: (callback: (value: any) => void): Subscription<any> => {
        this.#onNextCallbacks.set(id, callback);
        return hillaSubscription;
      },
      onDisconnect: (callback: () => void): Subscription<any> => {
        this.#onDisconnectCallbacks.set(id, callback);
        return hillaSubscription;
      },
      onSubscriptionLost: (callback: () => HandleSubscriptionLoss | undefined): Subscription<any> => {
        if (this.#endpointInfos.has(id)) {
          this.#endpointInfos.get(id)!.reconnect = callback;
        } else {
          console.warn(`"onReconnect" value not set for subscription "${id}" because it was already canceled`);
        }
        return hillaSubscription;
      },
    };
    return hillaSubscription;
  }

  #connectWebsocket(prefix: string, atmosphereOptions: Partial<Atmosphere.Request>) {
    const extraHeaders = getCsrfTokenHeadersForEndpointRequest(document);
    const pushUrl = 'HILLA/push';
    const url = prefix.length === 0 ? pushUrl : (prefix.endsWith('/') ? prefix : `${prefix}/`) + pushUrl;
    this.#socket = atmosphere.subscribe?.({
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
          this.state = State.ACTIVE;
          this.dispatchEvent(new CustomEvent('state-changed', { detail: { active: true } }));
          this.#sendPendingMessages();
        }
      },
      onReopen: () => {
        if (this.state !== State.ACTIVE) {
          const toBeRemoved: string[] = [];
          this.#endpointInfos.forEach((endpointInfo, id) => {
            switch (endpointInfo.reconnect?.()) {
              case HandleSubscriptionLoss.RESUBSCRIBE:
                this.#send({
                  '@type': 'subscribe',
                  endpointName: endpointInfo.endpointName,
                  id,
                  methodName: endpointInfo.methodName,
                  params: endpointInfo.params,
                });
                break;
              default:
                toBeRemoved.push(id);
            }
          });
          toBeRemoved.forEach((id) => this.#removeSubscription(id));

          this.state = State.ACTIVE;
          this.dispatchEvent(new CustomEvent('state-changed', { detail: { active: true } }));
          this.#sendPendingMessages();
        }
      },
      onReconnect: () => {
        if (this.state !== State.RECONNECTING) {
          this.state = State.RECONNECTING;
          this.#onDisconnectCallbacks.forEach((callback) => callback());
        }
      },
      onFailureToReconnect: () => {
        if (this.state !== State.INACTIVE) {
          this.state = State.INACTIVE;
          this.dispatchEvent(new CustomEvent('state-changed', { detail: { active: false } }));
        }
      },
      ...atmosphereOptions,
    } satisfies Atmosphere.Request);
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
      } else if (message['@type'] === 'complete') {
        this.#onCompleteCallbacks.get(id)?.();
        this.#removeSubscription(id);
      } else {
        const callback = this.#onErrorCallbacks.get(id);
        if (callback) {
          callback();
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
    this.#onNextCallbacks.delete(id);
    this.#onCompleteCallbacks.delete(id);
    this.#onErrorCallbacks.delete(id);
    this.#endpointInfos.delete(id);
    this.#onDisconnectCallbacks.delete(id);
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
