package com.vaadin.hilla.test.reactgrid;

import org.junit.Assert;
import org.junit.Test;

import com.vaadin.flow.component.button.testbench.ButtonElement;
import com.vaadin.flow.component.textfield.testbench.TextFieldElement;

public class GridUseDataProviderHookIT extends AbstractGridTest {

    protected String getTestPath() {
        return getRootURL() + "/grid-use-data-provider-hook";
    }

    @Test
    public void filteringWorks_and_refreshingDataProvider_keepsTheAppliedFilter() {
        setFilterLastName("car");
        assertRowCount(1);
        assertName(0, "Abigail", "Carter");

        setFilterLastName("Nel");
        assertRowCount(2);
        assertName(0, "Oscar", "Nelson");
        assertName(1, "Leo", "Nelson");

        refresh();

        assertRowCount(2);
        assertName(0, "Oscar", "Nelson");
        assertName(1, "Leo", "Nelson");

        setFilterLastName("");
        assertRowCount(50);
    }

    @Test
    public void sortingWorks_and_refreshingDataProvider_keepsTheAppliedSort() {
        assertFirstName(0, "Alice");
        assertFirstName(1, "Bob");
        assertFirstName(2, "Charlie");
        assertFirstName(3, "David");

        sortByColumn(0); // sort by firstName ascending
        assertFirstName(0, "Abigail");
        assertFirstName(1, "Alice");
        assertFirstName(2, "Benjamin");
        assertFirstName(3, "Bob");

        sortByColumn(0); // sort by firstName descending
        assertFirstName(0, "Zack");
        assertFirstName(1, "Yasmine");
        assertFirstName(2, "Xander");
        assertFirstName(3, "Xander");

        refresh();

        assertFirstName(0, "Zack");
        assertFirstName(1, "Yasmine");
        assertFirstName(2, "Xander");
        assertFirstName(3, "Xander");
    }

    @Test
    public void afterAddingNewItem_refreshingDataProvider_loadsNewItem() {
        try {
            assertRowCount(50);

            addPerson();
            refresh();

            setFilterLastName("Person");
            assertRowCount(1);
            assertName(0, "New", "Person");

            setFilterLastName("");
            assertRowCount(51);

        } finally {
            removePerson();
        }
    }

    private void setFilterLastName(String filter) {
        $(TextFieldElement.class).id("filter").setValue(filter);
    }

    private void refresh() {
        var refreshButton = $(ButtonElement.class).all().stream()
                .filter(button -> button.getText().equals("Refresh"))
                .findFirst();
        if (refreshButton.isPresent()) {
            refreshButton.get().click();
        } else {
            Assert.fail("Refresh button not found");
        }
    }

    private void addPerson() {
        var refreshButton = $(ButtonElement.class).all().stream()
                .filter(button -> button.getText().equals("Add Person"))
                .findFirst();
        if (refreshButton.isPresent()) {
            refreshButton.get().click();
        } else {
            Assert.fail("Add Person button not found");
        }
    }

    private void removePerson() {
        var refreshButton = $(ButtonElement.class).all().stream()
                .filter(button -> button.getText().equals("Remove Person"))
                .findFirst();
        if (refreshButton.isPresent()) {
            refreshButton.get().click();
        } else {
            Assert.fail("Remove Person button not found");
        }
    }

}
