package com.vaadin.hilla.test.reactgrid;

import java.time.LocalDate;
import java.util.Locale;
import java.util.function.Consumer;

import org.junit.Test;

import com.vaadin.flow.component.datepicker.testbench.DatePickerElement;
import com.vaadin.flow.component.select.testbench.SelectElement;
import com.vaadin.flow.component.textfield.testbench.NumberFieldElement;
import com.vaadin.flow.component.textfield.testbench.TextFieldElement;
import com.vaadin.flow.component.timepicker.testbench.TimePickerElement;
import com.vaadin.flow.spring.data.filter.PropertyStringFilter.Matcher;
import com.vaadin.testbench.TestBench;
import com.vaadin.testbench.TestBenchElement;
import com.vaadin.testbench.elementsbase.Element;

public class ReadOnlyGridWithHeaderFilterIT extends AbstractGridTest {

    private static final int FIRST_NAME_COLUMN = 0;
    private static final int LAST_NAME_COLUMN = 1;
    private static final int GENDER_COLUMN = 2;
    private static final int LUCKY_NUMBER_COLUMN = 3;
    private static final int EMAIL_VERIFIED_COLUMN = 5;
    private static final int BIRTH_DATE_COLUMN = 6;
    private static final int SHIFT_START_COLUMN = 7;
    private static final int APPOINTMENT_TIME_COLUMN = 8;

    protected String getTestPath() {
        return getRootURL() + "/readonly-grid-with-headerfilters";
    }

    @Test
    public void stringMatchesContains() {
        setHeaderFilter(FIRST_NAME_COLUMN, "al");
        assertRowCount(1);
        assertName(0, "Alice", "Johnson");

        // Test that we are and:ing
        setHeaderFilter(LAST_NAME_COLUMN, "j");
        assertRowCount(1);
        assertName(0, "Alice", "Johnson");

        setHeaderFilter(FIRST_NAME_COLUMN, "");
        assertRowCount(2);
        assertName(0, "Alice", "Johnson");
        assertName(1, "Henry", "Jackson");
    }

    @Test
    public void numberFilterWorks() {
        // Default is greater_than
        assertRowCount(50);
        sortByColumn(LUCKY_NUMBER_COLUMN);
        setHeaderFilter(LUCKY_NUMBER_COLUMN, null, "150");
        assertRowCount(4);
        assertName(0, "George", "Lee");

        setHeaderFilter(LUCKY_NUMBER_COLUMN, Matcher.LESS_THAN, (String) null);
        assertRowCount(50 - 4);
        assertName(0, "Dylan", "Fisher");

        setHeaderFilter(LUCKY_NUMBER_COLUMN, Matcher.EQUALS, "25");
        assertRowCount(1);
        assertName(0, "Thomas", "Vance");

    }

    @Test
    public void booleanFilterWorks() {
        // Default is greater_than
        assertRowCount(50);
        setBooleanHeaderFilter(EMAIL_VERIFIED_COLUMN, true);
        assertRowCount(42);
        assertName(0, "Abigail", "Carter");

        setBooleanHeaderFilter(EMAIL_VERIFIED_COLUMN, false);
        assertRowCount(50 - 42);
        assertName(0, "Catherine", "Evans");

        setBooleanHeaderFilter(EMAIL_VERIFIED_COLUMN, null);
        assertRowCount(50);
        assertName(0, "Abigail", "Carter");

    }

    @Test
    public void enumFilterWorks() {
        assertRowCount(50);
        setEnumHeaderFilter(GENDER_COLUMN, "Male");
        assertRowCount(44);
        assertName(0, "Abigail", "Carter");

        setEnumHeaderFilter(GENDER_COLUMN, "Female");
        assertRowCount(3);
        assertName(0, "Bob", "Davis");

        setEnumHeaderFilter(GENDER_COLUMN, "");
        assertRowCount(50);
        assertName(0, "Abigail", "Carter");
    }

    @Test
    public void localDateFilterWorks() {
        assertRowCount(50);
        sortByColumn(BIRTH_DATE_COLUMN);

        // Default is greater_than
        setHeaderFilter(BIRTH_DATE_COLUMN, null, "1999-04-30");
        assertRowCount(3);
        assertName(0, "Mark", "Young");

        setHeaderFilter(BIRTH_DATE_COLUMN, Matcher.LESS_THAN, (String) null);
        assertRowCount(46);
        assertName(0, "Xander", "Hill");

        setHeaderFilter(BIRTH_DATE_COLUMN, Matcher.EQUALS, (String) null);
        assertRowCount(1);
        assertName(0, "Abigail", "Carter");

    }

