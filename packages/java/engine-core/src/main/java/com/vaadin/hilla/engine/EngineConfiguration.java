package com.vaadin.hilla.engine;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import com.vaadin.flow.server.ExecutionFailedException;
import com.vaadin.flow.server.frontend.FrontendUtils;

public class EngineConfiguration {
    private static EngineConfiguration INSTANCE;

    public static final String OPEN_API_PATH = "hilla-openapi.json";
    private Set<Path> classpath = Arrays
            .stream(System.getProperty("java.class.path")
                    .split(File.pathSeparator))
            .map(Path::of).collect(Collectors.toSet());
    private String groupId;
    private String artifactId;
    private String mainClass;
    private Path buildDir;
    private Path baseDir;
    private Path classesDir;
    private GeneratorConfiguration generator;
    private Path outputDir;
    private ParserConfiguration parser;
    private EndpointProvider offlineEndpointProvider;
    private boolean productionMode = false;
    private String nodeCommand = "node";

    private EngineConfiguration() {
        baseDir = Path.of(System.getProperty("user.dir"));
        buildDir = baseDir.resolve("target");
        generator = new GeneratorConfiguration();
        parser = new ParserConfiguration();

        var legacyFrontendGeneratedDir = baseDir.resolve("frontend/generated");
        if (Files.exists(legacyFrontendGeneratedDir)) {
            outputDir = legacyFrontendGeneratedDir;
        } else {
            outputDir = baseDir.resolve(
                    FrontendUtils.DEFAULT_PROJECT_FRONTEND_GENERATED_DIR);
        }
    }

    public Set<Path> getClasspath() {
        return classpath;
    }

    public String getGroupId() {
        return groupId;
    }

    public String getArtifactId() {
        return artifactId;
    }

    public String getMainClass() {
        return mainClass;
    }

    public Path getBuildDir() {
        return buildDir;
    }

    public Path getBaseDir() {
        return baseDir;
    }

    public Path getClassesDir() {
        return classesDir == null ? buildDir.resolve("classes") : classesDir;
    }

    public GeneratorConfiguration getGenerator() {
        return generator;
    }

    public Path getOutputDir() {
        return outputDir;
    }

    public ParserConfiguration getParser() {
        return parser;
    }

    public boolean isProductionMode() {
        return productionMode;
    }

    public String getNodeCommand() {
        return nodeCommand;
    }

    public Path getOpenAPIFile() {
        return productionMode
                ? buildDir.resolve("classes").resolve(OPEN_API_PATH)
                : buildDir.resolve(OPEN_API_PATH);
    }

    public EndpointProvider getOfflineEndpointProvider() {
        if (offlineEndpointProvider != null) {
            return offlineEndpointProvider;
        }

        return () -> {
            try {
                return new AotEndpointProvider(this).findEndpointClasses();
            } catch (IOException | InterruptedException e) {
                throw new ExecutionFailedException(e);
            }
        };
    }

    public static EngineConfiguration getDefault() {
        if (INSTANCE == null) {
            INSTANCE = new EngineConfiguration();
        }

        return INSTANCE;
    }

    public static void setDefault(EngineConfiguration config) {
        INSTANCE = config;
    }

    public static final class Builder {
        private final EngineConfiguration configuration = new EngineConfiguration();

        public Builder() {
            this(getDefault());
        }

        public Builder(EngineConfiguration configuration) {
            this.configuration.baseDir = configuration.baseDir;
            this.configuration.buildDir = configuration.buildDir;
            this.configuration.classpath = configuration.classpath;
            this.configuration.generator = configuration.generator;
            this.configuration.parser = configuration.parser;
            this.configuration.outputDir = configuration.outputDir;
            this.configuration.groupId = configuration.groupId;
            this.configuration.artifactId = configuration.artifactId;
            this.configuration.mainClass = configuration.mainClass;
            this.configuration.offlineEndpointProvider = configuration.offlineEndpointProvider;
            this.configuration.productionMode = configuration.productionMode;
            this.configuration.nodeCommand = configuration.nodeCommand;
        }

        public Builder baseDir(Path value) {
            configuration.baseDir = value;
            return this;
        }

        public Builder buildDir(String value) {
            return buildDir(Path.of(value));
        }

        public Builder buildDir(Path value) {
            configuration.buildDir = resolve(value);
            return this;
        }

        public Builder classesDir(Path value) {
            configuration.classesDir = resolve(value);
            return this;
        }

        public Builder classpath(Collection<String> value) {
            configuration.classpath = value.stream().map(Path::of)
                    .map(this::resolve).collect(Collectors.toSet());
            return this;
        }

        public EngineConfiguration create() {
            return configuration;
        }

        public Builder generator(GeneratorConfiguration value) {
            configuration.generator = value;
            return this;
        }

        public Builder outputDir(String value) {
            return outputDir(Path.of(value));
        }

        public Builder outputDir(Path value) {
            configuration.outputDir = resolve(value);
            return this;
        }

        public Builder parser(ParserConfiguration value) {
            configuration.parser = value;
            return this;
        }

        public Builder groupId(String value) {
            configuration.groupId = value;
            return this;
        }

        public Builder artifactId(String value) {
            configuration.artifactId = value;
            return this;
        }

        public Builder mainClass(String value) {
            configuration.mainClass = value;
            return this;
        }

        public Builder offlineEndpointProvider(EndpointProvider value) {
            configuration.offlineEndpointProvider = value;
            return this;
        }

        public Builder productionMode(boolean value) {
            configuration.productionMode = value;
            return this;
        }

        public Builder nodeCommand(String value) {
            configuration.nodeCommand = value;
            return this;
        }

        private Path resolve(Path path) {
            return path.isAbsolute() ? path.normalize()
                    : configuration.baseDir.resolve(path).normalize();
        }
    }

    @FunctionalInterface
    public interface EndpointProvider {
        List<Class<?>> findEndpoints() throws ExecutionFailedException;
    }
}
