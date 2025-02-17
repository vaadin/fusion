package com.vaadin.hilla.nonnullapi;

public class NonNullableEntity {
    private String value;

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }
}
