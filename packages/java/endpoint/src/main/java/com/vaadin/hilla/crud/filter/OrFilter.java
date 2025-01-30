package com.vaadin.hilla.crud.filter;

import java.util.List;

/**
 * A filter that requires at least one of its children to pass.
 * <p>
 * Custom filter implementations need to handle this filter by running all child
 * filters and verifying that at least one of them passes.
 *
 * @deprecated Use {@link com.vaadin.flow.spring.data.filter.OrFilter} instead
 */
@Deprecated(forRemoval = true)
public class OrFilter extends Filter {

    private List<Filter> children;

    public List<Filter> getChildren() {
        return children;
    }

    public void setChildren(List<Filter> children) {
        this.children = children;
    }

    @Override
    public String toString() {
        return "OrFilter [children=" + children + "]";
    }

}
