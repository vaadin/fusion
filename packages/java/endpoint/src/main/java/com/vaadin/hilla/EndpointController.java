/*
 * Copyright 2000-2024 Vaadin Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */
package com.vaadin.hilla;

import com.vaadin.hilla.signals.handler.SignalsHandler;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.vaadin.flow.internal.CurrentInstance;
import com.vaadin.flow.server.VaadinRequest;
import com.vaadin.flow.server.VaadinService;
import com.vaadin.flow.server.dau.DAUUtils;
import com.vaadin.flow.server.dau.EnforcementNotificationMessages;
import com.vaadin.hilla.EndpointInvocationException.EndpointAccessDeniedException;
import com.vaadin.hilla.EndpointInvocationException.EndpointBadRequestException;
import com.vaadin.hilla.EndpointInvocationException.EndpointInternalException;
import com.vaadin.hilla.EndpointInvocationException.EndpointNotFoundException;
import com.vaadin.hilla.auth.CsrfChecker;
import com.vaadin.hilla.auth.EndpointAccessChecker;
import com.vaadin.hilla.exception.EndpointException;

/**
 * The controller that is responsible for processing Vaadin endpoint requests.
 * Each class that is annotated with {@link Endpoint} or {@link BrowserCallable}
 * gets its public methods exposed so that those can be triggered by a correct
 * POST request, including the methods inherited from the other classes,
 * excluding {@link Object} class ones. Other methods (non-public) are not
 * considered by the controller.
 * <p>
 * For example, if a class with name {@code TestClass} that has the only public
 * method {@code testMethod} was annotated with the annotation, it can be called
 * via {@literal http://${base_url}/testclass/testmethod} POST call, where
 * {@literal ${base_url}} is the application base url, configured by the user.
 * Class name and method name case in the request URL does not matter, but if
 * the method has parameters, the request body should contain a valid JSON with
 * all parameters in the same order as they are declared in the method. The
 * parameter types should also correspond for the request to be successful.
 */
@RestController
@Import({ EndpointControllerConfiguration.class, EndpointProperties.class })
public class EndpointController {
    private static final Logger LOGGER = LoggerFactory
            .getLogger(EndpointController.class);

    static final String ENDPOINT_METHODS = "/{endpoint}/{method}";

    /**
     * A qualifier to override the request and response default json mapper.
     */
    public static final String ENDPOINT_MAPPER_FACTORY_BEAN_QUALIFIER = "endpointMapperFactory";

    private static final Set<Class<?>> INTERNAL_BROWSER_CALLABLES = Set
            .of(SignalsHandler.class);

    private final ApplicationContext context;

    EndpointRegistry endpointRegistry;

    private final CsrfChecker csrfChecker;

    private final EndpointInvoker endpointInvoker;

    VaadinService vaadinService;

    /**
     * A constructor used to initialize the controller.
     *
     * @param context
     *            The Spring application context
     * @param endpointRegistry
     *            the registry used to store endpoint information
     * @param endpointInvoker
     *            then end point invoker
     * @param csrfChecker
     *            the csrf checker to use
     */
    public EndpointController(ApplicationContext context,
            EndpointRegistry endpointRegistry, EndpointInvoker endpointInvoker,
            CsrfChecker csrfChecker) {
        this.context = context;
        this.endpointInvoker = endpointInvoker;
        this.csrfChecker = csrfChecker;
        this.endpointRegistry = endpointRegistry;
    }

    /**
     * Initializes the controller by registering all endpoints found in the
     * OpenApi definition or, as a fallback, in the Spring context.
     */
    public void registerEndpoints() {
        // Spring returns bean names in lower camel case, while Hilla names
        // endpoints in upper camel case, so a case-insensitive map is used to
        // ease searching
        var endpointBeans = new TreeMap<String, Object>(
                String.CASE_INSENSITIVE_ORDER);
        endpointBeans.putAll(context.getBeansWithAnnotation(Endpoint.class));
        endpointBeans
                .putAll(context.getBeansWithAnnotation(BrowserCallable.class));
        if (!endpointBeans.isEmpty()) {
            HillaStats.reportHasEndpoint();
        }

        INTERNAL_BROWSER_CALLABLES.stream().map(context::getBeansOfType)
                .forEach(endpointBeans::putAll);
        var currentEndpointNames = endpointBeans.values().stream()
                .map(endpointRegistry::registerEndpoint)
                .collect(Collectors.toSet());
        // remove obsolete endpoints
        endpointRegistry.getEndpoints().keySet()
                .retainAll(currentEndpointNames);

        // Temporary Hack
        VaadinService vaadinService = VaadinService.getCurrent();
        if (vaadinService != null) {
            this.vaadinService = vaadinService;
        }
    }

    /**
     * Captures and processes the Vaadin endpoint requests.
     * <p>
     * Matches the endpoint name and a method name with the corresponding Java
     * class and a public method in the class. Extracts parameters from a
     * request body if the Java method requires any and applies in the same
     * order. After the method call, serializes the Java method execution result
     * and sends it back.
     * <p>
     * If an issue occurs during the request processing, an error response is
     * returned instead of the serialized Java method return value.
     *
     * @param endpointName
     *            the name of an endpoint to address the calls to, not case
     *            sensitive
     * @param methodName
     *            the method name to execute on an endpoint, not case sensitive
     * @param body
     *            optional request body, that should be specified if the method
     *            called has parameters
     * @param request
     *            the current request which triggers the endpoint call
     * @param response
     *            the current response
     * @return execution result as a JSON string or an error message string
     */
    @PostMapping(path = ENDPOINT_METHODS, produces = MediaType.APPLICATION_JSON_UTF8_VALUE)
    public ResponseEntity<String> serveEndpoint(
            @PathVariable("endpoint") String endpointName,
            @PathVariable("method") String methodName,
            @RequestBody(required = false) ObjectNode body,
            HttpServletRequest request, HttpServletResponse response) {
        return doServeEndpoint(endpointName, methodName, body, request,
                response);
    }

