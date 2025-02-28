import { render, screen, waitForElementToBeRemoved, within, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextField } from '@vaadin/react-components/TextField.js';
import { page } from '@vitest/browser/context';
import chaiAsPromised from 'chai-as-promised';
import chaiDom from 'chai-dom';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { afterEach, beforeEach, chai, describe, expect, it } from 'vitest';
import { type AutoCrudProps, AutoCrud } from '../src/autocrud.js';
import ConfirmDialogController from './ConfirmDialogController.js';
import { CrudController } from './CrudController.js';
import FormController from './FormController';
import GridController from './GridController';
import {
  createService,
  getItem,
  PersonModel,
  personService,
  type UserData,
  UserDataModel,
} from './test-models-and-services.js';

chai.use(sinonChai);
chai.use(chaiDom);
chai.use(chaiAsPromised);

describe('@vaadin/hilla-react-crud', () => {
  describe('Auto crud', () => {
    let user: ReturnType<(typeof userEvent)['setup']>;

    beforeEach(async () => {
      // Desktop resolution
      user = userEvent.setup();
      await page.viewport(1024, 768);
    });

    afterEach(() => {
      cleanup();
    });

    function TestAutoCrud(props: Partial<AutoCrudProps<PersonModel>> = {}) {
      return <AutoCrud service={personService()} model={PersonModel} {...props} />;
    }

    it('shows a grid and a form', async () => {
      const { grid, form } = await CrudController.init(render(<TestAutoCrud />), user);
      expect(grid.instance).not.to.be.undefined;
      expect(form.instance).not.to.be.undefined;
    });

    it('edits an item when selecting a grid row', async () => {
      const { grid, form } = await CrudController.init(render(<TestAutoCrud />), user);
      await grid.toggleRowSelected(0);
      expect((await form.getField('First name')).value).to.equal('Jane');
      expect((await form.getField('Last name')).value).to.equal('Love');
    });

    it('clears and disables the form when deselecting an item', async () => {
      const { grid, form } = await CrudController.init(render(<TestAutoCrud />), user);
      await grid.toggleRowSelected(1);
      await grid.toggleRowSelected(1);
      const firstName = await form.getField('First name');
      expect(firstName.value).to.equal('');
      expect(firstName.disabled).to.be.true;

      const someInteger = await form.getField('Some integer');
      expect(someInteger.value).to.equal('');
      expect(someInteger.disabled).to.be.true;
    });

    it('disables the form when nothing is selected', async () => {
      const { form } = await CrudController.init(render(<TestAutoCrud />), user);
      const field = await form.getField('First name');
      expect(field.disabled).to.be.true;
    });

    it('refreshes the grid when the form is submitted', async () => {
      const { grid, form } = await CrudController.init(render(<TestAutoCrud />), user);
      await grid.toggleRowSelected(1);

      await form.typeInField('First name', 'foo');
      await form.submit();

      expect(grid.getBodyCellContent(1, 0)).to.have.rendered.text('foo');
    });

    it('keeps the selection when the form is submitted', async () => {
      const { grid, form } = await CrudController.init(render(<TestAutoCrud />), user);
      await grid.toggleRowSelected(1);

      await form.typeInField('First name', 'newName');
      await form.submit();

      expect(grid.isSelected(1)).to.be.true;
    });

    it('allows multiple subsequent edits', async () => {
      const { grid, form } = await CrudController.init(render(<TestAutoCrud />), user);
      await grid.toggleRowSelected(1);
      await form.typeInField('Last name', '1');
      await form.submit();
      expect(grid.getBodyCellContent(1, 1)).to.have.text('1');
      await form.typeInField('Last name', '2');
      await form.submit();
      expect(grid.getBodyCellContent(1, 1)).to.have.text('2');
    });

    it('can hide new button', async () => {
      const { rerender } = render(<AutoCrud service={personService()} model={PersonModel} />);
      await waitFor(() => expect(screen.queryByText('+ New')).to.exist);
      rerender(<AutoCrud service={personService()} model={PersonModel} newButton={true} />);
      await waitFor(() => expect(screen.queryByText('+ New')).to.exist);
      rerender(<AutoCrud service={personService()} model={PersonModel} newButton={false} />);
      await waitFor(() => expect(screen.queryByText('+ New')).to.be.null);
    });

    it('can add a new item', async () => {
      const { grid, form, newButton } = await CrudController.init(
        render(<AutoCrud service={personService()} model={PersonModel} />),
        user,
      );
      await user.click(newButton);
      const [firstNameField, lastNameField, someIntegerField, someDecimalField] = await form.getFields(
        'First name',
        'Last name',
        'Some integer',
        'Some decimal',
      );

      expect(firstNameField.value).to.equal('');
      expect(lastNameField.value).to.equal('');
      expect(someIntegerField.value).to.equal('');
      expect(someDecimalField.value).to.equal('');
      await form.typeInField('First name', 'Jeff');
      await form.typeInField('Last name', 'Lastname');
      await form.typeInField('Email', 'first.last@domain.com');
      await form.typeInField('Some integer', '12');
      await form.typeInField('Some decimal', '12.345');
      await form.submit();
      expect(grid.getBodyCellContent(1, 0)).to.have.rendered.text('Jeff');
    });

    it('keeps the form values after submitting a new item', async () => {
      const { form, newButton } = await CrudController.init(render(<TestAutoCrud />), user);
      await user.click(newButton);

      await form.typeInField('First name', 'John');
      await form.typeInField('Last name', 'Bulkeley');
      await form.submit();

      await expect(form.getValues('First name', 'Last name')).to.eventually.eql(['John', 'Bulkeley']);
    });

    it('can update added item', async () => {
      const { grid, form, newButton } = await CrudController.init(
        render(<AutoCrud service={personService()} model={PersonModel} />),
        user,
      );
      await user.click(newButton);

      await form.typeInField('First name', 'Jeff');
      await form.typeInField('Last name', 'Lastname');
      await form.typeInField('Email', 'first.last@domain.com');
      await form.typeInField('Some integer', '12');
      await form.typeInField('Some decimal', '12.345');

      await form.submit();
      await form.typeInField('First name', 'Jerp');
      await form.submit();
      expect(grid.getBodyCellContent(1, 0)).to.have.rendered.text('Jerp');
      expect(grid.getRowCount()).to.equal(3);
    });

    it('updates grid and form when creating a new item after selecting an existing item', async () => {
      const { grid, form, newButton } = await CrudController.init(render(<TestAutoCrud />), user);
      await grid.toggleRowSelected(0);
      expect((await form.getField('First name')).value).to.equal('Jane');
      expect((await form.getField('Last name')).value).to.equal('Love');

      await user.click(newButton);

      // form should be cleared
      expect((await form.getField('First name')).value).to.equal('');
      expect((await form.getField('Last name')).value).to.equal('');

      // grid selection should reset
      expect(grid.isSelected(0)).to.be.false;
    });

    it('shows a delete button in the form', async () => {
      const { grid, form } = await CrudController.init(render(<TestAutoCrud />), user);
      await grid.toggleRowSelected(1);
      const deleteButton = await form.findButton('Delete...');
      expect(deleteButton).to.exist;
    });

    it('shows a confirmation dialog before deleting', async () => {
      const { grid, form } = await CrudController.init(render(<TestAutoCrud />), user);
      await grid.toggleRowSelected(1);
      const deleteButton = await form.findButton('Delete...');
      await user.click(deleteButton);
      const dialog = await ConfirmDialogController.init(document.body, user);
      expect(dialog.text).to.equal('Are you sure you want to delete the selected item?');
    });

    it('refreshes grid after confirming delete', async () => {
      const { grid, form } = await CrudController.init(render(<TestAutoCrud />), user);
      expect(grid.getRowCount()).to.equal(2);
      await grid.toggleRowSelected(1);
      const deleteButton = await form.findButton('Delete...');
      await user.click(deleteButton);
      const dialog = await ConfirmDialogController.init(document.body, user);
      await dialog.confirm();
      expect(grid.getRowCount()).to.equal(1);
    });

    it('clears and disables the form after confirming delete', async () => {
      const { grid, form } = await CrudController.init(render(<TestAutoCrud />), user);
      // Select item
      await grid.toggleRowSelected(0);
      // Delete item
      const deleteButton = await form.findButton('Delete...');
      await user.click(deleteButton);
      const dialog = await ConfirmDialogController.init(document.body, user);
      await dialog.confirm();
      // Form should be cleared and disabled
      const field = await form.getField('First name');
      expect(field.disabled).to.be.true;
      expect(field.value).to.be.empty;
    });

    it('does not refresh grid when not confirming delete', async () => {
      const { grid, form } = await CrudController.init(render(<TestAutoCrud />), user);
      expect(grid.getRowCount()).to.equal(2);
      await grid.toggleRowSelected(1);
      const deleteButton = await form.findButton('Delete...');
      await user.click(deleteButton);
      const dialog = await ConfirmDialogController.init(document.body, user);
      await dialog.cancel();
      expect(grid.getRowCount()).to.equal(2);
    });

    it('does render a delete button by default', async () => {
      const { grid, form } = await CrudController.init(render(<TestAutoCrud />), user);
      await grid.toggleRowSelected(1);
      const deleteButton = form.queryButton('Delete...');
      expect(deleteButton).to.exist;
    });

    it('does not render a delete button when hiding the delete button through form props', async () => {
      const { grid, form } = await CrudController.init(
        render(<TestAutoCrud formProps={{ deleteButton: false }} />),
        user,
      );
      await grid.toggleRowSelected(1);
      const deleteButton = form.queryButton('Delete...');
      expect(deleteButton).to.not.exist;
    });

    it('shows a default header above the form', async () => {
      // Initial state
      const result = render(<TestAutoCrud />);
      let header = await result.findByRole('heading', { name: 'New item' });
      expect(header).to.exist;
      expect(header.style.color).to.contain('lumo-disabled-text-color');

      // Create new item
      const { grid, newButton } = await CrudController.init(result, user);
      await user.click(newButton);
      header = await result.findByRole('heading', { name: 'New item' });
      expect(header).to.exist;
      expect(header.style.color).to.contain('lumo-text-color');

      // Edit existing item
      await grid.toggleRowSelected(0);
      header = await result.findByRole('heading', { name: 'Edit item' });
      expect(header).to.exist;
      expect(header.style.color).to.contain('lumo-text-color');
    });

    it('shows a custom header above the form', async () => {
      // Initial state
      const result = render(
        <TestAutoCrud
          formProps={{
            headerRenderer: (editedItem) => (editedItem ? <h2>Edit person</h2> : <h2>Create person</h2>),
          }}
        />,
      );
      await expect(result.findByRole('heading', { name: 'Create person' })).to.eventually.exist;

      // Create new item
      const { grid, newButton } = await CrudController.init(result, user);
      await user.click(newButton);
      await expect(result.findByRole('heading', { name: 'Create person' })).to.eventually.exist;

      // Edit existing item
      await grid.toggleRowSelected(0);
      await expect(result.findByRole('heading', { name: 'Edit person' })).to.eventually.exist;
    });

    describe('mobile layout', () => {
      let saveSpy: sinon.SinonSpy;
      let service: ReturnType<typeof personService>;

      beforeEach(async () => {
        // iPhone 13 Pro resolution
        await page.viewport(390, 844);

        service = personService();
        saveSpy = sinon.spy(service, 'save');
      });

      afterEach(() => {
        // cleanup dangling overlay
        const overlay = document.querySelector('vaadin-dialog-overlay');
        if (overlay) {
          overlay.remove();
        }
      });

      it('opens the form in a dialog when selecting an item', async () => {
        const result = render(<TestAutoCrud service={service} />);
        const grid = await GridController.init(result, user);
        await grid.toggleRowSelected(0);

        const form = await FormController.init(user);
        expect(form.instance).to.exist;
        expect((await form.getField('First name')).value).to.equal('Jane');
        expect((await form.getField('Last name')).value).to.equal('Love');
      });

      it('opens the form in a dialog when creating a new item', async () => {
        const result = render(<TestAutoCrud service={service} />);
        const newButton = await result.findByText('+ New');
        await user.click(newButton);

        const form = await FormController.init(user);
        expect(form.instance).to.exist;
        expect((await form.getField('First name')).value).to.equal('');
        expect((await form.getField('Last name')).value).to.equal('');
      });

      it('opens the form in a dialog when row has undefined value', async () => {
        const nullData: UserData[] = [
          {
            id: 1,
            name: undefined,
          },
        ];
        const customService = createService(nullData);
        const result = render(<AutoCrud service={customService} model={UserDataModel} />);
        const grid = await GridController.init(result, user);
        await grid.toggleRowSelected(0);

        const form = await FormController.init(user);
        expect(form.instance).to.exist;
        expect(await form.getField('Name')).to.have.value('');
      });

      it('closes the dialog when clicking close button', async () => {
        const result = render(<TestAutoCrud service={service} />);
        const grid = await GridController.init(result, user);
        await grid.toggleRowSelected(0);

        const dialogOverlay = await screen.findByRole('dialog');
        const closeButton = await within(dialogOverlay).findByRole('button', { name: 'Close' });
        await user.click(closeButton);

        // dialog is closed
        await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));

        // grid selection is cleared
        expect(grid.isSelected(0)).to.be.false;

        // does not save
        expect(saveSpy).not.to.have.been.called;
      });

      it('closes the dialog when clicking submit button', async () => {
        const result = render(<TestAutoCrud service={service} />);
        const grid = await GridController.init(result, user);
        await grid.toggleRowSelected(0);

        const form = await FormController.init(user);
        await form.typeInField('First name', 'J'); // to enable the submit button
        await form.submit();

        // dialog is closed
        await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));

        // grid selection is cleared
        expect(grid.isSelected(0)).to.be.false;

        // saves
        expect(saveSpy).to.have.been.called;
      });

      it('shows a default header above the form', async () => {
        // Initial state
        const result = render(<TestAutoCrud />);
        expect(result.queryByRole('heading', { name: 'New item' })).to.not.exist;

        // Create new item
        const newButton = await result.findByText('+ New');
        await user.click(newButton);

        let dialogOverlay = await screen.findByRole('dialog');
        let header = await within(dialogOverlay).findByRole('heading', { name: 'New item' });
        expect(header).to.exist;
        expect(header.style.color).to.contain('lumo-text-color');

        // Close dialog
        const closeButton = await within(dialogOverlay).findByRole('button', { name: 'Close' });
        await user.click(closeButton);
        await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));

        // Edit existing item
        const grid = await GridController.init(result, user);
        await grid.toggleRowSelected(0);
        dialogOverlay = await screen.findByRole('dialog');
        header = await within(dialogOverlay).findByRole('heading', { name: 'Edit item' });
        expect(header).to.exist;
        expect(header.style.color).to.contain('lumo-text-color');
      });

      it('shows a custom header above the form', async () => {
        // Initial state
        const result = render(
          <TestAutoCrud
            formProps={{
              headerRenderer: (editedItem) => (editedItem ? <h2>Edit person</h2> : <h2>Create person</h2>),
            }}
          />,
        );
        expect(result.queryByRole('heading', { name: 'Create person' })).to.not.exist;

        // Create new item
        const newButton = await result.findByText('+ New');
        await user.click(newButton);

        let dialogOverlay = await screen.findByRole('dialog');
        await expect(within(dialogOverlay).findByRole('heading', { name: 'Create person' })).to.eventually.exist;

        // Close dialog
        const closeButton = await within(dialogOverlay).findByRole('button', { name: 'Close' });
        await user.click(closeButton);
        await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));

        // Edit existing item
        const grid = await GridController.init(result, user);
        await grid.toggleRowSelected(0);
        dialogOverlay = await screen.findByRole('dialog');
        await expect(within(dialogOverlay).findByRole('heading', { name: 'Edit person' })).to.eventually.exist;
      });
    });

    describe('customize grid', () => {
      it('allows passing custom grid props', async () => {
        const { grid } = await CrudController.init(
          render(
            <AutoCrud
              service={personService()}
              model={PersonModel}
              gridProps={{ visibleColumns: ['firstName', 'lastName'] }}
            />,
          ),
          user,
        );

        await expect(grid.getHeaderCellContents()).to.eventually.eql(['First name', 'Last name']);
      });
    });

    describe('customize form', () => {
      it('allows passing custom form props', async () => {
        const { form } = await CrudController.init(
          render(
            <AutoCrud
              service={personService()}
              model={PersonModel}
              formProps={{ visibleFields: ['firstName', 'lastName'] }}
            />,
          ),
          user,
        );

        expect(form.queryField('First name')).to.exist;
        expect(form.queryField('Last name')).to.exist;
        expect(form.queryField('Email')).not.to.exist;
      });

      it('allows using form model instance', async () => {
        const { grid, form: formController } = await CrudController.init(
          render(
            <AutoCrud
              service={personService()}
              model={PersonModel}
              formProps={{
                layoutRenderer: ({ form }) => <TextField {...form.field(form.model.firstName)} label="First name" />,
              }}
            />,
          ),
          user,
        );

        await grid.toggleRowSelected(0);
        expect((await formController.getField('First name')).value).to.equal('Jane');
      });
    });

    describe('customize style props', () => {
      it('renders properly without custom id, class name and style property', () => {
        const { container } = render(<AutoCrud service={personService()} model={PersonModel} />);
        const autoCrudElement = container.firstElementChild as HTMLElement;

        expect(autoCrudElement).to.exist;
        expect(autoCrudElement.id).to.equal('');
        expect(autoCrudElement.className.trim()).to.equal('auto-crud');
        expect(autoCrudElement.getAttribute('style')).to.equal(null);
      });

      it('renders with custom id, class name and style property on top most element', () => {
        const { container } = render(
          <AutoCrud
            service={personService()}
            model={PersonModel}
            id="my-id"
            className="custom-auto-crud"
            style={{ backgroundColor: 'blue' }}
          />,
        );
        const autoCrudElement = container.firstElementChild as HTMLElement;

        expect(autoCrudElement).to.exist;
        expect(autoCrudElement.id).to.equal('my-id');
        expect(autoCrudElement.className.trim()).to.equal('auto-crud custom-auto-crud');
        expect(autoCrudElement.getAttribute('style')).to.equal('background-color: blue;');
      });
    });

    describe('item ID property', () => {
      it('should relay the item ID property to the grid', async () => {
        const { grid } = await CrudController.init(
          render(<AutoCrud service={personService()} model={PersonModel} itemIdProperty="email" />),
          user,
        );

        expect(grid.instance.itemIdPath).to.equal('email');
      });

      it('should relay the item ID property to the form', async () => {
        // Deleting an item is the only way to properly test the form's item ID property
        const service = personService();
        const deleteStub = sinon.stub(service, 'delete');
        deleteStub.returns(Promise.resolve());
        const person = (await getItem(service, 2))!;
        const { grid, form } = await CrudController.init(
          render(<AutoCrud service={service} model={PersonModel} itemIdProperty="email" />),
          user,
        );
        await grid.toggleRowSelected(0);

        const deleteButton = await form.findButton('Delete...');
        await userEvent.click(deleteButton);

        const dialog = await ConfirmDialogController.init(document.body, user);
        await dialog.confirm();

        expect(deleteStub).to.have.been.calledOnce;
        expect(deleteStub).to.have.been.calledWith(person.email);
      });
    });

    describe('other', () => {
      it('shows aria-control with form id', async () => {
        const { grid, form } = await CrudController.init(render(<TestAutoCrud />), user);
        await grid.toggleRowSelected(0);
        const formId = form.instance.id;
        expect(formId).to.exist;
        expect(formId)
          .to.be.a('string')
          .and.satisfy((id: string) => id.startsWith('auto-form-'));
        expect(grid.instance.getAttribute('aria-controls')).to.equal(formId);
      });

      it('shows aria-control with default id', async () => {
        const { grid } = await CrudController.init(render(<TestAutoCrud formProps={{ id: 'custom-form-id' }} />), user);
        await grid.toggleRowSelected(0);
        expect(grid.instance.getAttribute('aria-controls')).to.equal(`custom-form-id`);
      });
    });
  });
});
