package com.vaadin.hilla.crud;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.repository.CrudRepository;
import org.jspecify.annotations.Nullable;

import com.vaadin.hilla.EndpointExposed;

/**
 * A browser-callable service that delegates crud operations to a JPA
 * repository.
 *
 * @deprecated Use {@link com.vaadin.flow.spring.data.jpa.CrudRepositoryService}
 *             instead
 */
@Deprecated(forRemoval = true)
@EndpointExposed
public class CrudRepositoryService<T, ID, R extends CrudRepository<T, ID> & JpaSpecificationExecutor<T>>
        extends ListRepositoryService<T, ID, R> implements CrudService<T, ID> {

    /*
     * Creates the service by autodetecting the type of repository and entity to
     * use from the generics.
     */
    public CrudRepositoryService() {
        super();
    }

    /**
     * Creates the service using the given repository.
     *
     * @param repository
     *            the JPA repository
     */
    public CrudRepositoryService(R repository) {
        super(repository);
    }

    @Override
    public @Nullable T save(T value) {
        return getRepository().save(value);
    }

    /**
     * Saves the given objects and returns the (potentially) updated objects.
     * <p>
     * The returned objects might have new ids or updated consistency versions.
     *
     * @param values
     *            the objects to save
     * @return the fresh objects
     */
    public List<T> saveAll(Iterable<T> values) {
        List<T> saved = new ArrayList<>();
        getRepository().saveAll(values).forEach(saved::add);
        return saved;
    }

    @Override
    public void delete(ID id) {
        getRepository().deleteById(id);
    }

    /**
     * Deletes the objects with the given ids.
     *
     * @param ids
     *            the ids of the objects to delete
     */
    public void deleteAll(Iterable<ID> ids) {
        getRepository().deleteAllById(ids);
    }

}
