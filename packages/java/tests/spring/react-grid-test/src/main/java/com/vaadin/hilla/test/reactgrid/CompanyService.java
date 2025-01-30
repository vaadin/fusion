package com.vaadin.hilla.test.reactgrid;

import com.vaadin.flow.server.auth.AnonymousAllowed;
import com.vaadin.flow.spring.data.jpa.CrudRepositoryService;
import com.vaadin.hilla.BrowserCallable;

@BrowserCallable
@AnonymousAllowed
public class CompanyService
        extends CrudRepositoryService<Company, Long, CompanyRepository> {
    CompanyService(CompanyRepository repository) {
        super(repository);
    }
}
