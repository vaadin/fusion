package com.vaadin.hilla.crud.filter;

import java.util.List;

/**
 * A filter that requires all children to pass.
 * <p>
 * Custom filter implementations need to handle this filter by running all child
 * filters and verifying that all of them pass.
 */
public class AndFilter extends Filter {

    private List<Filter> children;

    /**
     * Create an empty filter.
     */
    public AndFilter() {
        // Empty constructor is needed for serialization
    }

    /**
     * Create a filter with the given children.
     *
     * @param children
     *            the children of the filter
     */
    public AndFilter(Filter... children) {
        setChildren(List.of(children));
    }

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
