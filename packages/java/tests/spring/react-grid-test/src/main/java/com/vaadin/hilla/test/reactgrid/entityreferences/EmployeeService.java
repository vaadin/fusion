package com.vaadin.hilla.test.reactgrid.entityreferences;

import com.vaadin.flow.server.auth.AnonymousAllowed;
import com.vaadin.flow.spring.data.jpa.ListRepositoryService;
import com.vaadin.hilla.BrowserCallable;

@BrowserCallable
@AnonymousAllowed
public class EmployeeService
        extends ListRepositoryService<Employee, Long, EmployeeRepository> {

    public EmployeeService(EmployeeRepository repository) {
        super(repository);
    }

}