    /**
     * Captures and processes the Vaadin endpoint requests.
     * <p>
     * Matches the endpoint name and a method name with the corresponding Java
     * class and a public method in the class. Extracts parameters from a
     * request body if the Java method requires any and applies in the same
     * order. After the method call, serializes the Java method execution result
     * and sends it back.
     * <p>
     * If an issue occurs during the request processing, an error response is
     * returned instead of the serialized Java method return value.
     *
     * @param endpointName
     *            the name of an endpoint to address the calls to, not case
     *            sensitive
     * @param methodName
     *            the method name to execute on an endpoint, not case sensitive
     * @param body
     *            optional request body, that should be specified if the method
     *            called has parameters
     * @param request
     *            the current request which triggers the endpoint call
     * @return execution result as a JSON string or an error message string
     */
    public ResponseEntity<String> serveEndpoint(String endpointName,
            String methodName, ObjectNode body, HttpServletRequest request) {
        return doServeEndpoint(endpointName, methodName, body, request, null);
    }

    private ResponseEntity<String> doServeEndpoint(String endpointName,
            String methodName, ObjectNode body, HttpServletRequest request,
            HttpServletResponse response) {
        LOGGER.debug("Endpoint: {}, method: {}, request body: {}", endpointName,
                methodName, body);

        if (!csrfChecker.validateCsrfTokenInRequest(request)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(endpointInvoker.createResponseErrorObject(
                            EndpointAccessChecker.ACCESS_DENIED_MSG));
        }

        DAUUtils.EnforcementResult enforcementResult = null;
        try {
            enforcementResult = DAUUtils.trackDAU(this.vaadinService, request,
                    response);
            if (enforcementResult.isEnforcementNeeded()) {
                return buildEnforcementResponseEntity(enforcementResult);
            }
            Object returnValue = endpointInvoker.invoke(endpointName,
                    methodName, body, request.getUserPrincipal(),
                    request::isUserInRole);
            try {
                return ResponseEntity
                        .ok(endpointInvoker.writeValueAsString(returnValue));
            } catch (JsonProcessingException e) {
                String errorMessage = String.format(
                        "Failed to serialize endpoint '%s' method '%s' response. "
                                + "Double check method's return type or specify a custom mapper bean with qualifier '%s'",
                        endpointName, methodName,
                        EndpointController.ENDPOINT_MAPPER_FACTORY_BEAN_QUALIFIER);
                LOGGER.error(errorMessage, e);
                throw new EndpointInternalException(errorMessage);
            }
        } catch (EndpointException e) {
            try {
                return ResponseEntity.badRequest().body(endpointInvoker
                        .createResponseErrorObject(e.getSerializationData()));
            } catch (JsonProcessingException ee) {
                String errorMessage = "Failed to serialize error object for endpoint exception. ";
                LOGGER.error(errorMessage, e);
                return ResponseEntity.internalServerError().body(errorMessage);
            }
        } catch (EndpointNotFoundException e) {
            return ResponseEntity.notFound().build();
        } catch (EndpointAccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                    endpointInvoker.createResponseErrorObject(e.getMessage()));
        } catch (EndpointBadRequestException e) {
            return ResponseEntity.badRequest().body(
                    endpointInvoker.createResponseErrorObject(e.getMessage()));
        } catch (EndpointInternalException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                    endpointInvoker.createResponseErrorObject(e.getMessage()));
        } finally {

            if (enforcementResult != null
                    && enforcementResult.endRequestAction() != null) {
                enforcementResult.endRequestAction().run();
            } else {
                CurrentInstance.set(VaadinRequest.class, null);
            }
        }
    }

    private ResponseEntity<String> buildEnforcementResponseEntity(
            DAUUtils.EnforcementResult enforcementResult) {
        EnforcementNotificationMessages messages = enforcementResult.messages();
        EndpointException endpointException = new EndpointException(
                messages.caption(), enforcementResult.origin(), messages);
        try {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(endpointInvoker.createResponseErrorObject(
                            endpointException.getSerializationData()));
        } catch (JsonProcessingException ee) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(endpointInvoker.createResponseErrorObject(
                            messages.caption() + ". " + messages.message()));
        }
    }

    /**
     * Instantiates an endpoint by its class name. Nothing special here, the
     * main purpose is to allow to instantiate in a lambda expression and log
     * checked exceptions properly.
     *
     * @param className
     *            the name of the class to instantiate
     * @return the instantiated instance or <code>null</code> if the class
     *         cannot be instantiated
     */
    private Object instantiateEndpointByClassName(String className) {
        Class<?> cls;
        try {
            cls = Class.forName(className);
        } catch (ClassNotFoundException e) {
            LOGGER.warn("Endpoint class {} is not available", className, e);
            return null;
        }

        try {
            var endpoint = cls.getDeclaredConstructor().newInstance();
            LOGGER.warn("Endpoint '{}' is not a Spring bean and has been "
                    + "instantiated using default constructor. This is not "
                    + "guaranteed to be supported in future releases.",
                    className);
            return endpoint;
        } catch (ReflectiveOperationException ex) {
            LOGGER.error("Endpoint '{}' is not a Spring bean and cannot be "
                    + "instantiated.", className);
        }

        return null;
    }
}
