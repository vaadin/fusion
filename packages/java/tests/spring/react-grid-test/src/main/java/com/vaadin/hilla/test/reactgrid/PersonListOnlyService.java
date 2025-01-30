package com.vaadin.hilla.test.reactgrid;

import com.vaadin.flow.server.auth.AnonymousAllowed;
import com.vaadin.flow.spring.data.jpa.ListRepositoryService;
import com.vaadin.hilla.BrowserCallable;

@BrowserCallable
@AnonymousAllowed
public class PersonListOnlyService
        extends ListRepositoryService<Person, Long, PersonRepository> {

    PersonListOnlyService(PersonRepository repository) {
        super(repository);
    }

}
