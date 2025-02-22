package com.vaadin.hilla.test.reactgrid;

import java.util.List;
import java.util.Map;

import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import com.vaadin.flow.component.button.testbench.ButtonElement;
import com.vaadin.flow.component.combobox.testbench.ComboBoxElement;
import com.vaadin.flow.testutil.ChromeBrowserTest;
import com.vaadin.testbench.TestBenchElement;

public class ComboBoxUseComboBoxDataProviderHookIT extends ChromeBrowserTest {

    @Override
    protected String getTestPath() {
        return getRootURL() + "/"
                + getClass().getSimpleName().replace("IT", "");

    }

    @Override
    @Before
    public void setup() throws Exception {
        super.setup();
        getDriver().get(getTestPath());
    }

    @After
    public void checkBrowserLogs() {
        checkLogsForErrors();
    }

    @Test
    public void defaultSort_dataShown() {
        ComboBoxElement comboBox = $(ComboBoxElement.class).id("defaultSort");
        List<String> options = getOptions(comboBox);
        Assert.assertEquals("Johnson", options.get(0));
        Assert.assertEquals("Lewis", options.get(9));

    }

    @Test
    public void sortUsingLastname_dataShown() {
        ComboBoxElement comboBox = $(ComboBoxElement.class).id("sortLastName");
        List<String> options = getOptions(comboBox);
        Assert.assertEquals("Adams", options.get(0));
        Assert.assertEquals("Evans", options.get(9));
    }

    @Test
    public void filteringUsingSignalWorks() {
        ComboBoxElement comboBox = $(ComboBoxElement.class).id("prependFilter");
        List<String> options = getOptions(comboBox);
        Assert.assertEquals("Adams", options.get(0));
        Assert.assertEquals("Evans", options.get(9));
        comboBox.closePopup();

        TestBenchElement filterInput = $("input").id("filter");
        filterInput.sendKeys("c");
        options = getOptions(comboBox);
        Assert.assertEquals("Baker", options.get(0)); // Zack
        Assert.assertEquals("Johnson", options.get(9)); // Alice
    }

    private List<String> getOptions(ComboBoxElement comboBox) {
        comboBox.openPopup();
        return waitUntil(driver -> {
            List<String> opt = comboBox.getOptions();
            if (opt.isEmpty()) {
                return null;
            }
            return opt;
        });
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
