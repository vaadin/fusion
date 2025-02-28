import { fireEvent, render, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EndpointError } from '@vaadin/hilla-frontend';
import { ValidationError } from '@vaadin/hilla-lit-form';
import type { ValueError } from '@vaadin/hilla-lit-form/Validation.js';
import type { SelectElement } from '@vaadin/react-components/Select.js';
import { TextArea, type TextAreaElement } from '@vaadin/react-components/TextArea.js';
import { TextField, type TextFieldElement } from '@vaadin/react-components/TextField.js';
import { VerticalLayout } from '@vaadin/react-components/VerticalLayout.js';
import { page } from '@vitest/browser/context';
import chaiAsPromised from 'chai-as-promised';
import chaiDom from 'chai-dom';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { afterEach, beforeEach, chai, describe, expect, it } from 'vitest';
import { AutoForm, type AutoFormLayoutRendererProps, type AutoFormProps, emptyItem } from '../src/autoform.js';
import type { CrudService } from '../src/crud.js';
import { LocaleContext } from '../src/locale.js';
import ConfirmDialogController from './ConfirmDialogController';
import FormController from './FormController.js';
import {
  createService,
  Gender,
  getItem,
  type HasTestInfo,
  type Person,
  personData,
  PersonModel,
  personService,
  PersonWithSimpleIdPropertyModel,
  PersonWithoutIdPropertyModel,
} from './test-models-and-services.js';
import { nextFrame } from './test-utils.js';

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.use(chaiDom);

type ScreenSize = Readonly<{
  width: number;
  height: number;
}>;

