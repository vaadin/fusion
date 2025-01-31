package com.vaadin.hilla.engine;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import com.vaadin.hilla.parser.core.OpenAPIFileType;
import io.swagger.v3.oas.models.OpenAPI;
import org.jspecify.annotations.NonNull;

import com.vaadin.hilla.engine.commandrunner.CommandNotFoundException;
import com.vaadin.hilla.engine.commandrunner.CommandRunnerException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class GeneratorProcessor {
    public static String GENERATED_FILE_LIST_NAME = "generated-file-list.txt";

    private static final Logger logger = LoggerFactory
            .getLogger(GeneratorProcessor.class);

    private static final Path TSGEN_PATH = Paths.get("node_modules", "@vaadin",
            "hilla-generator-cli", "bin", "index.js");
    private final Path baseDir;
    private final String nodeCommand;
    private final Path openAPIFile;
    private final Path outputDirectory;
    private final GeneratorConfiguration.PluginsProcessor pluginsProcessor = new GeneratorConfiguration.PluginsProcessor();

    public GeneratorProcessor(EngineConfiguration conf) {
        this.baseDir = conf.getBaseDir();
        this.openAPIFile = conf.getOpenAPIFile();
        this.outputDirectory = conf.getOutputDir();
        this.nodeCommand = conf.getNodeCommand();
        applyConfiguration(conf.getGenerator());
    }

    public void process() throws GeneratorException {
        if (isOpenAPIEmpty()) {
            cleanup();
            return;
        }

        var arguments = new ArrayList<Object>();
        arguments.add(TSGEN_PATH);
        prepareOutputDir(arguments);
        preparePlugins(arguments);
        prepareVerbose(arguments);

        try {
            var runner = new GeneratorShellRunner(baseDir.toFile(), nodeCommand,
                    arguments.stream().map(Objects::toString)
                            .toArray(String[]::new));
            runner.run((stdIn) -> {
                try {
                    Files.copy(openAPIFile, stdIn);
                } catch (IOException e) {
                    throw new LambdaException(e);
                }
            });
        } catch (LambdaException e) {
            throw new GeneratorException("Node execution failed", e.getCause());
        } catch (CommandNotFoundException e) {
            throw new GeneratorException("Node command not found", e);
        } catch (CommandRunnerException e) {
            throw new GeneratorException("Node execution failed", e);
        }
    }

    private void cleanup() throws GeneratorException {
        var generatedFilesListFile = outputDirectory
                .resolve(GENERATED_FILE_LIST_NAME);
        if (!generatedFilesListFile.toFile().exists()) {
            logger.debug(
                    "Generated file list file does not exist, skipping cleanup.");
            return;
        }

        logger.debug("Cleaning up old output.");
        var generatedFilesList = List.<String> of();
        try {
            generatedFilesList = Files.readAllLines(generatedFilesListFile);
        } catch (IOException e) {
            throw new GeneratorException(
                    "Unable to read generated file list file", e);
        }

        try {
            for (var line : generatedFilesList) {
                var path = outputDirectory.resolve(line);
                logger.debug("Removing generated file: {}", path);
                Files.deleteIfExists(path);
                // Also remove any empty parent directories
                var dir = path.getParent();
                while (dir.startsWith(outputDirectory)
                        && !dir.equals(outputDirectory)
                        && Files.isDirectory(dir) && Objects.requireNonNull(
                                dir.toFile().list()).length == 0) {
                    logger.debug("Removing unused generated directory: {}",
                            dir);
                    Files.deleteIfExists(dir);
                }
            }
        } catch (IOException e) {
            throw new GeneratorException("Unable to cleanup generated files",
                    e);
        }

        try {
            Files.deleteIfExists(generatedFilesListFile);
        } catch (IOException e) {
            throw new GeneratorException(
                    "Unable to remove the generated file list file", e);
        }
    }

    // Used to catch a checked exception in a lambda and handle it after
    private static class LambdaException extends RuntimeException {
        public LambdaException(Throwable cause) {
            super(cause);
        }
    }

    private GeneratorProcessor applyConfiguration(
            GeneratorConfiguration generatorConfiguration) {
        if (generatorConfiguration == null) {
            return this;
        }

        generatorConfiguration.getPlugins().ifPresent(this::applyPlugins);
        return this;
    }

    private void applyPlugins(GeneratorConfiguration.@NonNull Plugins plugins) {
        pluginsProcessor.setConfig(plugins);
    }

    private void prepareOutputDir(List<Object> arguments) {
        var result = outputDirectory.isAbsolute() ? outputDirectory
                : baseDir.resolve(outputDirectory);
        arguments.add("-o");
        arguments.add(result);
    }

    private void preparePlugins(List<Object> arguments) {
        pluginsProcessor.process().stream()
                .map(GeneratorConfiguration.Plugin::getPath).distinct()
                .forEachOrdered(path -> {
                    arguments.add("-p");
                    arguments.add(path);
                });
    }

    private void prepareVerbose(List<Object> arguments) {
        if (logger.isDebugEnabled()) {
            arguments.add("-v");
        }
    }

    private OpenAPI getOpenAPI() throws IOException {
        String source = Files.readString(openAPIFile);
        var mapper = OpenAPIFileType.JSON.getMapper();
        var reader = mapper.reader();
        return reader.readValue(source, OpenAPI.class);
    }

    private boolean isOpenAPIEmpty() {
        try {
            var openApi = getOpenAPI();
            return (openApi.getPaths() == null || openApi.getPaths().isEmpty())
                    && (openApi.getComponents() == null
                            || openApi.getComponents().getSchemas() == null
                            || openApi.getComponents().getSchemas().isEmpty());
        } catch (IOException e) {
            throw new GeneratorException("Unable to read OpenAPI json file", e);
        }
    }
}
