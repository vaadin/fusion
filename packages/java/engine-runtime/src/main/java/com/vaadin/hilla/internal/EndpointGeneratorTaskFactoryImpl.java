/*
 * Copyright 2000-2022 Vaadin Ltd.
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
package com.vaadin.hilla.internal;

import java.lang.annotation.Annotation;
import java.util.HashSet;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.vaadin.flow.server.frontend.EndpointGeneratorTaskFactory;
import com.vaadin.flow.server.frontend.FrontendTools;
import com.vaadin.flow.server.frontend.FrontendToolsSettings;
import com.vaadin.flow.server.frontend.FrontendUtils;
import com.vaadin.flow.server.frontend.Options;
import com.vaadin.flow.server.frontend.TaskGenerateEndpoint;
import com.vaadin.flow.server.frontend.TaskGenerateOpenAPI;
import com.vaadin.flow.server.frontend.scanner.ClassFinder;
import com.vaadin.hilla.BrowserCallable;
import com.vaadin.hilla.Endpoint;
import com.vaadin.hilla.EndpointExposed;
import com.vaadin.hilla.engine.EngineConfiguration;
import com.vaadin.hilla.engine.ParserProcessor;
import com.vaadin.hilla.signals.handler.SignalsHandler;

/**
 * An implementation of the EndpointGeneratorTaskFactory, which creates endpoint
 * generator tasks.
 */
public class EndpointGeneratorTaskFactoryImpl
        implements EndpointGeneratorTaskFactory {
    private static final Logger LOGGER = LoggerFactory
            .getLogger(ParserProcessor.class);

    private static FrontendTools buildTools(Options options) {
        var settings = new FrontendToolsSettings(
                options.getNpmFolder().getAbsolutePath(),
                () -> FrontendUtils.getVaadinHomeDirectory().getAbsolutePath());
        settings.setNodeDownloadRoot(options.getNodeDownloadRoot());
        settings.setForceAlternativeNode(options.isRequireHomeNodeExec());
        settings.setUseGlobalPnpm(options.isUseGlobalPnpm());
        settings.setAutoUpdate(options.isNodeAutoUpdate());
        settings.setNodeVersion(options.getNodeVersion());

        return new FrontendTools(settings);
    }

    @Override
    public TaskGenerateEndpoint createTaskGenerateEndpoint(Options options) {
        if (!options.isRunNpmInstall() && !options.isDevBundleBuild()
                && !options.isProductionMode()) {
            // Skip for prepare-frontend phase and in production server
            return new SkipTaskGenerateEndpoint();
        }

        var engineConfiguration = configureFromOptions(options);
        return new TaskGenerateEndpointImpl(engineConfiguration);
    }

    @Override
    public TaskGenerateOpenAPI createTaskGenerateOpenAPI(Options options) {
        if (!options.isRunNpmInstall() && !options.isDevBundleBuild()
                && !options.isProductionMode()) {
            // Skip for prepare-frontend phase and in production server
            return new SkipTaskGenerateOpenAPI();
        }

        var engineConfiguration = configureFromOptions(options);
        return new TaskGenerateOpenAPIImpl(engineConfiguration);
    }

    @Override
    public Set<Class<? extends Annotation>> getBrowserCallableAnnotations() {
        Set<Class<? extends Annotation>> classes = new HashSet<>();
        classes.add(BrowserCallable.class);
        classes.add(Endpoint.class);
        classes.add(EndpointExposed.class);
        return classes;
    }

    @Override
    public boolean hasBrowserCallables(Options options) {
        Set<Class<?>> foundClasses = new HashSet<>();
        ClassFinder classFinder = options.getClassFinder();
        getBrowserCallableAnnotations().forEach(annotation -> {
            foundClasses.addAll(classFinder.getAnnotatedClasses(annotation));
        });
        foundClasses.remove(SignalsHandler.class);
        return !foundClasses.isEmpty();
    }

    private static class SkipTaskGenerateEndpoint
            implements TaskGenerateEndpoint {
        @Override
        public void execute() {
            LOGGER.debug("Skipping generating TypeScript endpoints");
        }
    }

    private static class SkipTaskGenerateOpenAPI
            implements TaskGenerateOpenAPI {
        @Override
        public void execute() {
            LOGGER.debug("Skipping generating OpenAPI spec");
        }
    }

    private static EngineConfiguration configureFromOptions(Options options) {
        return new EngineConfiguration.Builder()
                .baseDir(options.getNpmFolder().toPath())
                .buildDir(options.getBuildDirectoryName())
                .outputDir(options.getFrontendGeneratedFolder().toPath())
                .nodeCommand(buildTools(options).getNodeExecutable())
                .productionMode(options.isProductionMode())
                .withDefaultAnnotations().build();
    }
}
