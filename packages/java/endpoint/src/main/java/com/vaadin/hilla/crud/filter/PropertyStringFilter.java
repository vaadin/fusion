package com.vaadin.hilla.crud.filter;

/**
 * A filter that matches a given property, or nested property path, against a
 * filter value using the specified matcher.
 * <p>
 * Custom filter implementations need to handle this filter by:
 * <ul>
 * <li>Extracting the property value from the object being filtered using
 * {@link #getPropertyId()}.</li>
 * <li>Convert the string representation of the filter value from
 * {@link #getFilterValue()} into a type that can be used for implementing a
 * comparison.</li>
 * <li>Do the actual comparison using the matcher / operator provided by
 * {@link #getMatcher()}</li>
 * </ul>
 */
public class PropertyStringFilter extends Filter {
    public enum Matcher {
        EQUALS, CONTAINS, LESS_THAN, GREATER_THAN;
    }

    private String propertyId;
    private String filterValue;
    private Matcher matcher;

    /**
     * Create an empty filter.
     */
    public PropertyStringFilter() {
        // Empty constructor is needed for serialization
    }

    /**
     * Create a filter with the given property, matcher and filter value.
     *
     * @param propertyId
     *            the property id, or a nested property path where each property
     *            is separated by a dot
     * @param matcher
     *            the matcher to use when comparing the property value to the
     *            filter value
     * @param filterValue
     *            the filter value to compare against
     */
    public PropertyStringFilter(String propertyId, Matcher matcher,
            String filterValue) {
        this.propertyId = propertyId;
        this.matcher = matcher;
        this.filterValue = filterValue;
    }

    /**
     * Gets the property, or nested property path, to filter by. For example
     * {@code "name"} or {@code "address.city"}.
     *
     * @return the property name
     */
    public String getPropertyId() {
        return propertyId;
    }

    /**
     * Sets the property, or nested property path, to filter by.
     *
     * @param propertyId
     *            the property name
     */
    public void setPropertyId(String propertyId) {
        this.propertyId = propertyId;
    }

    /**
     * Gets the filter value to compare against. The filter value is always
     * stored as a string, but can represent multiple types of values using
     * specific formats. For example, when filtering a property of type
     * {@code LocalDate}, the filter value could be {@code "2020-01-01"}. The
     * actual filter implementation is responsible for parsing the filter value
     * into the correct type to use for querying the underlying data layer.
     *
     * @return the filter value
     */
    public String getFilterValue() {
        return filterValue;
    }

    /**
     * Sets the filter value to compare against.
     *
     * @param filterValue
     *            the filter value
     */
    public void setFilterValue(String filterValue) {
        this.filterValue = filterValue;
    }

    /**
     * The matcher, or operator, to use when comparing the property value to the
     * filter value.
     *
     * @return the matcher
     */
    public Matcher getMatcher() {
        return matcher;
    }

    /**
     * Sets the matcher, or operator, to use when comparing the property value
     * to the filter value.
     *
     * @param type
     *            the matcher
     */
    public void setMatcher(Matcher type) {
        this.matcher = type;
    }

    @Override
    public String toString() {
        return "PropertyStringFilter [propertyId=" + propertyId + ", matcher="
                + matcher + ", filterValue=" + filterValue + "]";
    }

}
