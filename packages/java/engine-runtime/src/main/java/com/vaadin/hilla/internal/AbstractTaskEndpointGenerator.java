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

import java.io.File;
import java.io.InputStream;
import java.io.IOException;
import java.net.URL;
import java.util.Arrays;
import java.util.Objects;
import java.util.Optional;
import java.util.Properties;
import java.util.function.Function;
import java.util.stream.Stream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.vaadin.flow.server.ExecutionFailedException;
import com.vaadin.flow.server.frontend.FallibleCommand;

import com.vaadin.hilla.engine.ConfigurationException;
import com.vaadin.hilla.engine.EngineConfiguration;
import com.vaadin.hilla.engine.commandrunner.GradleRunner;
import com.vaadin.hilla.engine.commandrunner.MavenRunner;
import com.vaadin.hilla.engine.commandrunner.CommandRunnerException;

/**
 * Abstract class for endpoint related generators.
 */
abstract class AbstractTaskEndpointGenerator implements FallibleCommand {
    private static final Logger LOGGER = LoggerFactory
            .getLogger(AbstractTaskEndpointGenerator.class);
    private static boolean firstRun = true;

    private final String buildDirectoryName;
    private final Logger logger = LoggerFactory.getLogger(getClass());
    protected final File outputDirectory;
    private final File projectDirectory;
    private final Function<String, URL> resourceFinder;
    private EngineConfiguration engineConfiguration;

    AbstractTaskEndpointGenerator(File projectDirectory,
            String buildDirectoryName, File outputDirectory,
            Function<String, URL> resourceFinder) {
        this.projectDirectory = Objects.requireNonNull(projectDirectory,
                "Project directory cannot be null");
        this.buildDirectoryName = Objects.requireNonNull(buildDirectoryName,
                "Build directory name cannot be null");
        this.outputDirectory = Objects.requireNonNull(outputDirectory,
                "Output directory name cannot be null");
        this.resourceFinder = Objects.requireNonNull(resourceFinder,
                "Class finder cannot be null");
    }
}
