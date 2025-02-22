package com.vaadin.hilla.test.reactgrid;

import java.util.Map;

import org.junit.Assert;
import org.junit.Test;

import com.vaadin.flow.component.Key;
import com.vaadin.flow.component.button.testbench.ButtonElement;
import com.vaadin.testbench.TestBenchElement;

public class GridUseGridDataProviderHookIT extends AbstractGridTest {

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
    public void filteringUsingSignalWorks() {
        assertFirstName(0, "Alice");
        assertFirstName(1, "Bob");
        assertFirstName(2, "Charlie");
        assertFirstName(3, "David");

        setFilter("al");
        assertFirstName(0, "Alice");
        assertFirstName(1, "Edward"); // Gonazlez matches
        assertFirstName(2, "Kathy"); // Walker matches
        assertFirstName(3, "Laura"); // Hall matches
        setFilter("");
        assertFirstName(0, "Alice");
        assertFirstName(1, "Bob");
        assertFirstName(2, "Charlie");
        assertFirstName(3, "David");

    }

    private void setFilter(String string) {
        TestBenchElement filterInput = $("input").first();
        filterInput.clear();
        filterInput.sendKeys(string);
        filterInput.dispatchEvent("input", Map.of("bubbles", true));
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
}
