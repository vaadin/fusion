// Load feature flag file before importing any other modules
// eslint-disable-next-line import/no-unassigned-import
import './enable-feature-flag.js';
import { render } from '@testing-library/react';
import CookieManager from '@vaadin/hilla-frontend/CookieManager.js';
import { effect, useComputed, useSignalEffect } from '@vaadin/hilla-react-signals';
import fetchMock from 'fetch-mock';
import { useEffect, useMemo } from 'react';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { describe, it, beforeEach, afterEach, expect, chai } from 'vitest';
import { FormatCache } from '../src/FormatCache.js';
import { i18n as globalI18n, I18n, translate as globalTranslate } from '../src/index.js';
import type { LanguageSettings } from '../src/settings.js';

chai.use(sinonChai);

describe('@vaadin/hilla-react-i18n', () => {
  describe('i18n', () => {
    let i18n: I18n;

    function getSettingsCookie(): LanguageSettings | undefined {
      const cookie = CookieManager.get('vaadinLanguageSettings');
      return cookie && JSON.parse(cookie);
    }

    function setSettingsCookie(settings: LanguageSettings) {
      CookieManager.set('vaadinLanguageSettings', JSON.stringify(settings));
    }

    function setInvalidSettingsCookie() {
      CookieManager.set('vaadinLanguageSettings', 'foo');
    }

    function clearSettingsCookie() {
      CookieManager.remove('vaadinLanguageSettings');
    }

    function verifyLoadTranslations(language: string) {
      expect(fetchMock.called(`./?v-r=i18n&langtag=${language}`)).to.be.true;
    }

    beforeEach(() => {
      clearSettingsCookie();
      i18n = new I18n();
      fetchMock
        .get('./?v-r=i18n&langtag=de-DE', {
          body: {
            'addresses.form.city.label': 'Stadt',
            'addresses.form.street.label': 'Strasse',
          },
          status: 200,
          headers: { 'X-Vaadin-Retrieved-Locale': 'de-DE' },
        })
        .get('./?v-r=i18n&langtag=not-found', 404)
        .get('./?v-r=i18n&langtag=unknown', {
          body: {
            'addresses.form.city.label': 'Sehir',
            'addresses.form.street.label': 'Sokak',
          },
          status: 200,
        })
        .get('*', {
          body: {
            'addresses.form.city.label': 'City',
            'addresses.form.street.label': 'Street',
          },
          status: 200,
          headers: { 'X-Vaadin-Retrieved-Locale': 'und' },
        });
    });

    afterEach(() => {
      fetchMock.restore();
    });

    describe('configure', () => {
      it('should use browser language by default', async () => {
        await i18n.configure();

        expect(i18n.language.value).to.equal(navigator.language);
        verifyLoadTranslations(navigator.language);
      });

      it('should use last used language if defined', async () => {
        setSettingsCookie({ language: 'zh-Hant' });
        await i18n.configure();

        expect(i18n.language.value).to.equal('zh-Hant');
        expect(i18n.resolvedLanguage.value).to.equal('und');
        verifyLoadTranslations('zh-Hant');
      });

      it('should use browser language if settings cookie is invalid', async () => {
        setInvalidSettingsCookie();
        await i18n.configure();

        expect(i18n.language.value).to.equal(navigator.language);
        verifyLoadTranslations(navigator.language);
      });

      it('should use explicitly configured language if specified', async () => {
        await i18n.configure({ language: 'zh-Hant' });

        expect(i18n.language.value).to.equal('zh-Hant');
        expect(i18n.resolvedLanguage.value).to.equal('und');
        verifyLoadTranslations('zh-Hant');
      });

      it('should prefer explicitly configured language over last used language', async () => {
        setSettingsCookie({ language: 'de-DE' });
        await i18n.configure({ language: 'zh-Hant' });

        expect(i18n.language.value).to.equal('zh-Hant');
        expect(i18n.resolvedLanguage.value).to.equal('und');
        verifyLoadTranslations('zh-Hant');
      });

      it('should not store last used language when initializing', async () => {
        await i18n.configure();

        expect(getSettingsCookie()?.language).to.not.exist;
      });

      it('should not throw when loading translations fails', async () => {
        const initialLanguage = i18n.language.value;
        await i18n.configure({ language: 'not-found' });

        expect(i18n.language.value).to.equal(initialLanguage);
        expect(i18n.resolvedLanguage.value).to.equal(initialLanguage);
      });

      it('should mark itself as initialized after configuration', async () => {
        expect(i18n.initialized.value).to.be.false;
        await i18n.configure();
        expect(i18n.initialized.value).to.be.true;
      });
    });

    describe('language', () => {
      const initialLanguage = 'en-US';
      const initialResolvedLanguage = 'und';

      beforeEach(async () => {
        await i18n.configure({ language: initialLanguage });
        fetchMock.resetHistory();
      });

      it('should return current language', () => {
        expect(i18n.language.value).to.equal(initialLanguage);
        expect(i18n.resolvedLanguage.value).to.equal(initialResolvedLanguage);
      });

      it('should set language and load translations', async () => {
        await i18n.setLanguage('de-DE');

        expect(i18n.language.value).to.equal('de-DE');
        expect(i18n.resolvedLanguage.value).to.equal('de-DE');
        verifyLoadTranslations('de-DE');
      });

      it('should store last used language', async () => {
        await i18n.setLanguage('de-DE');

        expect(getSettingsCookie()?.language).to.equal('de-DE');
      });

      it('should not load translations if language is unchanged', async () => {
        await i18n.setLanguage(initialLanguage);

        expect(i18n.language.value).to.equal(initialLanguage);
        expect(i18n.resolvedLanguage.value).to.equal(initialResolvedLanguage);
        expect(fetchMock.called()).to.be.false;
      });

      it('should still load translations if resolved language is empty', async () => {
        await i18n.setLanguage('unknown');

        expect(i18n.language.value).to.equal('unknown');
        expect(i18n.resolvedLanguage.value).to.equal(undefined);
        verifyLoadTranslations('unknown');
      });
    });

    describe('chunked loading', () => {
      const language = 'en';

      beforeEach(() => {
        fetchMock
          .reset()
          .get('/?v-r=i18n&langtag=en&chunks=city', {
            body: {
              'addresses.form.city.label': 'City Chunked',
            },
          })
          .get('/?v-r=i18n&langtag=en&chunks=street', {
            body: {
              'addresses.form.street.label': 'Street Chunked',
            },
          })
          .get('/?v-r=i18n&langtag=en&chunks=city&chunks=street', {
            body: {
              'addresses.form.city.label': 'City Chunked',
              'addresses.form.street.label': 'Street Chunked',
            },
          })
          .get('/?v-r=i18n&langtag=en-AU&chunks=city', {
            body: {
              'addresses.form.city.label': 'Australian City Chunked',
            },
          })
          .get('/?v-r=i18n&langtag=en-AU&chunks=street', {
            body: {
              'addresses.form.street.label': 'Australian Street Chunked',
            },
          })
          .get('/?v-r=i18n&langtag=en-AU&chunks=city&chunks=street', {
            body: {
              'addresses.form.city.label': 'Australian City Chunked',
              'addresses.form.street.label': 'Australian Street Chunked',
            },
          });
      });

      function getLastUrlParams() {
        return new URLSearchParams(new URL(fetchMock.lastUrl() ?? '', document.baseURI).search);
      }

      it('should not load chunks unless configured', async () => {
        await i18n.registerChunk('city');

        // Neither chunks are loaded
        expect(i18n.translate('addresses.form.city.label')).to.equal('addresses.form.city.label');
        expect(i18n.translate('addresses.form.street.label')).to.equal('addresses.form.street.label');
        expect(fetchMock.called()).to.be.false;
      });

      it('should load registered chunk after configured', async () => {
        await i18n.registerChunk('city');
        await i18n.configure({ language });

        // City chunk is loaded
        expect(i18n.translate('addresses.form.city.label')).to.equal('City Chunked');

        // Street chunk is not loaded yet
        expect(i18n.translate('addresses.form.street.label')).to.equal('addresses.form.street.label');
        expect(fetchMock.called()).to.be.true;
        expect(fetchMock.calls()).to.have.length(1);
        expect(getLastUrlParams().getAll('chunks')).to.deep.equal(['city']);
      });

      it('should load all chunks after configured', async () => {
        await i18n.registerChunk('city');
        await i18n.registerChunk('street');
        await i18n.configure({ language });

        // Both chunks are loaded
        expect(i18n.translate('addresses.form.city.label')).to.equal('City Chunked');
        expect(i18n.translate('addresses.form.street.label')).to.equal('Street Chunked');
        expect(fetchMock.called()).to.be.true;
        expect(fetchMock.calls()).to.have.length(1);
        expect(getLastUrlParams().getAll('chunks')).to.deep.equal(['city', 'street']);
      });

      it('should load additional chunks after configured', async () => {
        await i18n.registerChunk('city');
        await i18n.configure({ language });
        fetchMock.resetHistory();

        await i18n.registerChunk('street');

        // Both chunks are loaded
        expect(i18n.translate('addresses.form.city.label')).to.equal('City Chunked');
        expect(i18n.translate('addresses.form.street.label')).to.equal('Street Chunked');
        expect(fetchMock.called()).to.be.true;
        expect(fetchMock.calls()).to.have.length(1);
        expect(getLastUrlParams().getAll('chunks')).to.deep.equal(['street']);
      });

      it('should load registered chunk when switching language', async () => {
        await i18n.registerChunk('city');
        await i18n.configure({ language });
        fetchMock.resetHistory();

        await i18n.setLanguage('en-AU');

        // City chunk is loaded
        expect(i18n.translate('addresses.form.city.label')).to.equal('Australian City Chunked');

        // Street chunk is not loaded yet
        expect(i18n.translate('addresses.form.street.label')).to.equal('addresses.form.street.label');
        expect(fetchMock.called()).to.be.true;
        expect(fetchMock.calls()).to.have.length(1);
        expect(getLastUrlParams().getAll('chunks')).to.deep.equal(['city']);
      });

      it('should load all chunks when switching language', async () => {
        await i18n.registerChunk('city');
        await i18n.configure({ language });
        await i18n.registerChunk('street');
        fetchMock.resetHistory();

        await i18n.setLanguage('en-AU');

        // Both chunks are loaded
        expect(i18n.translate('addresses.form.city.label')).to.equal('Australian City Chunked');
        expect(i18n.translate('addresses.form.street.label')).to.equal('Australian Street Chunked');
        expect(fetchMock.called()).to.be.true;
        expect(fetchMock.calls()).to.have.length(1);
        expect(getLastUrlParams().getAll('chunks')).to.deep.equal(['city', 'street']);
      });

      it('should load additional chunks after switching language', async () => {
        await i18n.registerChunk('city');
        await i18n.configure({ language });
        await i18n.setLanguage('en-AU');
        fetchMock.resetHistory();

        await i18n.registerChunk('street');

        // Both chunks are loaded
        expect(i18n.translate('addresses.form.city.label')).to.equal('Australian City Chunked');
        expect(i18n.translate('addresses.form.street.label')).to.equal('Australian Street Chunked');
        expect(fetchMock.called()).to.be.true;
        expect(fetchMock.calls()).to.have.length(1);
        expect(getLastUrlParams().getAll('chunks')).to.deep.equal(['street']);
      });
    });

    describe('translate', () => {
      beforeEach(async () => {
        await i18n.configure();
      });

      it('should return translated string', () => {
        expect(i18n.translate('addresses.form.city.label')).to.equal('City');
        expect(i18n.translate('addresses.form.street.label')).to.equal('Street');
      });

      it('should return key when there is no translation', () => {
        expect(i18n.translate('unknown.key')).to.equal('unknown.key');
      });
    });

    describe('global side effects', () => {
      it('should run effects when language changes', async () => {
        const effectSpy = sinon.spy();
        effect(() => {
          // Use multiple signals in the effect to verify signals are updated in batch
          effectSpy(i18n.language.value, i18n.translate('addresses.form.city.label'));
        });

        // Runs once initially
        expect(effectSpy.calledOnceWith(undefined, 'addresses.form.city.label')).to.be.true;
        effectSpy.resetHistory();

        // Configure initial language
        await i18n.configure({ language: 'en-US' });
        expect(effectSpy.calledOnceWith('en-US', 'City')).to.be.true;
        effectSpy.resetHistory();

        // Change language
        await i18n.setLanguage('de-DE');
        expect(effectSpy.calledOnceWith('de-DE', 'Stadt')).to.be.true;
      });

      it('should run effects when initialized changes', async () => {
        const effectSpy = sinon.spy();
        effect(() => {
          effectSpy(i18n.initialized.value);
        });

        // Runs once initially
        expect(effectSpy.calledOnceWith(false)).to.be.true;
        effectSpy.resetHistory();

        // Configure initial language
        await i18n.configure({ language: 'en-US' });
        expect(effectSpy.calledOnceWith(true)).to.be.true;
      });
    });

    describe('global instance', () => {
      it('should expose a global I18n instance', () => {
        expect(globalI18n).to.exist;
        expect(globalI18n).to.be.instanceof(I18n);
      });

      it('should expose a global translate function that delegates to global I18n instance', async () => {
        await globalI18n.configure({ language: 'en-US' });
        expect(globalTranslate('addresses.form.city.label')).to.equal('City');

        await globalI18n.setLanguage('de-DE');
        expect(globalTranslate('addresses.form.city.label')).to.equal('Stadt');
      });
    });

    describe('react integration', () => {
      it('should re-render when language changes', async () => {
        function TestTranslateComponent() {
          return <div>{i18n.translate('addresses.form.city.label')}</div>;
        }

        const { getByText } = render(<TestTranslateComponent />);

        // No language
        expect(getByText('addresses.form.city.label')).to.exist;

        // Configure initial language
        await i18n.configure({ language: 'en-US' });
        expect(getByText('City')).to.exist;

        // Change language
        await i18n.setLanguage('de-DE');
        expect(getByText('Stadt')).to.exist;
      });

      it('should run signal effects when language changes', async () => {
        let signalEffectResult = '';

        function TestUseSignalEffectComponent() {
          useSignalEffect(() => {
            signalEffectResult = i18n.translate('addresses.form.city.label');
          });
          return <div></div>;
        }

        render(<TestUseSignalEffectComponent />);

        // No language
        expect(signalEffectResult).to.equal('addresses.form.city.label');

        // Configure initial language
        await i18n.configure({ language: 'en-US' });
        expect(signalEffectResult).to.equal('City');

        // Change language
        await i18n.setLanguage('de-DE');
        expect(signalEffectResult).to.equal('Stadt');
      });

      it('should update computed signals when language changes', async () => {
        function TestUseComputedComponent() {
          const computedTranslation = useComputed(
            () => `Computed translation: ${i18n.translate('addresses.form.city.label')}`,
          );
          return <div>{computedTranslation.value}</div>;
        }

        const { getByText } = render(<TestUseComputedComponent />);

        // No language
        expect(getByText('Computed translation: addresses.form.city.label')).to.exist;

        // Configure initial language
        await i18n.configure({ language: 'en-US' });
        expect(getByText('Computed translation: City')).to.exist;

        // Change language
        await i18n.setLanguage('de-DE');
        expect(getByText('Computed translation: Stadt')).to.exist;
      });

      it('should run default effects when language changes', async () => {
        let defaultEffectResult = '';

        function TestUseEffectComponent() {
          useEffect(() => {
            defaultEffectResult = i18n.translate('addresses.form.city.label');
          }, [i18n.language.value]);
          return <div></div>;
        }

        render(<TestUseEffectComponent />);

        // No language
        expect(defaultEffectResult).to.equal('addresses.form.city.label');

        // Configure initial language
        await i18n.configure({ language: 'en-US' });
        expect(defaultEffectResult).to.equal('City');

        // Change language
        await i18n.setLanguage('de-DE');
        expect(defaultEffectResult).to.equal('Stadt');
      });

      it('should update memoizations when language changes', async () => {
        function TestUseMemoComponent() {
          const memoizedTranslation = useMemo(
            () => `Memoized translation: ${i18n.translate('addresses.form.city.label')}`,
            [i18n.language.value],
          );
          return <div>{memoizedTranslation}</div>;
        }

        const { getByText } = render(<TestUseMemoComponent />);

        // No language
        expect(getByText('Memoized translation: addresses.form.city.label')).to.exist;

        // Configure initial language
        await i18n.configure({ language: 'en-US' });
        expect(getByText('Memoized translation: City')).to.exist;

        // Change language
        await i18n.setLanguage('de-DE');
        expect(getByText('Memoized translation: Stadt')).to.exist;
      });

      it('should allow rendering a placeholder while i18n is not initialized', async () => {
        function TestPlaceholderComponent() {
          return <div>{i18n.initialized.value ? 'Ready' : 'Loading'}</div>;
        }

        const { getByText } = render(<TestPlaceholderComponent />);

        expect(getByText('Loading')).to.exist;
        await i18n.configure({ language: 'en-US' });
        expect(getByText('Ready')).to.exist;
      });
    });

    describe('ICU message format', () => {
      beforeEach(async () => {
        fetchMock.reset();
        fetchMock.get('*', {
          'param.basic': 'Value: {value}',
          'param.number': 'Value: {value, number}',
          'param.number.integer': 'Value: {value, number, integer}',
          'param.number.skeleton': 'Value: {value, number, ::.##}',
          'param.number.currency': 'Value: {value, number, ::currency/USD}',
          'param.date': 'Value: {value, date}',
          'param.date.short': 'Value: {value, date, short}',
          'param.date.medium': 'Value: {value, date, medium}',
          'param.date.long': 'Value: {value, date, long}',
          'param.date.full': 'Value: {value, date, full}',
          'param.date.skeleton': 'Value: {value, date, ::ddEEEMMMyy}',
          'param.time': 'Value: {value, time}',
          'param.time.short': 'Value: {value, time, short}',
          'param.time.medium': 'Value: {value, time, medium}',
          'param.time.long': 'Value: {value, time, long}',
          'param.time.full': 'Value: {value, time, full}',
          'param.plural': 'You have {value, plural, =0 {no new messages} one {one new message} other {# new messages}}',
          'param.select': '{value, select, male {He} female {She} other {They}} liked this',
          'param.selectordinal':
            'You are { value, selectordinal,one {#st} two {#nd} few {#rd} other {#th}} in the queue',
          'param.escaping': "No need to escape 'this'. But '{this}'",
        });
        await i18n.configure({ language: 'en-US' });
      });

      it('should support ICU message format', () => {
        const sampleDate = new Date(2024, 10, 12, 22, 33, 44);
        expect(i18n.translate('param.basic', { value: 'foo' })).to.equal('Value: foo');

        expect(i18n.translate('param.number', { value: 123.456 })).to.equal('Value: 123.456');
        expect(i18n.translate('param.number.integer', { value: 123.456 })).to.equal('Value: 123');
        expect(i18n.translate('param.number.skeleton', { value: 123.456 })).to.equal('Value: 123.46');
        expect(i18n.translate('param.number.currency', { value: 123.456 })).to.equal('Value: $123.46');

        expect(i18n.translate('param.date', { value: sampleDate })).to.equal('Value: 11/12/2024');
        expect(i18n.translate('param.date.short', { value: sampleDate })).to.equal('Value: 11/12/24');
        expect(i18n.translate('param.date.medium', { value: sampleDate })).to.equal('Value: Nov 12, 2024');
        expect(i18n.translate('param.date.long', { value: sampleDate })).to.equal('Value: November 12, 2024');
        expect(i18n.translate('param.date.full', { value: sampleDate })).to.equal('Value: Tuesday, November 12, 2024');
        expect(i18n.translate('param.date.skeleton', { value: sampleDate })).to.equal('Value: Tue, Nov 12, 24');

        expect(i18n.translate('param.time', { value: sampleDate })).to.equal('Value: 10:33:44 PM');
        expect(i18n.translate('param.time.short', { value: sampleDate })).to.equal('Value: 10:33 PM');
        expect(i18n.translate('param.time.medium', { value: sampleDate })).to.equal('Value: 10:33:44 PM');
        expect(i18n.translate('param.time.long', { value: sampleDate })).to.match(/Value: 10:33:44 PM (GMT|UTC)/u);
        expect(i18n.translate('param.time.full', { value: sampleDate })).to.match(/Value: 10:33:44 PM (GMT|UTC)/u);

        expect(i18n.translate('param.plural', { value: 0 })).to.equal('You have no new messages');
        expect(i18n.translate('param.plural', { value: 1 })).to.equal('You have one new message');
        expect(i18n.translate('param.plural', { value: 2 })).to.equal('You have 2 new messages');
        expect(i18n.translate('param.plural', { value: 10 })).to.equal('You have 10 new messages');

        expect(i18n.translate('param.select', { value: 'male' })).to.equal('He liked this');
        expect(i18n.translate('param.select', { value: 'female' })).to.equal('She liked this');
        expect(i18n.translate('param.select', { value: 'other' })).to.equal('They liked this');
        expect(i18n.translate('param.select', { value: 'diverse' })).to.equal('They liked this');

        expect(i18n.translate('param.selectordinal', { value: 1 })).to.equal('You are 1st in the queue');
        expect(i18n.translate('param.selectordinal', { value: 2 })).to.equal('You are 2nd in the queue');
        expect(i18n.translate('param.selectordinal', { value: 3 })).to.equal('You are 3rd in the queue');
        expect(i18n.translate('param.selectordinal', { value: 4 })).to.equal('You are 4th in the queue');
        expect(i18n.translate('param.selectordinal', { value: 10 })).to.equal('You are 10th in the queue');

        expect(i18n.translate('param.escaping')).to.equal("No need to escape 'this'. But {this}");
      });

      it('should update formats when changing language', async () => {
        const sampleDate = new Date(2024, 10, 12, 22, 33, 44);

        expect(i18n.translate('param.number', { value: 123.456 })).to.equal('Value: 123.456');
        expect(i18n.translate('param.date.medium', { value: sampleDate })).to.equal('Value: Nov 12, 2024');
        expect(i18n.translate('param.time', { value: sampleDate })).to.equal('Value: 10:33:44 PM');

        await i18n.setLanguage('de');

        expect(i18n.translate('param.number', { value: 123.456 })).to.equal('Value: 123,456');
        expect(i18n.translate('param.date.medium', { value: sampleDate })).to.equal('Value: 12. Nov. 2024');
        expect(i18n.translate('param.time', { value: sampleDate })).to.equal('Value: 22:33:44');
      });
    });

    describe('hmr', () => {
      async function triggerHmrEvent() {
        // @ts-expect-error import.meta.hot does not have TS definitions
        // eslint-disable-next-line
        import.meta.hot.hmrClient.notifyListeners('translations-update');
        // No promise to wait for, just delay the next test step a bit
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });
      }

      it('should not update translations if not initialized', async () => {
        expect(i18n.translate('addresses.form.city.label')).to.equal('addresses.form.city.label');
        await triggerHmrEvent();
        expect(i18n.translate('addresses.form.city.label')).to.equal('addresses.form.city.label');
      });

      it('should update translations on HMR event', async () => {
        await i18n.configure({ language: 'en-US' });
        expect(i18n.translate('addresses.form.city.label')).to.equal('City');

        fetchMock
          .resetHistory()
          .reset()
          .get('./?v-r=i18n&langtag=en-US', {
            body: {
              'addresses.form.city.label': 'City updated',
            },
            status: 200,
            headers: { 'X-Vaadin-Retrieved-Locale': 'und' },
          });

        await triggerHmrEvent();

        expect(i18n.translate('addresses.form.city.label')).to.equal('City updated');
      });

      it('should update resolved language on HMR event', async () => {
        await i18n.configure({ language: 'en-US' });
        expect(i18n.resolvedLanguage.value).to.equal('und');

        fetchMock
          .resetHistory()
          .reset()
          .get('*', {
            body: {},
            status: 200,
            headers: { 'X-Vaadin-Retrieved-Locale': 'en' },
          });

        await triggerHmrEvent();

        expect(i18n.resolvedLanguage.value).to.equal('en');
      });
    });
  });

  describe('FormatCache', () => {
    it('should cache formats', () => {
      const cache = new FormatCache('en-US');
      expect(cache.getFormat('foo')).to.equal(cache.getFormat('foo'));
      expect(cache.getFormat('foo')).to.not.equal(cache.getFormat('bar'));
    });

    it('should use formats for specified locale', () => {
      const cache = new FormatCache('de-DE');
      expect(cache.getFormat('Value: {value, number}').format({ value: 123.456 })).to.equal('Value: 123,456');
    });

    it('should fall back to browser language formats when using unknown or invalid locale strings', () => {
      const browserFormatCache = new FormatCache(navigator.language);
      const expectedMessage = browserFormatCache.getFormat('Value: {value, number}').format({ value: 123.456 });
      ['', 'a', 'aa', 'aaa', 'aaaa', 'aaaaaaaa'].forEach((language) => {
        const cache = new FormatCache(language);
        const message = cache.getFormat('Value: {value, number}').format({ value: 123.456 });
        expect(message).to.equal(expectedMessage);
      });
    });
  });
});
