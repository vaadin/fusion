package com.vaadin.hilla.crud;

import org.springframework.data.jpa.domain.Specification;

import com.vaadin.hilla.crud.filter.AndFilter;
import com.vaadin.hilla.crud.filter.Filter;
import com.vaadin.hilla.crud.filter.OrFilter;
import com.vaadin.hilla.crud.filter.PropertyStringFilter;

/**
 * Utility class for converting Hilla {@link Filter} specifications into JPA
 * filter specifications. This class can be used to implement filtering for
 * custom {@link ListService} or {@link CrudService} implementations that use
 * JPA as the data source.
 *
 * @deprecated Use {@link com.vaadin.flow.spring.data.jpa.JpaFilterConverter}
 *             instead
 */
@Deprecated(forRemoval = true)
public final class JpaFilterConverter {

    private JpaFilterConverter() {
        // Utils only
    }

    /**
     * Converts the given filter specification into a JPA filter specification
     * for the specified entity class.
     * <p>
     * If the filter contains {@link PropertyStringFilter} instances, their
     * properties, or nested property paths, need to match the structure of the
     * entity class. Likewise, their filter values should be in a format that
     * can be parsed into the type that the property is of.
     *
     * @param <T>
     *            the type of the entity
     * @param rawFilter
     *            the filter to convert
     * @param entity
     *            the entity class
     * @return a JPA filter specification for the given filter
     */
    public static <T> Specification<T> toSpec(Filter rawFilter,
            Class<T> entity) {
        if (rawFilter == null) {
            return Specification.anyOf();
        }
        if (rawFilter instanceof AndFilter filter) {
            return Specification.allOf(filter.getChildren().stream()
                    .map(f -> toSpec(f, entity)).toList());
        } else if (rawFilter instanceof OrFilter filter) {
            return Specification.anyOf(filter.getChildren().stream()
                    .map(f -> toSpec(f, entity)).toList());
        } else if (rawFilter instanceof PropertyStringFilter filter) {
            return new PropertyStringFilterSpecification<>(filter);
        } else {
            throw new IllegalArgumentException(
                    "Unknown filter type " + rawFilter.getClass().getName());
        }
    }
}
