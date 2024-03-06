import { expect, use } from '@esm-bundle/chai';
import { render } from '@testing-library/react';
import CookieManager from '@vaadin/hilla-frontend/CookieManager.js';
import { effect, useComputed, useSignalEffect } from '@vaadin/hilla-react-signals';
import fetchMock from 'fetch-mock';
import { useEffect, useMemo } from 'react';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { i18n as globalI18n, I18n, translate as globalTranslate } from '../src/index.js';
import type { LanguageSettings } from '../src/settings.js';

use(sinonChai);

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
          'addresses.form.city.label': 'Stadt',
          'addresses.form.street.label': 'Strasse',
        })
        .get('./?v-r=i18n&langtag=not-found', 404)
        .get('*', {
          'addresses.form.city.label': 'City',
          'addresses.form.street.label': 'Street',
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
        verifyLoadTranslations('zh-Hant');
      });

      it('should prefer explicitly configured language over last used language', async () => {
        setSettingsCookie({ language: 'de-DE' });
        await i18n.configure({ language: 'zh-Hant' });

        expect(i18n.language.value).to.equal('zh-Hant');
        verifyLoadTranslations('zh-Hant');
      });

      it('should not store last used language when initializing', async () => {
        await i18n.configure();

        expect(getSettingsCookie()?.language).to.not.exist;
      });

      it('should not throw when loading translations fails', async () => {
        await i18n.configure({ language: 'not-found' });

        expect(i18n.language.value).to.equal('not-found');
      });
    });

    describe('language', () => {
      const initialLanguage = 'en-US';

      beforeEach(async () => {
        await i18n.configure({ language: initialLanguage });
        fetchMock.resetHistory();
      });

      it('should return current language', () => {
        expect(i18n.language.value).to.equal(initialLanguage);
      });

      it('should set language and load translations', async () => {
        await i18n.setLanguage('de-DE');

        expect(i18n.language.value).to.equal('de-DE');
        verifyLoadTranslations('de-DE');
      });

      it('should store last used language', async () => {
        await i18n.setLanguage('de-DE');

        expect(getSettingsCookie()?.language).to.equal('de-DE');
      });

      it('should not load translations if language is unchanged', async () => {
        await i18n.setLanguage(initialLanguage);

        expect(i18n.language.value).to.equal(initialLanguage);
        expect(fetchMock.called()).to.be.false;
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
        expect(i18n.translate('param.time.long', { value: sampleDate })).to.match(/Value: 10:33:44 PM GMT/u);
        expect(i18n.translate('param.time.full', { value: sampleDate })).to.match(/Value: 10:33:44 PM GMT/u);

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
  });
});
