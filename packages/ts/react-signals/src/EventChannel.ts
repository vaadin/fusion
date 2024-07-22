import type { ConnectClient, Subscription } from '@vaadin/hilla-frontend';
import { NumberSignal, setInternalValue, type ValueSignal } from './Signals.js';
import SignalsHandler from './SignalsHandler';
import type { StateEvent, SnapshotEvent } from './types.js';

/**
 * The type that describes the needed information to
 * subscribe and publish to a server-side signal instance.
 */
type SignalChannelDescriptor<T> = Readonly<{
  signalProviderEndpointMethod: string;
  subscribe(channelDescriptor: string, clientSignalId: string): Subscription<T>;
  publish(clientSignalId: string, event: T): Promise<void>;
}>;

/**
 * A generic class that represents a signal channel
 * that can be used to communicate with a server-side
 * signal instance.
 *
 * The signal channel is responsible for subscribing to
 * the server-side signal and updating the local signal
 * based on the received events.
 *
 * @typeParam T - The type of the signal value.
 * @typeParam S - The type of the signal instance.
 */
abstract class SignalChannel<T, S extends ValueSignal<T>> {
  readonly #channelDescriptor: SignalChannelDescriptor<string>;
  readonly #signalsHandler: SignalsHandler;
  readonly #id: string;

  readonly #internalSignal: S;

  constructor(signalProviderServiceMethod: string, connectClient: ConnectClient) {
    this.#id = crypto.randomUUID();
    this.#signalsHandler = new SignalsHandler(connectClient);
    this.#channelDescriptor = {
      signalProviderEndpointMethod: signalProviderServiceMethod,
      subscribe: (signalProviderEndpointMethod: string, signalId: string) =>
        this.#signalsHandler.subscribe(signalProviderEndpointMethod, signalId),
      publish: async (signalId: string, event: string) => this.#signalsHandler.update(signalId, event),
    };

    this.#internalSignal = this.createInternalSignal(async (event: StateEvent) => this.publish(event));

    this.#connect();
  }

  #connect() {
    this.#channelDescriptor.subscribe(this.#channelDescriptor.signalProviderEndpointMethod, this.#id).onNext((json) => {
      const event = JSON.parse(json) as SnapshotEvent;
      // Update signals based on the new value from the event:
      this.#updateSignals(event);
    });
  }

  #updateSignals(snapshotEvent: SnapshotEvent): void {
    if (snapshotEvent.value !== undefined) {
      setInternalValue(this.#internalSignal, snapshotEvent.value);
    }
  }

  async publish(event: StateEvent): Promise<boolean> {
    await this.#channelDescriptor.publish(this.#id, JSON.stringify(event));
    return true;
  }

  /**
   * Returns the signal instance to be used in components.
   */
  get signal(): S {
    return this.#internalSignal;
  }

  abstract createInternalSignal(publish: (event: StateEvent) => Promise<boolean>, initialValue?: T): S;
}

/**
 * A signal channel that is used to communicate with a
 * server-side signal instance that holds a number value.
 */
export class NumberSignalChannel extends SignalChannel<number, NumberSignal> {
  override createInternalSignal(publish: (event: StateEvent) => Promise<boolean>, initialValue?: number): NumberSignal {
    return new NumberSignal(publish, initialValue);
  }
}