describe('@vaadin/hilla-react-crud', () => {
  describe('Auto form', () => {
    const LABELS = [
      'First name',
      'Last name',
      'Gender',
      'Email',
      'Some integer',
      'Some decimal',
      'Vip',
      'Birth date',
      'Shift start',
      'Appointment time',
      'Street',
      'City',
      'Country',
      'Department',
    ] as const;
    const DEFAULT_PERSON: Person = {
      firstName: '',
      lastName: '',
      gender: Gender.MALE,
      email: '',
      someInteger: NaN,
      someDecimal: NaN,
      id: -1,
      version: -1,
      vip: false,
      birthDate: '',
      shiftStart: '',
      appointmentTime: '',
      address: {
        street: '',
        city: '',
        country: '',
      },
      department: {
        name: '',
      },
    };
    let user: ReturnType<(typeof userEvent)['setup']>;

    function getExpectedValues(person: Person) {
      return [
        person.firstName,
        person.lastName,
        person.gender,
        person.email,
        Number.isNaN(person.someInteger) ? '' : person.someInteger.toString(),
        Number.isNaN(person.someDecimal) ? '' : person.someDecimal.toString(),
        person.vip.toString(),
        person.birthDate,
        person.shiftStart,
        person.appointmentTime,
        person.address?.street ?? '',
        person.address?.city ?? '',
        person.address?.country ?? '',
        person.department ? JSON.stringify(person.department) : '',
      ];
    }

    async function expectFieldColSpan(form: FormController, fieldName: string, expectedColSpan: string | null) {
      const formElement = await form.getField(fieldName);
      if (expectedColSpan === null) {
        return expect(formElement).to.not.have.attribute('colspan');
      }
      return expect(formElement).to.have.attribute('colspan', expectedColSpan);
    }

    // eslint-disable-next-line @typescript-eslint/max-params
    async function populatePersonForm(
      personId: number,
      formProps?: Omit<AutoFormProps<PersonModel>, 'item' | 'model' | 'service'>,
      screenSize?: ScreenSize,
      disabled?: boolean,
      service: CrudService<Person> & HasTestInfo = personService(),
    ): Promise<FormController> {
      if (screenSize) {
        await page.viewport(screenSize.width, screenSize.height);
      }
      const person = await getItem(service, personId);
      const result = render(
        <AutoForm service={service} model={PersonModel} item={person} disabled={disabled} {...formProps} />,
      );
      return await FormController.init(user, result.container);
    }

    beforeEach(() => {
      user = userEvent.setup();
    });

    afterEach(() => {
      cleanup();
    });

    it('renders fields for the properties in the form', async () => {
      const person: Person = {
        id: 1,
        version: 1,
        firstName: 'first',
        lastName: 'last',
        gender: Gender.FEMALE,
        email: 'first.last@domain.com',
        someInteger: 24451,
        someDecimal: 24.451,
        vip: false,
        birthDate: '1999-12-31',
        shiftStart: '08:30',
        appointmentTime: '2020-12-31T08:30',
        address: {
          street: 'Some street 1',
          city: 'Some city',
          country: 'Some country',
        },
      };

      const form = await FormController.init(
        user,
        render(<AutoForm service={personService()} model={PersonModel} item={person} />).container,
      );

      await expect(form.getValues(...LABELS)).to.eventually.be.deep.equal(getExpectedValues(person));

      const fields = await form.getFields(...LABELS);
      const tagNames = fields.map((field) => field.localName);
      expect(tagNames).to.eql([
        'vaadin-text-field',
        'vaadin-text-field',
        'vaadin-select',
        'vaadin-text-field',
        'vaadin-integer-field',
        'vaadin-number-field',
        'vaadin-checkbox',
        'vaadin-date-picker',
        'vaadin-time-picker',
        'vaadin-date-time-picker',
        'vaadin-text-field',
        'vaadin-text-field',
        'vaadin-text-field',
        'vaadin-text-area',
      ]);
    });

    it('works without an item', async () => {
      const form = await FormController.init(
        user,
        render(<AutoForm service={personService()} model={PersonModel} />).container,
      );
      await expect(form.getValues(...LABELS)).to.eventually.be.deep.equal(getExpectedValues(DEFAULT_PERSON));
    });

    it('uses values from an item', async () => {
      const service = personService();
      const person = (await getItem(service, 2))!;

      const form = await FormController.init(
        user,
        render(<AutoForm service={service} model={PersonModel} item={person} />).container,
      );
      await expect(form.getValues(...LABELS)).to.eventually.be.deep.equal(getExpectedValues(person));
    });

    it('updates values when changing item', async () => {
      const service = personService();
      const person1 = (await getItem(service, 2))!;
      const person2 = (await getItem(service, 1))!;

      const result = render(<AutoForm service={service} model={PersonModel} item={person1} />);
      let form = await FormController.init(user, result.container);
      await expect(form.getValues(...LABELS)).to.eventually.be.deep.equal(getExpectedValues(person1));

      result.rerender(<AutoForm service={service} model={PersonModel} item={person2} />);
      form = await FormController.init(user, result.container);
      await expect(form.getValues(...LABELS)).to.eventually.be.deep.equal(getExpectedValues(person2));
    });

    it('clears the form when setting the item to undefined', async () => {
      const service = personService();
      const person = (await getItem(service, 2))!;

      const result = render(<AutoForm service={service} model={PersonModel} item={person} />);
      let form = await FormController.init(user, result.container);
      await expect(form.getValues(...LABELS)).to.eventually.be.deep.equal(getExpectedValues(person));

      result.rerender(<AutoForm service={service} model={PersonModel} item={undefined} />);
      form = await FormController.init(user, result.container);
      await expect(form.getValues(...LABELS)).to.eventually.be.deep.equal(getExpectedValues(DEFAULT_PERSON));
    });

    it('submits a valid form', async () => {
      const service: CrudService<Person> & HasTestInfo = createService<Person>(personData);
      const saveSpy = sinon.spy(service, 'save');

      const form = await FormController.init(
        user,
        render(<AutoForm service={service} model={PersonModel} item={undefined} />).container,
      );
      await form.typeInField('First name', 'Joe');
      await form.typeInField('Last name', 'Quinby');
      await form.typeInField('Some integer', '12');
      await form.typeInField('Some decimal', '0.12');
      await form.typeInField('Street', '123 Fake Street');
      await form.submit();

      expect(saveSpy).to.have.been.calledOnce;
      const [newItem] = saveSpy.getCall(0).args;
      expect(newItem.firstName).to.equal('Joe');
      expect(newItem.lastName).to.equal('Quinby');
      expect(newItem.someInteger).to.equal(12);
      expect(newItem.someDecimal).to.equal(0.12);
      expect(newItem.address?.street).to.equal('123 Fake Street');
    });

    it('retains the form values after submitting an existing item', async () => {
      const service: CrudService<Person> & HasTestInfo = createService<Person>(personData);
      const person = await getItem(service, 1);
      const form = await FormController.init(
        user,
        render(<AutoForm service={service} model={PersonModel} item={person} />).container,
      );
      await form.typeInField('First name', 'foo');
      await form.submit();
      const updatedPerson: Person = { ...person!, firstName: 'foo' };
      await expect(form.getValues(...LABELS)).to.eventually.be.deep.equal(getExpectedValues(updatedPerson));
    });

    it('retains the form values after submitting an existing item when using onSubmitSuccess', async () => {
      const service: CrudService<Person> & HasTestInfo = createService<Person>(personData);
      const person = await getItem(service, 1);
      const submitSpy = sinon.spy();

      const form = await FormController.init(
        user,
        render(<AutoForm service={service} model={PersonModel} item={person} onSubmitSuccess={submitSpy} />).container,
      );
      await form.typeInField('First name', 'foo');
      await form.submit();
      const updatedPerson: Person = { ...person!, firstName: 'foo' };
      await expect(form.getValues(...LABELS)).to.eventually.be.deep.equal(getExpectedValues(updatedPerson));
    });

    it('clears the form values after submitting a new item', async () => {
      const service: CrudService<Person> & HasTestInfo = createService<Person>(personData);

      // Item is undefined
      const result = render(<AutoForm service={service} model={PersonModel} />);
      const form = await FormController.init(user, result.container);

      const typeMinInFields = async () => {
        await form.typeInField('First name', 'foo');
        await form.typeInField('Some integer', '0');
        await form.typeInField('Some decimal', '0');
      };
      await typeMinInFields();
      await form.submit();
      await expect(form.getValues(...LABELS)).to.eventually.be.deep.equal(getExpectedValues(DEFAULT_PERSON));

      // Item is null
      result.rerender(<AutoForm service={service} model={PersonModel} item={null} />);
      await typeMinInFields();
      await form.submit();
      await expect(form.getValues(...LABELS)).to.eventually.be.deep.equal(getExpectedValues(DEFAULT_PERSON));

      // Item is emptyItem
      result.rerender(<AutoForm service={service} model={PersonModel} item={emptyItem} />);
      await typeMinInFields();

      await form.submit();
      await expect(form.getValues(...LABELS)).to.eventually.be.deep.equal(getExpectedValues(DEFAULT_PERSON));
    });

    it('calls onSubmitSuccess with the new item', async () => {
      const service: CrudService<Person> & HasTestInfo = createService<Person>(personData);
      const person = await getItem(service, 1);
      const submitSpy = sinon.spy();

      const form = await FormController.init(
        user,
        render(<AutoForm service={service} model={PersonModel} item={person} onSubmitSuccess={submitSpy} />).container,
      );
      await form.typeInField('First name', 'bag');
      await form.submit();
      expect(submitSpy).to.have.been.calledWithMatch(sinon.match.hasNested('item.firstName', 'bag'));
    });

    it('shows an error if the endpoint call fails', async () => {
      const service: CrudService<Person> & HasTestInfo = createService<Person>(personData);
      // eslint-disable-next-line @typescript-eslint/require-await
      service.save = async (_item: Person): Promise<Person | undefined> => {
        throw new EndpointError('foobar');
      };
      const person = await getItem(service, 1);
      const submitSpy = sinon.spy();

      const result = render(
        <AutoForm service={service} model={PersonModel} item={person} onSubmitSuccess={submitSpy} />,
      );
      const form = await FormController.init(user, result.container);
      await form.typeInField('First name', 'J'); // to enable the submit button
      await form.submit();
      expect(submitSpy).to.have.not.been.called;
      expect(result.queryByText('foobar')).to.not.be.null;
    });

    it("doesn't call the submit error handler on validation errors", async () => {
      const service: CrudService<Person> & HasTestInfo = createService<Person>(personData);
      // eslint-disable-next-line @typescript-eslint/require-await
      service.save = async (_item: Person): Promise<Person | undefined> => {
        throw new ValidationError([]);
      };
      const person = await getItem(service, 1);
      const errorSpy = sinon.spy();

      const result = render(<AutoForm service={service} model={PersonModel} item={person} onSubmitError={errorSpy} />);
      const form = await FormController.init(user, result.container);
      await form.typeInField('First name', 'J'); // to enable the submit button
      await form.submit();
      expect(errorSpy).to.have.not.been.called;
    });

    it('rethrows unknown errors without calling error handler', async () => {
      const errorPromise = new Promise((resolve) => {
        addEventListener(
          'unhandledrejection',
          (e) => {
            e.preventDefault();
            resolve(e.reason);
          },
          { once: true },
        );
      });

      const service: CrudService<Person> & HasTestInfo = createService<Person>(personData);
      // eslint-disable-next-line @typescript-eslint/require-await
      service.save = async (_item: Person): Promise<Person | undefined> => {
        throw new Error('foobar');
      };
      const person = await getItem(service, 1);
      const errorSpy = sinon.spy();

      const result = render(<AutoForm service={service} model={PersonModel} item={person} onSubmitError={errorSpy} />);
      const form = await FormController.init(user, result.container);
      await form.typeInField('First name', 'J'); // to enable the submit button
      await form.submit();
      const error = await errorPromise;
      expect(error).to.be.an.instanceOf(Error);
      expect((error as Error).message).to.equal('foobar');
      expect(errorSpy).to.have.not.been.called;
    });

    it('shows error for whole form when no property', async () => {
      const service: CrudService<Person> & HasTestInfo = createService<Person>(personData);
      const person = await getItem(service, 1);
      // eslint-disable-next-line @typescript-eslint/require-await
      service.save = async (_item: Person): Promise<Person | undefined> => {
        const valueError: ValueError = {
          property: '',
          message: 'message',
          value: person,
          validator: { message: 'message', validate: () => false },
          validatorMessage: 'foobar',
        };
        throw new ValidationError([valueError]);
      };

      const result = render(<AutoForm service={service} model={PersonModel} item={person} />);
      const form = await FormController.init(user, result.container);
      await form.typeInField('First name', 'J'); // to enable the submit button
      await form.submit();
      expect(result.queryByText('message')).to.be.null;
      expect(result.queryByText('foobar')).to.not.be.null;
    });

    it('shows multiple errors for whole form when no property', async () => {
      const service: CrudService<Person> & HasTestInfo = createService<Person>(personData);
      const person = await getItem(service, 1);
      // eslint-disable-next-line @typescript-eslint/require-await
      service.save = async (_item: Person): Promise<Person | undefined> => {
        const valueError: ValueError = {
          property: '',
          message: 'message',
          value: person,
          validator: { message: 'message', validate: () => false },
          validatorMessage: 'foobar',
        };

        const valueError2: ValueError = {
          ...valueError,
          validatorMessage: 'just a message',
        };
        throw new ValidationError([valueError, valueError2]);
      };

      const result = render(<AutoForm service={service} model={PersonModel} item={person} />);
      const form = await FormController.init(user, result.container);
      await form.typeInField('First name', 'J'); // to enable the submit button
      await form.submit();
      expect(result.queryByText('message')).to.be.null;
      expect(result.queryByText('foobar')).to.not.be.null;
      expect(result.queryByText('just a message')).to.not.be.null;
    });

    it('shows error for whole form has string property', async () => {
      const service: CrudService<Person> & HasTestInfo = createService<Person>(personData);
      const person = await getItem(service, 1);
      // eslint-disable-next-line @typescript-eslint/require-await
      service.save = async (_item: Person): Promise<Person | undefined> => {
        const valueError: ValueError = {
          property: 'myProp',
          message: 'message',
          value: person,
          validator: { message: 'message', validate: () => false },
          validatorMessage: 'foobar',
        };
        throw new ValidationError([valueError]);
      };

      const result = render(<AutoForm service={service} model={PersonModel} item={person} />);
      const form = await FormController.init(user, result.container);
      await form.typeInField('First name', 'J'); // to enable the submit button
      await form.submit();
      expect(result.queryByText('message')).to.be.null;
      expect(result.queryByText('myProp: foobar')).to.not.be.null;
    });

    it('shows a predefined error message when the service returns no entity after saving', async () => {
      const service: CrudService<Person> & HasTestInfo = createService<Person>(personData);
      service.save = async (): Promise<Person | undefined> => Promise.resolve(undefined);
      const person = await getItem(service, 1);
      const errorSpy = sinon.spy();
      const submitSpy = sinon.spy();
      const result = render(
        <AutoForm
          service={service}
          model={PersonModel}
          item={person}
          onSubmitSuccess={submitSpy}
          onSubmitError={errorSpy}
        />,
      );
      const form = await FormController.init(user, result.container);
      await form.typeInField('First name', 'J'); // to enable the submit button
      await form.submit();
      expect(submitSpy).to.have.not.been.called;
      expect(errorSpy).to.have.been.calledWith(sinon.match.hasNested('error.message', 'No update performed'));
    });

    it('calls onSubmitError and does not show error if the endpoint call fails', async () => {
      const service: CrudService<Person> & HasTestInfo = createService<Person>(personData);
      // eslint-disable-next-line @typescript-eslint/require-await
      service.save = async (_item: Person): Promise<Person | undefined> => {
        throw new EndpointError('foobar');
      };
      const person = await getItem(service, 1);
      const errorSpy = sinon.spy();
      const submitSpy = sinon.spy();
      const result = render(
        <AutoForm
          service={service}
          model={PersonModel}
          item={person}
          onSubmitSuccess={submitSpy}
          onSubmitError={errorSpy}
        />,
      );
      const form = await FormController.init(user, result.container);
      await form.typeInField('First name', 'J'); // to enable the submit button
      await form.submit();
      expect(result.queryByText('foobar')).to.be.null;
      expect(submitSpy).to.have.not.been.called;
      expect(errorSpy).to.have.been.calledWith(sinon.match.hasNested('error.message', 'foobar'));
    });

    it('allows to show a custom error message if the endpoint call fails', async () => {
      const service: CrudService<Person> & HasTestInfo = createService<Person>(personData);
      sinon.stub(service, 'save').rejects(new EndpointError('foobar'));
      const person = await getItem(service, 1);
      const submitSpy = sinon.spy();
      const result = render(
        <AutoForm
          service={service}
          model={PersonModel}
          item={person}
          onSubmitSuccess={submitSpy}
          // eslint-disable-next-line @typescript-eslint/unbound-method
          onSubmitError={({ error, setMessage }) => setMessage(`Got error: ${error.message}`)}
        />,
      );
      const form = await FormController.init(user, result.container);
      await form.typeInField('First name', 'J'); // to enable the submit button
      await form.submit();
      expect(submitSpy).to.have.not.been.called;
      expect(result.queryByText('Got error: foobar')).to.not.be.null;
    });

    it('disables all fields and buttons when disabled', async () => {
      const form = await FormController.init(
        user,
        render(<AutoForm service={personService()} model={PersonModel} disabled />).container,
      );
      await expect(form.areEnabled(...LABELS)).to.eventually.be.false;
    });

    it('enables all fields and buttons when enabled', async () => {
      const service = personService();
      const result = render(<AutoForm service={service} model={PersonModel} disabled />);
      await FormController.init(user, result.container);
      result.rerender(<AutoForm service={service} model={PersonModel} />);
      const form = await FormController.init(user, result.container);
      await expect(form.areEnabled(...LABELS)).to.eventually.be.true;
    });

    describe('discard button', () => {
      it('does not show a discard button if the form is not dirty', async () => {
        const form = await FormController.init(
          user,
          render(<AutoForm service={personService()} model={PersonModel} />).container,
        );
        await expect(form.findButton('Discard')).to.eventually.be.rejected;
      });

      it('does show a discard button if the form is dirty', async () => {
        const form = await FormController.init(
          user,
          render(<AutoForm service={personService()} model={PersonModel} />).container,
        );
        await form.typeInField('First name', 'foo');
        await expect(form.findButton('Discard')).to.eventually.exist;
      });

      it('resets the form when clicking the discard button', async () => {
        const form = await FormController.init(
          user,
          render(<AutoForm service={personService()} model={PersonModel} />).container,
        );
        await form.typeInField('First name', 'foo');
        await expect(form.findButton('Discard')).to.eventually.exist;

        await form.discard();
        await expect(form.getValues('First name')).to.eventually.eql(['']);
        await expect(form.findButton('Discard')).to.eventually.be.rejected;
      });
    });

    it('when creating new, submit button is enabled at the beginning', async () => {
      const service = personService();
      const result = render(<AutoForm service={service} model={PersonModel} />);
      const form = await FormController.init(user, result.container);

      const submitButton = await form.findButton('Submit');
      expect(submitButton.disabled).to.be.false;
    });

    it('passing null interprets as creating new, submit button is enabled at the beginning', async () => {
      const service = personService();
      const result = render(<AutoForm service={service} model={PersonModel} item={null} />);
      const form = await FormController.init(user, result.container);

      const submitButton = await form.findButton('Submit');
      expect(submitButton.disabled).to.be.false;
    });

    it('passing undefined interprets as creating new, submit button is enabled at the beginning', async () => {
      const service = personService();
      const result = render(<AutoForm service={service} model={PersonModel} item={undefined} />);
      const form = await FormController.init(user, result.container);

      const submitButton = await form.findButton('Submit');
      expect(submitButton.disabled).to.be.false;
    });

    it('when editing, submit button remains disabled before any changes', async () => {
      const form = await populatePersonForm(1);

      const submitButton = await form.findButton('Submit');
      expect(submitButton.disabled).to.be.true;
    });

    it('when editing, submit button becomes disabled again when the form is reset', async () => {
      const form = await populatePersonForm(1);
      const submitButton = await form.findButton('Submit');

      await form.typeInField('First name', 'J'); // to enable the submit button
      expect(submitButton.disabled).to.be.false;

      await form.discard();
      expect(submitButton.disabled).to.be.true;
    });

    it('renders with empty number fields', async () => {
      const result = render(<AutoForm service={personService()} model={PersonModel} />);
      const form = await FormController.init(user, result.container);

      const someIntegerField = await form.getField('Some integer');
      expect(someIntegerField).to.have.property('value', '');
    });

    describe('keyboard shortcuts', () => {
      it('submits the form when enter key is pressed on field', async () => {
        const service = personService();
        const form = await populatePersonForm(1, undefined, undefined, undefined, service);

        const submitSpy = sinon.spy(service, 'save');

        await form.typeInField('First name', 'J{enter}');

        expect(submitSpy).to.have.been.calledOnce;
      });

      it('does not submit the form when enter key is pressed if form is not edited', async () => {
        const service = personService();
        const form = await populatePersonForm(1, undefined, undefined, undefined, service);
        const submitSpy = sinon.spy(service, 'save');

        await form.typeInField('First name', '{enter}');
        expect(submitSpy).to.have.not.been.called;
      });

      it('does not submit the form when enter key is pressed with delete or discard button focused', async () => {
        const service = personService();
        const form = await populatePersonForm(1, { deleteButton: true }, undefined, undefined, service);

        const submitSpy = sinon.spy(service, 'save');
        const deleteButton = await form.findButton('Delete...');
        expect(deleteButton.disabled).to.be.false;

        const submitButton = await form.findButton('Submit');
        await form.typeInField('First name', 'J');
        expect(submitButton.disabled).to.be.false;

        fireEvent.keyDown(deleteButton, { key: 'Enter', code: 'Enter', charCode: 13 });
        await nextFrame();
        expect(submitSpy).to.have.not.been.called;

        const discardButton = await form.findButton('Discard');
        expect(discardButton.disabled).to.be.false;

        fireEvent.keyDown(discardButton, { key: 'Enter', code: 'Enter', charCode: 13 });
        await nextFrame();
        expect(submitSpy).to.have.not.been.called;
      });

      it('submits the form when enter key is pressed with custom layout renderer', async () => {
        const service = personService();

        function MyLayoutRenderer({ children }: AutoFormLayoutRendererProps<PersonModel>) {
          return <VerticalLayout>{children}</VerticalLayout>;
        }

        const form = await populatePersonForm(1, { layoutRenderer: MyLayoutRenderer }, undefined, undefined, service);
        const submitSpy = sinon.spy(service, 'save');

        await form.typeInField('First name', 'J{enter}');
        expect(submitSpy).to.have.been.calledOnce;
      });
    });

    describe('layoutRenderer', () => {
      it('uses default two-column form layout if layoutRenderer is not defined', async () => {
        const form = await populatePersonForm(1);
        expect(form.formLayout.responsiveSteps).to.be.deep.equal([
          { minWidth: 0, columns: 1, labelsPosition: 'top' },
          { minWidth: '20em', columns: 1 },
          { minWidth: '40em', columns: 2 },
        ]);
        expect(form.renderResult.getElementsByTagName('vaadin-number-field')).to.have.length(1); // no Id and Version
        // fields
        await expectFieldColSpan(form, 'First name', null);
        await expectFieldColSpan(form, 'Last name', null);
        await expectFieldColSpan(form, 'Email', null);
        await expectFieldColSpan(form, 'Some integer', null);
        await expectFieldColSpan(form, 'Some decimal', null);
      });

      it('uses layoutRenderer if defined, instead of the default FormLayout', async () => {
        function MyLayoutRenderer({ children }: AutoFormLayoutRendererProps<PersonModel>) {
          return <VerticalLayout>{children}</VerticalLayout>;
        }

        const form = await populatePersonForm(1, { layoutRenderer: MyLayoutRenderer }, { width: 1440, height: 900 });
        expect(form.formLayout).to.not.exist;
        const layout = await waitFor(() => form.renderResult.querySelector('vaadin-vertical-layout')!);
        expect(layout).to.exist;
      });
    });

    describe('visibleFields', () => {
      it('renders fields only for the specified properties', async () => {
        const form = await populatePersonForm(1, { visibleFields: ['firstName', 'lastName', 'id'] });
        const fields = await form.getFields('First name', 'Last name', 'Id');
        const tagNames = fields.map((field) => field.localName);
        expect(tagNames).to.eql(['vaadin-text-field', 'vaadin-text-field', 'vaadin-number-field']);
        const genderField = form.queryField('Gender');
        expect(genderField).to.be.undefined;
      });

      it('ignores non-existing properties', async () => {
        const form = await populatePersonForm(1, {
          visibleFields: ['firstName', 'lastName', 'foo', 'address.foo', 'department.foo'],
        });
        expect(form.queryField('First name')).to.exist;
        expect(form.queryField('Last name')).to.exist;
        expect(form.queryField('Foo')).to.be.undefined;
      });

      it('renders fields for nested properties that are not included by default', async () => {
        const form = await populatePersonForm(1, { visibleFields: ['department.name'] });
        const fields = await form.getField('Name');
        expect(fields.localName).to.eql('vaadin-text-field');
      });

      it('properly binds fields for nested properties that are not included by default', async () => {
        const service = personService();
        const saveSpy = sinon.spy(service, 'save');
        const form = await populatePersonForm(1, { visibleFields: ['department.name'] }, undefined, false, service);
        await form.typeInField('Name', 'foo');
        await form.submit();
        expect(saveSpy).to.have.been.calledOnce;
        expect(saveSpy).to.have.been.calledWith(sinon.match.hasNested('department.name', 'foo'));
      });
    });

    describe('hiddenFields', () => {
      it('hides fields only for the specified properties', async () => {
        const form = await populatePersonForm(1, { hiddenFields: ['gender', 'birthDate', 'appointmentTime'] });
        expect(form.queryField('Gender')).to.be.undefined;
        expect(form.queryField('Birth date')).to.be.undefined;
        expect(form.queryField('Appointment time')).to.be.undefined;
        const visibleFields = LABELS.filter((label) => !['Gender', 'Birth date', 'Appointment time'].includes(label));
        for (const visibleField of visibleFields) {
          expect(form.queryField(visibleField)).to.exist;
        }
      });

      it('hides fields for nested properties that are not included by default', async () => {
        const form = await populatePersonForm(1, { hiddenFields: ['address.street'] });
        expect(form.queryField('Street')).to.be.undefined;
      });

      it('ignores non-existing properties', async () => {
        const service = personService();
        const person = (await getItem(service, 1))!;

        const form = await populatePersonForm(1, { hiddenFields: ['foo'] });
        await expect(form.getValues(...LABELS)).to.eventually.be.deep.equal(getExpectedValues(person));
      });
    });

    describe('Delete button', () => {
      let service: CrudService<Person> & HasTestInfo;
      let person: Person;
      let deleteStub: sinon.SinonStub;
      let onDeleteSuccessSpy: sinon.SinonSpy;
      let onDeleteErrorSpy: sinon.SinonSpy;

      beforeEach(async () => {
        service = personService();
        person = (await getItem(service, 2))!;
        deleteStub = sinon.stub(service, 'delete');
        deleteStub.returns(Promise.resolve());
        onDeleteSuccessSpy = sinon.spy();
        onDeleteErrorSpy = sinon.spy();
      });

      afterEach(() => {
        // cleanup dangling overlay
        const overlay = document.querySelector('vaadin-confirm-dialog-overlay');
        if (overlay) {
          overlay.remove();
        }
      });

      async function renderForm(item: Person | typeof emptyItem | null, enableDelete: boolean) {
        return FormController.init(
          user,
          render(
            <AutoForm
              service={service}
              model={PersonModel}
              item={item}
              deleteButton={enableDelete}
              onDeleteSuccess={onDeleteSuccessSpy}
              onDeleteError={onDeleteErrorSpy}
            />,
          ).container,
        );
      }

      it('does not show a delete button by default', async () => {
        const form = await renderForm(person, false);

        expect(form.queryButton('Delete...')).to.not.exist;
      });

      it('does show a delete button if delete button is enabled', async () => {
        const form = await renderForm(person, true);

        expect(form.queryButton('Delete...')).to.exist;
      });

      it('does not show a delete button if nothing is edited', async () => {
        const form = await renderForm(null, true);

        expect(form.queryButton('Delete...')).to.not.exist;
      });

      it('does not show a delete button if a new item is edited', async () => {
        const form = await renderForm(emptyItem, true);

        expect(form.queryButton('Delete...')).to.not.exist;
      });

      it('only shows delete button for models that have an ID property', async () => {
        // Model with JPA annotations
        let form = await FormController.init(
          user,
          render(<AutoForm service={service} model={PersonModel} item={person} deleteButton={true} />).container,
        );
        expect(form.queryButton('Delete...')).to.exist;

        // Model with simple ID property
        form = await FormController.init(
          user,
          render(
            <AutoForm service={service} model={PersonWithSimpleIdPropertyModel} item={person} deleteButton={true} />,
          ).container,
        );
        expect(form.queryButton('Delete...')).to.exist;

        // Model without discernible ID property
        form = await FormController.init(
          user,
          render(<AutoForm service={service} model={PersonWithoutIdPropertyModel} item={person} deleteButton={true} />)
            .container,
        );
        expect(form.queryButton('Delete...')).not.to.exist;
      });

      it('does shows confirmation dialog before deleting', async () => {
        const form = await renderForm(person, true);
        const deleteButton = await form.findButton('Delete...');
        await userEvent.click(deleteButton);

        const dialog = await ConfirmDialogController.init(document.body, user);
        expect(dialog.text).to.equal('Are you sure you want to delete the selected item?');
      });

      it('deletes item and calls success callback after confirming', async () => {
        const form = await renderForm(person, true);
        const deleteButton = await form.findButton('Delete...');
        await userEvent.click(deleteButton);

        const dialog = await ConfirmDialogController.init(document.body, user);
        await dialog.confirm();

        expect(deleteStub).to.have.been.calledOnce;
        expect(onDeleteSuccessSpy).to.have.been.calledOnce;
        expect(onDeleteErrorSpy).to.not.have.been.called;
      });

      it('does not delete item nor call callbacks after canceling', async () => {
        const form = await renderForm(person, true);
        const deleteButton = await form.findButton('Delete...');
        await userEvent.click(deleteButton);

        const dialog = await ConfirmDialogController.init(document.body, user);
        await dialog.cancel();

        expect(deleteStub).to.not.have.been.called;
        expect(onDeleteSuccessSpy).to.not.have.been.called;
        expect(onDeleteErrorSpy).to.not.have.been.called;
      });

      it('calls error callback if delete fails', async () => {
        const error = new EndpointError('Delete failed');
        deleteStub.returns(Promise.reject(error));

        const form = await renderForm(person, true);
        const deleteButton = await form.findButton('Delete...');
        await userEvent.click(deleteButton);

        const dialog = await ConfirmDialogController.init(document.body, user);
        await dialog.confirm();

        expect(deleteStub).to.have.been.calledOnce;
        expect(onDeleteSuccessSpy).to.not.have.been.called;
        expect(onDeleteErrorSpy).to.have.been.calledOnce;
        expect(onDeleteErrorSpy).to.have.been.calledWith(sinon.match.hasNested('error.message', 'Delete failed'));
      });

      it('hides delete button when deprecated deleteButtonVisible is true', async () => {
        const form = await FormController.init(
          user,
          render(<AutoForm service={service} model={PersonModel} item={person} deleteButtonVisible={false} />)
            .container,
        );
        expect(form.queryButton('Delete...')).to.not.exist;
      });

      it('gives priority to deleteButton over deleteButtonVisible', async () => {
        const form = await FormController.init(
          user,
          render(
            <AutoForm
              service={service}
              model={PersonModel}
              item={person}
              deleteButton={false}
              deleteButtonVisible={true}
            />,
          ).container,
        );
        expect(form.queryButton('Delete...')).to.not.exist;
      });

      it('passes proper item ID when using a model using JPA annotations', async () => {
        const form = await FormController.init(
          user,
          render(<AutoForm service={service} model={PersonModel} item={person} deleteButton={true} />).container,
        );
        const deleteButton = await form.findButton('Delete...');
        await userEvent.click(deleteButton);

        const dialog = await ConfirmDialogController.init(document.body, user);
        await dialog.confirm();

        expect(deleteStub).to.have.been.calledOnce;
        expect(deleteStub).to.have.been.calledWith(person.id);
      });

      it('passes proper item ID when using a model with a simple ID property', async () => {
        const form = await FormController.init(
          user,
          render(
            <AutoForm service={service} model={PersonWithSimpleIdPropertyModel} item={person} deleteButton={true} />,
          ).container,
        );
        const deleteButton = await form.findButton('Delete...');
        await userEvent.click(deleteButton);

        const dialog = await ConfirmDialogController.init(document.body, user);
        await dialog.confirm();

        expect(deleteStub).to.have.been.calledOnce;
        expect(deleteStub).to.have.been.calledWith(person.id);
      });

      it('passes proper item ID when using a model with a custom ID property', async () => {
        const form = await FormController.init(
          user,
          render(
            <AutoForm service={service} model={PersonModel} itemIdProperty="email" item={person} deleteButton={true} />,
          ).container,
        );
        const deleteButton = await form.findButton('Delete...');
        await userEvent.click(deleteButton);

        const dialog = await ConfirmDialogController.init(document.body, user);
        await dialog.confirm();

        expect(deleteStub).to.have.been.calledOnce;
        expect(deleteStub).to.have.been.calledWith(person.email);
      });
    });

    it('allows to show a custom error message if deletion fails', async () => {
      const service: CrudService<Person> & HasTestInfo = createService<Person>(personData);
      sinon.stub(service, 'delete').rejects(new EndpointError('foobar'));
      const person = await getItem(service, 1);
      const deleteSpy = sinon.spy();
      const result = render(
        <AutoForm
          service={service}
          model={PersonModel}
          item={person}
          deleteButton={true}
          onDeleteSuccess={deleteSpy}
          // eslint-disable-next-line @typescript-eslint/unbound-method
          onDeleteError={({ error, setMessage }) => setMessage(`Got error: ${error.message}`)}
        />,
      );
      const form = await FormController.init(user, result.container);
      const deleteButton = await form.findButton('Delete...');
      await userEvent.click(deleteButton);

      const dialog = await ConfirmDialogController.init(document.body, user);
      await dialog.confirm();

      expect(deleteSpy).to.not.have.been.called;
      expect(result.queryByText('Got error: foobar')).to.not.be.null;
    });

    describe('AutoFormDateField', () => {
      it('formats and parses values using localized date format', async () => {
        await page.viewport(1000, 1000);
        const service = personService();
        const person = await getItem(service, 1);
        const result = render(
          <LocaleContext.Provider value="de-DE">
            <AutoForm service={service} model={PersonModel} item={person} />
          </LocaleContext.Provider>,
        );
        const form = await FormController.init(user, result.container);
        const dateField = await form.getField('Birth date');
        const input = dateField.querySelector('input')!;
        expect(input.value).to.equal('31.12.1999');

        await user.clear(input);
        await user.type(input, '01.01.2000{enter}');
        expect(dateField.value).to.equal('2000-01-01');
      });
    });

    describe('AutoFormDateTimeField', () => {
      it('formats and parses values using localized date format', async () => {
        await page.viewport(1000, 1000);
        const service = personService();
        const person = await getItem(service, 1);
        const result = render(
          <LocaleContext.Provider value="de-DE">
            <AutoForm service={service} model={PersonModel} item={person} />
          </LocaleContext.Provider>,
        );
        const form = await FormController.init(user, result.container);
        const dateTimeField = await form.getField('Appointment time');
        const [dateInput, timeInput] = Array.from(dateTimeField.querySelectorAll('input'));
        expect(dateInput.value).to.equal('13.5.2021');
        expect(timeInput.value).to.equal('08:45');

        await user.clear(dateInput);
        await user.type(dateInput, '12.5.2021{enter}');
        await user.clear(timeInput);
        await user.type(timeInput, '09:00{enter}');
        expect(dateTimeField.value).to.equal('2021-05-12T09:00');
      });
    });

    describe('AutoFormEnumField', () => {
      it('formats enum values using title case', async () => {
        const service = personService();
        const person = await getItem(service, 1);
        const result = render(<AutoForm service={service} model={PersonModel} item={person} />);
        const form = await FormController.init(user, result.container);
        const select = (await form.getField('Gender')) as SelectElement;

        expect(select.items).to.eql([
          {
            label: 'Male',
            value: 'MALE',
          },
          {
            label: 'Female',
            value: 'FEMALE',
          },
          {
            label: 'Non Binary',
            value: 'NON_BINARY',
          },
        ]);
      });
    });

    describe('AutoFormObjectField', () => {
      it('renders readonly text area with JSON string', async () => {
        const service = personService();
        const person = (await getItem(service, 1))!;
        const result = render(
          <AutoForm service={service} model={PersonModel} item={person} visibleFields={['address', 'department']} />,
        );
        const form = await FormController.init(user, result.container);
        const [addressField, departmentField] = await form.getFields('Address', 'Department');
        expect(addressField.localName).to.equal('vaadin-text-area');
        expect((addressField as TextAreaElement).readonly).to.be.true;
        expect(departmentField.localName).to.equal('vaadin-text-area');
        expect((departmentField as TextAreaElement).readonly).to.be.true;

        const addressJson = JSON.stringify(person.address);
        const departmentJson = JSON.stringify(person.department);
        expect(addressField.value).to.equal(addressJson);
        expect(departmentField.value).to.equal(departmentJson);
      });

      it('renders JSON string with default values when creating new item', async () => {
        const service = personService();
        const result = render(
          <AutoForm service={service} model={PersonModel} visibleFields={['address', 'department']} />,
        );
        const form = await FormController.init(user, result.container);
        const [addressField, departmentField] = await form.getFields('Address', 'Department');

        expect(addressField.value).to.equal(JSON.stringify(DEFAULT_PERSON.address));
        expect(departmentField.value).to.equal(JSON.stringify(DEFAULT_PERSON.department));
      });

      it('renders JSON string with default values when creating new item', async () => {
        const service = personService();
        const result = render(
          <AutoForm service={service} model={PersonModel} visibleFields={['address', 'department']} />,
        );
        const form = await FormController.init(user, result.container);
        const [addressField, departmentField] = await form.getFields('Address', 'Department');

        expect(addressField.value).to.equal(JSON.stringify(DEFAULT_PERSON.address));
        expect(departmentField.value).to.equal(JSON.stringify(DEFAULT_PERSON.department));
      });
    });

    describe('Field Options', () => {
      describe('renderer', () => {
        it('renders custom field instead of the default field', async () => {
          const service = personService();
          const saveSpy = sinon.spy(service, 'save');

          const result = await populatePersonForm(
            1,
            {
              fieldOptions: {
                lastName: {
                  label: 'Custom last name',
                  renderer: ({ field }) => <TextArea key={field.name} {...field} />,
                },
              },
            },
            undefined,
            false,
            service,
          );

          const field = await result.getField('Custom last name');
          expect(field.localName).to.equal('vaadin-text-area');

          await result.typeInField('Custom last name', 'Maxwell\nSmart');
          await result.submit();

          expect(saveSpy).to.have.been.calledOnce;
          expect(saveSpy).to.have.been.calledWith(sinon.match.hasNested('lastName', 'Maxwell\nSmart'));
        });

        it('disables custom field when form is disabled', async () => {
          const result = await populatePersonForm(
            1,
            {
              fieldOptions: {
                lastName: {
                  renderer: ({ field }) => <TextArea key={field.name} {...field} />,
                },
              },
            },
            undefined,
            true,
          );

          const field = await result.getField('Last name');
          expect(field.disabled).to.be.true;
        });

        it('prefers custom fields props over field options props', async () => {
          const result = await populatePersonForm(1, {
            fieldOptions: {
              lastName: {
                label: 'This should not be used',
                renderer: ({ field }) => <TextArea key={field.name} {...field} label="Custom last name" />,
              },
            },
          });

          const field = result.queryField('Custom last name');
          expect(field).to.exist;
        });

        it('should submit when the enter key is pressed on a custom renderer field', async () => {
          const service = personService();
          const saveSpy = sinon.spy(service, 'save');

          const result = await populatePersonForm(
            1,
            {
              fieldOptions: {
                lastName: {
                  label: 'Custom last name',
                  renderer: ({ field }) => <TextField key={field.name} {...field} />,
                },
              },
            },
            undefined,
            false,
            service,
          );

          await result.typeInField('Custom last name', 'Maxwell Smart{enter}');

          expect(saveSpy).to.have.calledOnce;
          expect(saveSpy).to.have.been.calledWith(sinon.match.hasNested('lastName', 'Maxwell Smart'));
        });

        it('should not submit when the enter key pressed on a textarea', async () => {
          const service = personService();
          const saveSpy = sinon.spy(service, 'save');

          const result = await populatePersonForm(
            1,
            {
              fieldOptions: {
                lastName: {
                  label: 'Custom last name',
                  renderer: ({ field }) => <TextArea key={field.name} {...field} />,
                },
              },
            },
            undefined,
            false,
            service,
          );

          await result.typeInField('Custom last name', 'Maxwell\nSmart{enter}');

          expect(saveSpy).to.have.not.called;
        });
      });

      describe('element', () => {
        it('renders custom field instead of the default field', async () => {
          const service = personService();
          const saveSpy = sinon.spy(service, 'save');
          const result = await populatePersonForm(
            1,
            {
              fieldOptions: {
                lastName: {
                  element: <TextArea label="Custom last name" />,
                },
              },
            },
            undefined,
            false,
            service,
          );

          const field = await result.getField('Custom last name');
          expect(field.localName).to.equal('vaadin-text-area');

          await result.typeInField('Custom last name', 'Maxwell\nSmart');
          await result.submit();

          expect(saveSpy).to.have.been.calledOnce;
          expect(saveSpy).to.have.been.calledWith(sinon.match.hasNested('lastName', 'Maxwell\nSmart'));
        });

        it('disables custom field when form is disabled', async () => {
          const result = await populatePersonForm(
            1,
            {
              fieldOptions: {
                lastName: {
                  element: <TextArea />,
                },
              },
            },
            undefined,
            true,
          );

          const field = await result.getField('Last name');
          expect(field.disabled).to.be.true;
        });

        it('applies field options props to custom field', async () => {
          const result = await populatePersonForm(1, {
            fieldOptions: {
              lastName: {
                placeholder: 'Custom placeholder',
                helperText: 'Custom helper text',
                element: <TextArea />,
              },
            },
          });

          const field = (await result.getField('Last name')) as TextAreaElement;
          expect(field.placeholder).to.equal('Custom placeholder');
          expect(field.helperText).to.equal('Custom helper text');
        });

        it('prefers custom fields props over field options props', async () => {
          const result = await populatePersonForm(1, {
            fieldOptions: {
              lastName: {
                label: 'This should not be used',
                placeholder: 'This should not be used',
                element: <TextArea label="Custom last name" placeholder="Custom placeholder" />,
              },
            },
          });

          const field = result.queryField('Custom last name') as TextAreaElement;
          expect(field).to.exist;
          expect(field.placeholder).to.equal('Custom placeholder');
        });

        it('preserves custom field props', async () => {
          const result = await populatePersonForm(1, {
            fieldOptions: {
              lastName: {
                element: <TextArea clearButtonVisible />,
              },
            },
          });

          const field = (await result.getField('Last name')) as TextAreaElement;
          expect(field.clearButtonVisible).to.be.true;
        });

        it('is not used if a renderer is defined', async () => {
          const result = await populatePersonForm(1, {
            fieldOptions: {
              lastName: {
                renderer: () => <TextArea label="Rendered element" />,
                element: <TextArea label="Ignored element" />,
              },
            },
          });

          await expect(result.getField('Rendered element')).to.eventually.exist;
        });
      });

      it('allows customizing common field props', async () => {
        const result = render(
          <AutoForm
            service={personService()}
            model={PersonModel}
            fieldOptions={{
              firstName: {
                id: 'first-name-id',
                className: 'first-name-class',
                style: {
                  color: 'red',
                },
                label: 'Employee First Name',
                placeholder: 'First Name Placeholder',
                helperText: 'First Name Helper Text',
                colspan: 3,
                disabled: true,
                readonly: true,
              },
            }}
          />,
        );
        const form = await FormController.init(user, result.container);

        const field = form.queryField('Employee First Name');
        expect(field).to.exist;
        expect(form.queryField('First name')).to.not.exist;

        const textField = field as TextFieldElement;
        expect(textField.id).to.equal('first-name-id');
        expect(textField.getAttribute('class')).to.equal('first-name-class');
        expect(textField.style.color).to.equal('red');
        expect(textField.placeholder).to.equal('First Name Placeholder');
        expect(textField.helperText).to.equal('First Name Helper Text');
        expect(textField.getAttribute('colspan')).to.equal('3');
        expect(textField.disabled).to.be.true;
        expect(textField.readonly).to.be.true;
      });

      it('passes colspan to fields', async () => {
        const result = await FormController.init(
          user,
          render(
            <AutoForm
              service={personService()}
              model={PersonModel}
              fieldOptions={{
                firstName: { colspan: 2 },
                lastName: { colspan: 3 },
                email: { colspan: 4 },
                someInteger: { colspan: 5 },
                someDecimal: { colspan: 6 },
              }}
            />,
          ).container,
        );

        await expectFieldColSpan(result, 'First name', '2');
        await expectFieldColSpan(result, 'Last name', '3');
        await expectFieldColSpan(result, 'Email', '4');
        await expectFieldColSpan(result, 'Some integer', '5');
        await expectFieldColSpan(result, 'Some decimal', '6');
      });
    });

    describe('formLayoutProps', () => {
      it('passes responsiveSteps to FormLayout', async () => {
        const form = await populatePersonForm(1, {
          formLayoutProps: {
            responsiveSteps: [{ minWidth: 0, columns: 1, labelsPosition: 'top' }],
          },
        });
        expect(form.formLayout.responsiveSteps).to.have.length(1);
        expect(form.formLayout.responsiveSteps).to.be.deep.equal([{ minWidth: 0, columns: 1, labelsPosition: 'top' }]);
      });
    });

    describe('customize style props', () => {
      it('renders properly without custom id, class name and style property', () => {
        const { container } = render(<AutoForm service={personService()} model={PersonModel} />);
        const autoFormElement = container.firstElementChild as HTMLElement;

        expect(autoFormElement).to.exist;
        expect(autoFormElement.id).to.equal('');
        expect(autoFormElement.className.trim()).to.equal('auto-form');
        expect(autoFormElement.getAttribute('style')).to.equal(null);
      });

      it('renders with custom id, class name and style property on top most element', () => {
        const { container } = render(
          <AutoForm
            service={personService()}
            model={PersonModel}
            id="my-id"
            className="custom-auto-form"
            style={{ backgroundColor: 'blue' }}
          />,
        );
        const autoFormElement = container.firstElementChild as HTMLElement;

        expect(autoFormElement).to.exist;
        expect(autoFormElement.id).to.equal('my-id');
        expect(autoFormElement.className.trim()).to.equal('auto-form custom-auto-form');
        expect(autoFormElement.getAttribute('style')).to.equal('background-color: blue;');
      });
    });

    describe('custom client-side validators', () => {
      it('validates form field with custom validator ', async () => {
        const form = await populatePersonForm(1, {
          fieldOptions: {
            firstName: {
              validators: [
                {
                  message: 'First name must longer than 3 characters',
                  validate: (value: string) => value.length > 3,
                },
              ],
            },
          },
        });
        const firstNameField = (await form.getField('First name')) as TextFieldElement;
        expect(firstNameField.invalid).to.be.false;
        await form.typeInField('First name', 'Dan{enter}');
        expect(firstNameField.invalid).to.be.true;
        expect(firstNameField.errorMessage).to.equal('First name must longer than 3 characters');
        await form.typeInField('First name', 'Daniel{enter}');
        expect(firstNameField.invalid).to.be.false;
      });

      it('renders form field with multiple custom validators', async () => {
        const form = await populatePersonForm(1, {
          fieldOptions: {
            firstName: {
              validators: [
                {
                  message: 'First name must longer than 3 characters',
                  validate: (value: string) => value.length > 3,
                },
                {
                  message: 'First name must start with M',
                  validate: (value: string) => value.startsWith('M'),
                },
              ],
            },
          },
        });
        await form.typeInField('First name', 'Dan{enter}');
        const firstNameField = (await form.getField('First name')) as TextFieldElement;
        expect(firstNameField.invalid).to.be.true;
        expect(firstNameField.errorMessage).to.equal('First name must longer than 3 characters');
      });
    });
  });
});
