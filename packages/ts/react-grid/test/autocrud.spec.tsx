import { expect, use } from '@esm-bundle/chai';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import chaiDom from 'chai-dom';
import sinonChai from 'sinon-chai';
import { type AutoCrudProps, ExperimentalAutoCrud } from '../src/autocrud.js';
import ConfirmDialogController from './ConfirmDialogController.js';
import { CrudController } from './CrudController.js';
import { type Person, PersonModel, personService } from './test-models-and-services.js';

use(sinonChai);
use(chaiDom);

describe('@hilla/react-grid', () => {
  describe('Auto crud', () => {
    let user: ReturnType<(typeof userEvent)['setup']>;

    function TestAutoCrud(props: Partial<AutoCrudProps<Person>> = {}) {
      return <ExperimentalAutoCrud service={personService()} model={PersonModel} {...props} />;
    }

    beforeEach(() => {
      user = userEvent.setup();
    });

    it('shows a grid and a form', async () => {
      const { grid, form } = await CrudController.init(render(<TestAutoCrud />), user);
      expect(grid.instance).not.to.be.undefined;
      expect(form.instance).not.to.be.undefined;
    });

    it('passes the selected item and populates the form', async () => {
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

      const someNumber = await form.getField('Some number');
      expect(someNumber.value).to.equal(0);
      expect(someNumber.disabled).to.be.true;
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

      expect(grid.getBodyCellContent(1, 0)).to.have.property('innerText', 'foo');
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

    it('shows a confirmation dialog before deleting', async () => {
      const { grid } = await CrudController.init(render(<TestAutoCrud />), user);
      const cell = grid.getBodyCellContent(1, 5);
      await user.click(cell.querySelector('vaadin-button')!);
      const dialog = await ConfirmDialogController.init(cell, user);
      expect(dialog.text).to.equal('Are you sure you want to delete the selected item?');
      expect(grid.getBodyCellContent(1, 1)).to.have.property('innerText', 'Dove');
    });

    it('deletes and refreshes grid after confirming', async () => {
      const { grid } = await CrudController.init(render(<TestAutoCrud />), user);
      expect(grid.getVisibleRowCount()).to.equal(2);
      const cell = grid.getBodyCellContent(1, 5);
      await user.click(cell.querySelector('vaadin-button')!);
      const dialog = await ConfirmDialogController.init(cell, user);
      await dialog.confirm();
      expect(grid.getVisibleRowCount()).to.equal(1);
    });

    it('does not delete when not confirming', async () => {
      const { grid } = await CrudController.init(render(<TestAutoCrud />), user);
      expect(grid.getVisibleRowCount()).to.equal(2);
      const cell = grid.getBodyCellContent(1, 5);
      await user.click(cell.querySelector('vaadin-button')!);
      const dialog = await ConfirmDialogController.init(cell, user);
      await dialog.cancel();
      expect(grid.getVisibleRowCount()).to.equal(2);
    });

    it('does not render a delete button when noDelete', async () => {
      const { grid } = await CrudController.init(render(<TestAutoCrud noDelete />), user);
      const cell = grid.getBodyCellContent(1, 5);
      expect(cell).to.be.null;
    });
    it('shows a header if requested', async () => {
      const result = render(<ExperimentalAutoCrud service={personService()} model={PersonModel} header="Hello crud" />);
      await result.findByText('Hello crud');
    });
  });
});