    @Test
    public void localTimeFilterWorks() {
        assertRowCount(50);
        sortByColumn(SHIFT_START_COLUMN);

        // Default is greater_than
        setHeaderFilter(SHIFT_START_COLUMN, null, "13:00");
        assertRowCount(22);
        assertName(0, "Uma", "Washington");

        setHeaderFilter(SHIFT_START_COLUMN, Matcher.LESS_THAN, (String) null);
        assertRowCount(27);
        assertName(0, "Jason", "Lopez");

        setHeaderFilter(SHIFT_START_COLUMN, Matcher.EQUALS, (String) null);
        assertRowCount(1);
        assertName(0, "Samuel", "Turner");

    }

    @Test
    public void localDateTimeFilterWorks() {
        assertRowCount(50);
        sortByColumn(APPOINTMENT_TIME_COLUMN);

        // Default is greater_than
        setHeaderFilter(APPOINTMENT_TIME_COLUMN, null, "2023-09-27");
        assertRowCount(1);
        assertName(0, "Tina", "Phillips");

        setHeaderFilter(APPOINTMENT_TIME_COLUMN, Matcher.LESS_THAN,
                (String) null);
        assertRowCount(1);
        assertName(0, "Abigail", "Carter");

        setHeaderFilter(APPOINTMENT_TIME_COLUMN, Matcher.EQUALS, (String) null);
        assertRowCount(48);
        assertName(0, "Catherine", "Evans");

    }

    @Test
    public void numberFilterWithInvalidInputIgnored() {
        setHeaderFilter(LUCKY_NUMBER_COLUMN, null, "a");
        assertRowCount(50);
        setHeaderFilter(LUCKY_NUMBER_COLUMN, null, "10000");
        assertRowCount(1);
    }

    private void setHeaderFilter(int columnIndex, String filter) {
        TestBenchElement cont = grid.getHeaderCellContent(1, columnIndex);
        TextFieldElement filterField = cont.$(TextFieldElement.class).first();
        filterField.setValue(filter);
    }

    private void setHeaderFilter(int columnIndex, Matcher matcher,
            String filter) {
        TestBenchElement cont = grid.getHeaderCellContent(1, columnIndex);
        SelectElement filterSelect = cont.$(SelectElement.class).first();
        if (matcher == Matcher.GREATER_THAN) {
            filterSelect.setProperty("value", "GREATER_THAN");
        } else if (matcher == Matcher.LESS_THAN) {
            filterSelect.setProperty("value", "LESS_THAN");
        } else if (matcher == Matcher.EQUALS) {
            filterSelect.setProperty("value", "EQUALS");
        }
        TestBenchElement filterField = filterSelect
                .getPropertyElement("nextElementSibling");
        if (filter != null) {
            ifType(filterField, TextFieldElement.class,
                    e -> e.setValue(filter));
            ifType(filterField, NumberFieldElement.class,
                    e -> e.setValue(filter));
            ifType(filterField, DatePickerElement.class,
                    e -> e.setDate(LocalDate.parse(filter)));
            ifType(filterField, TimePickerElement.class,
                    e -> e.setValue(filter));
        }
    }

    private void setBooleanHeaderFilter(int columnIndex, Boolean filter) {
        TestBenchElement cont = grid.getHeaderCellContent(1, columnIndex);
        SelectElement filterSelect = cont.$(SelectElement.class).first();
        String text = filter == null ? "" : filter ? "Yes" : "No";
        filterSelect.openPopup();

        filterSelect.getPropertyElement("_overlayElement").$("vaadin-item")
                .attribute("label", text).first().click();
    }

    private void setEnumHeaderFilter(int columnIndex, String label) {
        TestBenchElement cont = grid.getHeaderCellContent(1, columnIndex);
        SelectElement filterSelect = cont.$(SelectElement.class).first();
        filterSelect.openPopup();
        filterSelect.selectByText(label);
    }

    private <T extends TestBenchElement> void ifType(TestBenchElement element,
            Class<T> type, Consumer<T> cmd) {
        Element annotation = type.getAnnotation(Element.class);
        if (element.getTagName().toLowerCase(Locale.ENGLISH)
                .equals(annotation.value().toLowerCase(Locale.ENGLISH))) {
            cmd.accept(TestBench.wrap(element, type));
        }
    }

}
