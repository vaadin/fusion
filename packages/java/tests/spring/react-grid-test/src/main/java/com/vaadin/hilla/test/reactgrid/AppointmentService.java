package com.vaadin.hilla.test.reactgrid;

import org.checkerframework.checker.units.qual.A;
import org.springframework.stereotype.Service;

import com.vaadin.flow.server.auth.AnonymousAllowed;
import com.vaadin.flow.spring.data.jpa.CrudRepositoryService;
import com.vaadin.hilla.BrowserCallable;

@BrowserCallable
@Service
@AnonymousAllowed
public class AppointmentService extends
        CrudRepositoryService<Appointment, Long, AppointmentRepository> {
    AppointmentService(AppointmentRepository repository) {
        super(repository);
    }
}
