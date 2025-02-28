package com.vaadin.hilla.crud.filter;

import java.util.List;

/**
 * A filter that requires at least one of its children to pass.
 * <p>
 * Custom filter implementations need to handle this filter by running all child
 * filters and verifying that at least one of them passes.
 */
public class OrFilter extends Filter {

    private List<Filter> children;

    /**
     * Create an empty filter.
     */
    public OrFilter() {
        // Empty constructor is needed for serialization
    }

    /**
     * Create a filter with the given children.
     *
     * @param children
     *            the children of the filter
     */
    public OrFilter(Filter... children) {
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
        return "OrFilter [children=" + children + "]";
    }

}
