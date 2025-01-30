package com.vaadin.hilla.crud.filter;

import java.util.List;

/**
 * A filter that requires all children to pass.
 * <p>
 * Custom filter implementations need to handle this filter by running all child
 * filters and verifying that all of them pass.
 *
 * @deprecated Use {@link com.vaadin.flow.spring.data.filter.AndFilter} instead
 */
@Deprecated(forRemoval = true)
public class AndFilter extends Filter {
    private List<Filter> children;

    public List<Filter> getChildren() {
        return children;
    }

    public void setChildren(List<Filter> children) {
        this.children = children;
    }

    @Override
    public String toString() {
        return "AndFilter [children=" + children + "]";
    }

}
