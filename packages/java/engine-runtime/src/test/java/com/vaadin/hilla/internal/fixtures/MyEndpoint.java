package com.vaadin.hilla.internal.fixtures;

import com.vaadin.hilla.BrowserCallable;

/**
 * A test class.
 */
@BrowserCallable
public class MyEndpoint {

    /**
     * Foo endpoint.
     *
     * @param bar
     */
    public void foo(String bar) {
    }

    /**
     * Baz endpoint.
     *
     * @param baz
     * @return
     */
    public String bar(String baz) {
        return baz;
    }

}
