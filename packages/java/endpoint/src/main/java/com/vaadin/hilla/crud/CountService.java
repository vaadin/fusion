package com.vaadin.hilla.crud;

import com.vaadin.hilla.crud.filter.Filter;

import org.jspecify.annotations.Nullable;

/**
 * A browser-callable service that can count the given type of objects with a
 * given filter.
 *
 * @deprecated Use {@link com.vaadin.flow.spring.data.CountService} instead
 */
@Deprecated(forRemoval = true)
public interface CountService {

    /**
     * Counts the number of entities that match the given filter.
     *
     * @param filter
     *            the filter, or {@code null} to use no filter
     * @return
     */
    public long count(@Nullable Filter filter);

}
