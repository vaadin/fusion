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
package dev.hilla.internal;

import java.io.File;
import java.io.IOException;
import java.util.Objects;

import dev.hilla.engine.ConfigurationException;
import dev.hilla.engine.EngineConfiguration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.vaadin.flow.server.ExecutionFailedException;
import com.vaadin.flow.server.frontend.FallibleCommand;

import dev.hilla.internal.runner.GradleRunner;
import dev.hilla.internal.runner.MavenRunner;
import dev.hilla.internal.runner.RunnerException;

/**
 * Abstract class for endpoint related generators.
 */
abstract class AbstractTaskEndpointGenerator implements FallibleCommand {
    private final File projectDirectory;
    private final String buildDirectoryName;
    private final File outputDirectory;
    private EngineConfiguration engineConfiguration;

    private final Logger logger = LoggerFactory.getLogger(getClass());

    AbstractTaskEndpointGenerator(File projectDirectory,
            String buildDirectoryName, File outputDirectory) {
        this.projectDirectory = Objects.requireNonNull(projectDirectory,
                "Project directory cannot be null");
        this.buildDirectoryName = Objects.requireNonNull(buildDirectoryName,
                "Build directory name cannot be null");
        this.outputDirectory = Objects.requireNonNull(outputDirectory,
                "Output direrctory name cannot be null");
    }

    protected EngineConfiguration getEngineConfiguration()
            throws ExecutionFailedException {
        if (engineConfiguration == null) {
            prepareEngineConfiguration();
        }

        return engineConfiguration;
    }

    protected void prepareEngineConfiguration()
            throws ExecutionFailedException {
        EngineConfiguration config = null;

        var buildDir = new File(projectDirectory, buildDirectoryName);
        try {
            config = EngineConfiguration.load(buildDir);
        } catch (IOException | ConfigurationException e) {
            logger.warn(
                    "Hilla engine configuration found, but not read correctly",
                    e);
        }

        if (config == null) {
            logger.info(
                    "Hilla engine configuration not found: configure using build system plugin");

            try {
                MavenRunner
                        .forProject(projectDirectory.toPath(), "-q",
                                "hilla:configure")
                        .or(() -> GradleRunner
                                .forProject(projectDirectory.toPath()))
                        .orElseThrow(() -> new IllegalStateException(String
                                .format("Failed to determine project directory for dev mode. "
                                        + "Directory '%s' does not look like a Maven or "
                                        + "Gradle project.", projectDirectory)))
                        .run();
            } catch (RunnerException e) {
                throw new ExecutionFailedException(
                        "Failed to configure Hilla engine", e);
            }

            try {
                config = EngineConfiguration.load(buildDir);
            } catch (IOException e) {
                throw new ExecutionFailedException(
                        "Failed to read Hilla engine configuration", e);
            }
        }

        if (config != null) {
            config.setOutputDir(outputDirectory.toPath());
        }

        this.engineConfiguration = config;
    }
}
