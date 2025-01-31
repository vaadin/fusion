/* eslint-disable no-new */
import { ConnectionState, ConnectionStateStore } from '@vaadin/common-frontend';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiLike from 'chai-like';
import fetchMock from 'fetch-mock';
import sinon from 'sinon';
import type { WritableDeep } from 'type-fest';
import type { MiddlewareContext, MiddlewareNext } from '../src/Connect.js';
import CookieManager from '../src/CookieManager.js';
import { SPRING_CSRF_COOKIE_NAME, VAADIN_CSRF_COOKIE_NAME, VAADIN_CSRF_HEADER } from '../src/CsrfUtils.js';
import {
  ConnectClient,
  EndpointError,
  EndpointResponseError,
  EndpointValidationError,
  ForbiddenResponseError,
  type MiddlewareFunction,
  UnauthorizedResponseError,
  bodyPartName,
} from '../src/index.js';
import type { Vaadin } from '../src/types.js';
import { subscribeStub } from './mocks/atmosphere.js';
import { fluxConnectionSubscriptionStubs } from './mocks/FluxConnection.js';
import {
  clearSpringCsrfMetaTags,
  setupSpringCsrfMetaTags,
  TEST_SPRING_CSRF_HEADER_NAME,
  TEST_SPRING_CSRF_TOKEN_VALUE,
} from './SpringCsrfTestUtils.js';

use(chaiAsPromised);
use(chaiLike);

// `connectClient.call` adds the host and context to the endpoint request.
// we need to add this origin when configuring fetch-mock
const base = window.location.origin;

interface TestVaadinWindow extends Window {
  Vaadin?: WritableDeep<Vaadin>;
}

const $wnd = window as TestVaadinWindow;

