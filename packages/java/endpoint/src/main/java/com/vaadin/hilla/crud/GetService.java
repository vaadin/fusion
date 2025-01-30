package com.vaadin.hilla.crud;

import java.util.Optional;

/**
 * A browser-callable service that can fetch the given type of object.
 *
 * @deprecated Use {@link com.vaadin.flow.spring.data.GetService} instead
 */
@Deprecated(forRemoval = true)
public interface GetService<T, ID> {

    /**
     * Gets the object with the given id.
     *
     * @param id
     *            the id of the object
     * @return the object, or an empty optional if no object with the given id
     */
    Optional<T> get(ID id);

    /**
     * Checks if an object with the given id exists.
     *
     * @param id
     *            the id of the object
     * @return {@code true} if the object exists, {@code false} otherwise
     */
    default boolean exists(ID id) {
        return get(id).isPresent();
    }

}
