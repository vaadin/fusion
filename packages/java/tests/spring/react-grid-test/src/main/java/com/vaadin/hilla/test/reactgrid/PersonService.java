package com.vaadin.hilla.test.reactgrid;

import com.vaadin.flow.server.auth.AnonymousAllowed;
import com.vaadin.flow.spring.data.jpa.CrudRepositoryService;
import com.vaadin.hilla.BrowserCallable;

@BrowserCallable
@AnonymousAllowed
public class PersonService
        extends CrudRepositoryService<Person, Long, PersonRepository> {

    PersonService(PersonRepository repository) {
        super(repository);
    }
}