describe('@vaadin/hilla-frontend', () => {
  describe('ConnectClient', () => {
    let myMiddleware: MiddlewareFunction;

    before(() => {
      fetchMock.mockGlobal();
    });

    after(() => {
      fetchMock.unmockGlobal();
    });

    beforeEach(() => {
      subscribeStub.resetHistory();
      myMiddleware = async (ctx, next) => next(ctx);

      const connectionStateStore = new ConnectionStateStore(ConnectionState.CONNECTED);
      $wnd.Vaadin = { connectionState: connectionStateStore };
      localStorage.clear();
    });

    afterEach(() => {
      document.body.querySelector('vaadin-connection-indicator')?.remove();
      delete $wnd.Vaadin;
    });

    it('should be exported', () => {
      expect(ConnectClient).to.be.ok;
    });

    it('should instantiate without arguments', () => {
      const client = new ConnectClient();
      expect(client).to.be.instanceOf(ConnectClient);
    });

    it('should add a global connection indicator', () => {
      new ConnectClient();
      expect($wnd.Vaadin?.connectionIndicator).is.not.undefined;
    });

    it('should transition to CONNECTION_LOST on offline and to CONNECTED on subsequent online if Flow.client.TypeScript not loaded', () => {
      new ConnectClient();
      expect($wnd.Vaadin?.connectionState?.state).to.equal(ConnectionState.CONNECTED);
      dispatchEvent(new Event('offline'));
      expect($wnd.Vaadin?.connectionState?.state).to.equal(ConnectionState.CONNECTION_LOST);
      dispatchEvent(new Event('online'));
      expect($wnd.Vaadin?.connectionState?.state).to.equal(ConnectionState.CONNECTED);
    });

    it('should transition to CONNECTION_LOST on offline and to CONNECTED on subsequent online if Flow is loaded but Flow.client.TypeScript not loaded', () => {
      new ConnectClient();
      $wnd.Vaadin!.Flow = {};
      expect($wnd.Vaadin?.connectionState?.state).to.equal(ConnectionState.CONNECTED);
      dispatchEvent(new Event('offline'));
      expect($wnd.Vaadin?.connectionState?.state).to.equal(ConnectionState.CONNECTION_LOST);
      dispatchEvent(new Event('online'));
      expect($wnd.Vaadin?.connectionState?.state).to.equal(ConnectionState.CONNECTED);
    });

    it('should not transition connection state if Flow loaded', () => {
      new ConnectClient();
      $wnd.Vaadin!.Flow = {};
      $wnd.Vaadin!.Flow.clients = {};
      $wnd.Vaadin!.Flow.clients.TypeScript = {};
      expect($wnd.Vaadin?.connectionState?.state).to.equal(ConnectionState.CONNECTED);
      dispatchEvent(new Event('offline'));
      expect($wnd.Vaadin?.connectionState?.state).to.equal(ConnectionState.CONNECTED);
    });

    describe('constructor options', () => {
      it('should support prefix', () => {
        const client = new ConnectClient({ prefix: '/foo' });
        expect(client).to.have.property('prefix', '/foo');
      });

      it('should support middlewares', () => {
        const client = new ConnectClient({ middlewares: [myMiddleware] });
        expect(client).to.have.property('middlewares').deep.equal([myMiddleware]);
      });
    });

    describe('prefix', () => {
      it('should have default prefix', () => {
        const client = new ConnectClient();
        expect(client).to.have.property('prefix', '/connect');
      });

      it('should allow setting new prefix', () => {
        const client = new ConnectClient();
        client.prefix = '/foo';
        expect(client).to.have.property('prefix', '/foo');
      });
    });

    describe('middlewares', () => {
      it('should have empty middlewares by default', () => {
        const client = new ConnectClient();
        expect(client).to.have.property('middlewares').deep.equal([]);
      });

      it('should allow setting middlewares', () => {
        const client = new ConnectClient();
        client.middlewares = [myMiddleware];
        expect(client).to.have.property('middlewares').deep.equal([myMiddleware]);
      });
    });

    describe('call method', () => {
      type FooMethodWithNullValueResponse = Readonly<{
        fooData: 'foo';
        propWithNullValue: null;
      }>;

      let client: ConnectClient;

      beforeEach(() => {
        fetchMock.post(`${base}/connect/FooEndpoint/fooMethod`, { fooData: 'foo' });
        fetchMock.post(`${base}/connect/FooEndpoint/fooMethodWithNullValue`, {
          fooData: 'foo',
          propWithNullValue: null,
        } satisfies FooMethodWithNullValueResponse);
        client = new ConnectClient();
      });

      afterEach(() => {
        fetchMock.removeRoutes().clearHistory();
        CookieManager.remove(VAADIN_CSRF_COOKIE_NAME);
      });

      it('should require 2 arguments', async () => {
        // @ts-expect-error: testing an error
        await expect(client.call()).to.be.rejectedWith(TypeError, '2 arguments required');
        // @ts-expect-error: testing an error
        await expect(client.call('FooEndpoint')).to.be.rejectedWith(TypeError, '2 arguments required');
      });

      it('should fetch endpoint and method from default prefix', async () => {
        expect(fetchMock.callHistory.calls()).to.have.lengthOf(0); // no premature requests

        await client.call('FooEndpoint', 'fooMethod');

        expect(fetchMock.callHistory.calls()).to.have.lengthOf(1);
        expect(fetchMock.callHistory.lastCall()?.url).to.equal(`${base}/connect/FooEndpoint/fooMethod`);
      });

      it('should return Promise', () => {
        const returnValue = client.call('FooEndpoint', 'fooMethod');
        expect(returnValue).to.be.a('promise');
      });

      it('should use POST request', async () => {
        await client.call('FooEndpoint', 'fooMethod');
        expect(fetchMock.callHistory.lastCall()?.options).to.include({ method: 'POST' });
      });

      it('should set connection state to LOADING followed by CONNECTED on successful fetch', async () => {
        const stateChangeListener = sinon.fake();
        $wnd.Vaadin?.connectionState?.addStateChangeListener(stateChangeListener);

        await client.call('FooEndpoint', 'fooMethod');
        expect(stateChangeListener).to.be.calledWithExactly(ConnectionState.LOADING, ConnectionState.CONNECTED);
      });

      it('should set connection state to CONNECTION_LOST on network failure', async () => {
        const stateChangeListener = sinon.fake();
        $wnd.Vaadin?.connectionState?.addStateChangeListener(stateChangeListener);
        fetchMock.post(`${base}/connect/FooEndpoint/reject`, Promise.reject(new TypeError('Network failure')));
        try {
          await client.call('FooEndpoint', 'reject');
        } catch {
          // expected
        } finally {
          expect(stateChangeListener).to.be.calledWithExactly(ConnectionState.LOADING, ConnectionState.CONNECTION_LOST);
        }
      });

      it('should be able to abort a call', async () => {
        const getDelayedOk = async () =>
          new Promise((res) => {
            setTimeout(() => res(200), 500);
          });
        fetchMock.post(`${base}/connect/FooEndpoint/abort`, getDelayedOk());

        const controller = new AbortController();
        const called = client.call('FooEndpoint', 'fooMethod', {}, { signal: controller.signal });
        controller.abort();

        await expect(called).to.be.rejectedWith(DOMException, 'The operation was aborted.');
      });

      it('should  set connection state to CONNECTED upon server error', async () => {
        const body = 'Unexpected error';
        const errorResponse = new Response(body, {
          status: 500,
          statusText: 'Internal Server Error',
        });
        fetchMock.post(`${base}/connect/FooEndpoint/vaadinConnectResponse`, errorResponse);

        try {
          await client.call('FooEndpoint', 'vaadinConnectResponse');
        } catch {
          // expected
        } finally {
          expect($wnd.Vaadin?.connectionState?.state).to.equal(ConnectionState.CONNECTED);
        }
      });

      it('should use JSON request headers', async () => {
        await client.call('FooEndpoint', 'fooMethod');

        expect(fetchMock.callHistory.lastCall()?.options.headers).to.deep.include({
          accept: 'application/json',
          'content-type': 'application/json',
        });
      });

      it('should set header for preventing CSRF', async () => {
        await client.call('FooEndpoint', 'fooMethod');

        expect(fetchMock.callHistory.lastCall()?.options.headers).to.deep.include({
          [VAADIN_CSRF_HEADER.toLowerCase()]: '',
        });
      });

      it('should set header for preventing CSRF using Spring csrf when presents in cookie', async () => {
        try {
          CookieManager.set(SPRING_CSRF_COOKIE_NAME, TEST_SPRING_CSRF_TOKEN_VALUE);
          setupSpringCsrfMetaTags();

          await client.call('FooEndpoint', 'fooMethod');

          expect(fetchMock.callHistory.lastCall()?.options.headers).to.deep.include({
            [TEST_SPRING_CSRF_HEADER_NAME]: TEST_SPRING_CSRF_TOKEN_VALUE,
          });
        } finally {
          CookieManager.remove(SPRING_CSRF_COOKIE_NAME);
          clearSpringCsrfMetaTags();
        }
      });

      it('should set header for preventing CSRF using Spring csrf when presents in meta tags', async () => {
        try {
          setupSpringCsrfMetaTags();

          await client.call('FooEndpoint', 'fooMethod');

          expect(fetchMock.callHistory.lastCall()?.options.headers).to.deep.include({
            [TEST_SPRING_CSRF_HEADER_NAME]: TEST_SPRING_CSRF_TOKEN_VALUE,
          });
        } finally {
          clearSpringCsrfMetaTags();
        }
      });

      it('should set header for preventing CSRF using Hilla csrfToken cookie when no Spring csrf token presents', async () => {
        const csrfToken = 'foo';
        CookieManager.set(VAADIN_CSRF_COOKIE_NAME, csrfToken);

        await client.call('FooEndpoint', 'fooMethod');

        expect(fetchMock.callHistory.lastCall()?.options.headers).to.deep.include({
          [VAADIN_CSRF_HEADER.toLowerCase()]: csrfToken,
        });
      });

      it('should set header for preventing CSRF using Hilla csrf when having Spring csrf meta tags with string undefined', async () => {
        try {
          // happens when spring csrf is disabled
          // https://github.com/vaadin/hilla/issues/185
          setupSpringCsrfMetaTags('undefined', 'undefined');

          const csrfToken = 'foo';
          CookieManager.set(VAADIN_CSRF_COOKIE_NAME, csrfToken);

          await client.call('FooEndpoint', 'fooMethod');

          expect(fetchMock.callHistory.lastCall()?.options.headers).to.deep.include({
            [VAADIN_CSRF_HEADER.toLowerCase()]: csrfToken,
          });
        } finally {
          CookieManager.remove('csrfToken');
          clearSpringCsrfMetaTags();
        }
      });

      it('should resolve to response JSON data', async () => {
        const data = await client.call('FooEndpoint', 'fooMethod');
        expect(data).to.deep.equal({ fooData: 'foo' });
      });

      it('should transform null value to undefined from response JSON data', async () => {
        const data = (await client.call('FooEndpoint', 'fooMethodWithNullValue')) as FooMethodWithNullValueResponse;
        expect(data.propWithNullValue).to.be.undefined;
        expect(data).to.deep.equal({ fooData: 'foo' });
      });

      it('should reject if response is not ok', async () => {
        fetchMock.post(`${base}/connect/FooEndpoint/notFound`, 404);
        let thrownError;
        try {
          await client.call('FooEndpoint', 'notFound');
        } catch (err) {
          thrownError = err;
        }
        expect(thrownError)
          .to.be.instanceOf(EndpointError)
          .and.have.property('message')
          .that.has.string('404 Not Found');
      });

      it('should reject with extra parameters in the exception if response body has the data', async () => {
        const expectedObject = {
          detail: { one: 'two' },
          message: 'Something bad happened on the backend side',
          type: 'java.lang.IllegalStateException',
        };
        fetchMock.post(`${base}/connect/FooEndpoint/vaadinException`, {
          body: expectedObject,
          status: 400,
        });

        let thrownError;
        try {
          await client.call('FooEndpoint', 'vaadinException');
        } catch (err) {
          thrownError = err;
        }
        expect(thrownError).to.be.instanceOf(EndpointError);
        expect(thrownError).to.have.property('message').that.is.string(expectedObject.message);
        expect(thrownError).to.have.property('type').that.is.string(expectedObject.type);
        expect(thrownError).to.have.deep.property('detail', expectedObject.detail);
      });

      it('should reject with extra unexpected response parameters in the exception if response body has the data', async () => {
        const body = 'Unexpected error';
        const errorResponse = new Response(body, {
          status: 500,
          statusText: 'Internal Server Error',
        });
        fetchMock.post(`${base}/connect/FooEndpoint/vaadinConnectResponse`, errorResponse);

        let thrownError;
        try {
          await client.call('FooEndpoint', 'vaadinConnectResponse');
        } catch (err) {
          thrownError = err;
        }
        expect(thrownError).to.be.instanceOf(EndpointResponseError);
        expect(thrownError).to.have.property('message').that.is.string(body);
        expect(thrownError)
          .to.have.deep.property('response')
          .that.satisfies(
            (response: Response) =>
              response.status === errorResponse.status && response.statusText === errorResponse.statusText,
          );
      });

      it('should reject with unauthorized error', async () => {
        const errorResponse = new Response('{"message": "Unauthorized"}', {
          status: 401,
          statusText: 'Unauthorized',
        });
        fetchMock.post(`${base}/connect/FooEndpoint/vaadinUnauthResponse`, errorResponse);

        let thrownError;
        try {
          await client.call('FooEndpoint', 'vaadinUnauthResponse');
        } catch (err) {
          thrownError = err;
        }
        expect(thrownError).to.be.instanceOf(UnauthorizedResponseError);
        expect(thrownError).to.have.deep.property('status', errorResponse.status);
      });

      it('should reject with forbidden error', async () => {
        const errorResponse = new Response('{"message": "Forbidden"}', {
          status: 403,
          statusText: 'Forbidden',
        });
        fetchMock.post(`${base}/connect/FooEndpoint/vaadinForbiddenResponse`, errorResponse);

        let thrownError;
        try {
          await client.call('FooEndpoint', 'vaadinForbiddenResponse');
        } catch (err) {
          thrownError = err;
        }
        expect(thrownError).to.be.instanceOf(ForbiddenResponseError);
        expect(thrownError).to.have.deep.property('status', errorResponse.status);
      });

      it('should reject with extra validation parameters in the exception if response body has the data', async () => {
        const expectedObject = {
          message: 'Validation failed',
          type: 'com.vaadin.connect.exception.EndpointValidationException',
          validationErrorData: [
            {
              message: 'Input cannot be an empty or blank string',
              parameterName: 'input',
            },
          ],
        };
        fetchMock.post(`${base}/connect/FooEndpoint/validationException`, {
          body: expectedObject,
          status: 400,
        });

        let thrownError;
        try {
          await client.call('FooEndpoint', 'validationException');
        } catch (err) {
          thrownError = err;
        }
        expect(thrownError).to.be.instanceOf(EndpointValidationError);
        expect(thrownError).to.have.property('message').that.is.string(expectedObject.message);
        expect(thrownError).to.have.property('type').that.is.string(expectedObject.type);
        expect(thrownError).to.have.property('detail');
        expect(thrownError).to.have.deep.property('validationErrorData', expectedObject.validationErrorData);
      });

      it('should reject if fetch is rejected', async () => {
        fetchMock.post(`${base}/connect/FooEndpoint/reject`, Promise.reject(new TypeError('Network failure')));

        let thrownError;
        try {
          await client.call('FooEndpoint', 'reject');
        } catch (err) {
          thrownError = err;
        }
        expect(thrownError).to.be.instanceOf(TypeError).and.have.property('message').that.has.string('Network failure');
      });

      it('should fetch from custom prefix', async () => {
        fetchMock.post(`${base}/fooPrefix/BarEndpoint/barMethod`, { barData: 'bar' });

        client.prefix = '/fooPrefix';
        const data = await client.call('BarEndpoint', 'barMethod');

        expect(data).to.deep.equal({ barData: 'bar' });
        expect(fetchMock.callHistory.lastCall()?.url).to.equal(`${base}/fooPrefix/BarEndpoint/barMethod`);
      });

      it('should pass 3rd argument as JSON request body', async () => {
        await client.call('FooEndpoint', 'fooMethod', { fooParam: 'foo' });

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- false positive
        const { request } = fetchMock.callHistory.lastCall() ?? {};
        expect(request).to.exist;
        expect(await request?.json()).to.deep.equal({ fooParam: 'foo' });
      });

      it('should use multipart if a param is of File type', async () => {
        const file = new File(['foo'], 'foo.txt', { type: 'text/plain' });
        await client.call('FooEndpoint', 'fooMethod', { fooParam: file });

        const request = fetchMock.callHistory.lastCall()?.request;
        expect(request).to.exist;
        expect(request?.headers.get('content-type')).to.match(/^multipart\/form-data;/u);
        const formData = await request!.formData();

        const uploadedFile = formData.get('/fooParam') as File | null;
        expect(uploadedFile).to.be.instanceOf(File);
        expect(uploadedFile!.name).to.equal('foo.txt');
        expect(await uploadedFile!.text()).to.equal('foo');

        const body = formData.get(bodyPartName);
        expect(body).to.equal('{}');
      });

      it('should use multipart if a param has a property if File type', async () => {
        const file = new File(['foo'], 'foo.txt', { type: 'text/plain' });
        await client.call('FooEndpoint', 'fooMethod', { fooParam: { a: 'abc', b: file } });

        const request = fetchMock.callHistory.lastCall()?.request;
        expect(request).to.exist;
        expect(request?.headers.get('content-type')).to.match(/^multipart\/form-data;/u);
        const formData = await request!.formData();

        const uploadedFile = formData.get('/fooParam/b') as File | null;
        expect(uploadedFile).to.be.instanceOf(File);
        expect(uploadedFile!.name).to.equal('foo.txt');
        expect(await uploadedFile!.text()).to.equal('foo');

        const body = formData.get(bodyPartName);
        expect(body).to.equal('{"fooParam":{"a":"abc"}}');
      });

      it('should use multipart if a File is found in array', async () => {
        const file = new File(['foo'], 'foo.txt', { type: 'text/plain' });
        await client.call('FooEndpoint', 'fooMethod', { fooParam: ['a', file, 'c'], other: 'abc' });

        const request = fetchMock.callHistory.lastCall()?.request;
        expect(request).to.exist;
        expect(request?.headers.get('content-type')).to.match(/^multipart\/form-data;/u);
        const formData = await request!.formData();

        const uploadedFile = formData.get('/fooParam/1') as File | null;
        expect(uploadedFile).to.be.instanceOf(File);
        expect(uploadedFile!.name).to.equal('foo.txt');
        expect(await uploadedFile!.text()).to.equal('foo');

        const body = formData.get(bodyPartName);
        expect(body).to.equal('{"fooParam":["a",null,"c"],"other":"abc"}');
      });

      describe('middleware invocation', () => {
        it('should not invoke middleware before call', () => {
          const spyMiddleware = sinon.spy(async (context: MiddlewareContext, next: MiddlewareNext) => next(context));
          client.middlewares = [spyMiddleware];

          expect(spyMiddleware).to.not.be.called;
        });

        it('should invoke middleware during call', async () => {
          const spyMiddleware = sinon.spy(async (context: MiddlewareContext, next: MiddlewareNext) => {
            expect(context.endpoint).to.equal('FooEndpoint');
            expect(context.method).to.equal('fooMethod');
            expect(context.params).to.deep.equal({ fooParam: 'foo' });
            expect(context.request).to.be.instanceOf(Request);
            return next(context);
          });
          client.middlewares = [spyMiddleware];

          await client.call('FooEndpoint', 'fooMethod', { fooParam: 'foo' });

          expect(spyMiddleware).to.be.calledOnce;
        });

        it('should allow modified request', async () => {
          const myUrl = 'https://api.example.com/';
          fetchMock.post(myUrl, {});

          myMiddleware = async (context, next) => {
            context.request = new Request(myUrl, {
              body: '{"baz": "qux"}',
              headers: { ...context.request.headers, 'X-Foo': 'Bar' },
              method: 'POST',
            });

            return next(context);
          };

          client.middlewares = [myMiddleware];
          await client.call('FooEndpoint', 'fooMethod', { fooParam: 'foo' });

          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- false positive
          const { request } = fetchMock.callHistory.lastCall() ?? {};
          expect(request?.url).to.equal(myUrl);
          expect(request?.headers.get('X-Foo')).to.equal('Bar');
          expect(await request?.text()).to.equal('{"baz": "qux"}');
        });

        it('should allow modified response', async () => {
          myMiddleware = (_context: any, _next?: any) => new Response('{"baz": "qux"}');

          client.middlewares = [myMiddleware];
          const responseData = await client.call('FooEndpoint', 'fooMethod', { fooParam: 'foo' });

          expect(responseData).to.deep.equal({ baz: 'qux' });
        });

        it('should invoke middlewares in order', async () => {
          const firstMiddleware = sinon.spy(async (context: MiddlewareContext, next: MiddlewareNext) => {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            expect(secondMiddleware).to.not.be.called;
            const response = await next(context);
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            expect(secondMiddleware).to.be.calledOnce;
            return response;
          });

          const secondMiddleware = sinon.spy(async (context: MiddlewareContext, next: MiddlewareNext) => {
            expect(firstMiddleware).to.be.calledOnce;
            return next(context);
          });

          client.middlewares = [firstMiddleware, secondMiddleware];

          expect(firstMiddleware).to.not.be.called;
          expect(secondMiddleware).to.not.be.called;

          await client.call('FooEndpoint', 'fooMethod', { fooParam: 'foo' });

          expect(firstMiddleware).to.be.calledOnce;
          expect(secondMiddleware).to.be.calledOnce;
          expect(firstMiddleware).to.be.calledBefore(secondMiddleware);
        });

        it('should carry the context and the response', async () => {
          const myRequest = new Request('');
          const myResponse = new Response('{}');
          const myContext = { endpoint: 'Bar', foo: 'bar', method: 'bar', request: myRequest };

          const firstMiddleware = async (_: MiddlewareContext, next: MiddlewareNext) => {
            // Pass modified context
            const response = await next(myContext);
            // Expect modified response
            expect(response).to.equal(myResponse);
            return response;
          };

          const secondMiddleware = (context: MiddlewareContext, _: MiddlewareNext) => {
            // Expect modified context
            expect(context).to.equal(myContext);
            // Pass modified response
            return myResponse;
          };

          client.middlewares = [firstMiddleware, secondMiddleware];
          await client.call('FooEndpoint', 'fooMethod', { fooParam: 'foo' });
        });
      });
    });

    describe('subscribe method', () => {
      let client: ConnectClient;

      beforeEach(() => {
        client = new ConnectClient();
      });

      it('should create a fluxConnection', () => {
        client.subscribe('FooEndpoint', 'fooMethod');
        expect(fluxConnectionSubscriptionStubs.at(-1)).to.have.been.calledOnce;
      });

      it('should reuse the fluxConnection', () => {
        client.subscribe('FooEndpoint', 'fooMethod');
        const { fluxConnection } = client;
        client.subscribe('FooEndpoint', 'barMethod');
        expect(client.fluxConnection).to.equal(fluxConnection);
      });

      it('should call FluxConnection', () => {
        client.subscribe('FooEndpoint', 'fooMethod', { param: 1 });
        expect(fluxConnectionSubscriptionStubs.at(-1)).to.have.been.calledOnceWith('FooEndpoint', 'fooMethod', [1]);
      });
    });

    describe('atmosphere configuration', () => {
      let client: ConnectClient;

      it('should pass custom configuration to flux connection', () => {
        client = new ConnectClient({ atmosphereOptions: { fallbackMethod: 'fake' } });
        const { fluxConnection: _ } = client;
        expect(subscribeStub.lastCall.firstArg).to.have.property('fallbackMethod').which.equals('fake');
      });
    });
  });
});
