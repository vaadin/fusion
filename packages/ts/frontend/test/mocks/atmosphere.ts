import atmosphere from 'atmosphere.js';
import sinon from 'sinon';
import type { TupleToUnion } from 'type-fest';

export const subscriptionEventNames = [
  'onClientTimeout',
  'onClose',
  'onError',
  'onFailureToReconnect',
  'onLocalMessage',
  'onMessage',
  'onMessagePublished',
  'onOpen',
  'onReconnect',
  'onReopen',
  'onTransportFailure',
  'push',
] as const;

export type SubscriptionEventSpies = Readonly<{
  [P in TupleToUnion<typeof subscriptionEventNames>]?: sinon.SinonSpy<
    Parameters<Required<Atmosphere.Request>[P]>,
    ReturnType<Required<Atmosphere.Request>[P]>
  >;
}>;

let subscriptionEventSpies: SubscriptionEventSpies | undefined;

export function getSubscriptionEventSpies(): SubscriptionEventSpies | undefined {
  return subscriptionEventSpies;
}

export type AtmosphereSubscribe = Required<Atmosphere.Atmosphere>['subscribe'];

export const subscribeStub: sinon.SinonStub<Parameters<AtmosphereSubscribe>, ReturnType<AtmosphereSubscribe>> = sinon
  .stub(atmosphere as Required<Atmosphere.Atmosphere>, 'subscribe')
  .callsFake((request: Atmosphere.Request) => {
    // We already have the call registered when we come here for the first time.
    // So we have to compare with 1, not 0.
    if (subscribeStub.callCount > 1) {
      throw new Error('Atmosphere subscribe called while already subscribed');
    }

    subscriptionEventSpies = Object.fromEntries(
      subscriptionEventNames.map((prop) => {
        if (typeof request[prop] === 'undefined') {
          request[prop] = sinon.spy();
          return [prop, request[prop]];
        }

        return [prop, sinon.spy(request, prop)];
      }),
    );
    request.onOpen?.();

    return request;
  });

export default atmosphere;
