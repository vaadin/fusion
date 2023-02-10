package dev.hilla.internal;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import com.fasterxml.jackson.databind.ObjectMapper;

public class EngineConfiguration {
    public static final String RESOURCE_NAME = "hilla-engine-configuration.json";
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .setVisibility(PropertyAccessor.ALL, JsonAutoDetect.Visibility.NONE)
            .setVisibility(PropertyAccessor.FIELD,
                    JsonAutoDetect.Visibility.ANY);

    private Path baseDir;
    private LinkedHashSet<String> classPath;
    private GeneratorConfiguration generator;
    private ParserConfiguration parser;
    private String buildDir;

    public static EngineConfiguration load(File targetDir) throws IOException {
        File configFile = new File(targetDir, RESOURCE_NAME);

        if (!configFile.isFile()) {
            return null;
        }

        // The Maven configuration can change, so it is preferable to get a new
        // one each time the project is run
        configFile.deleteOnExit();

        return MAPPER.readValue(configFile, EngineConfiguration.class);
    }

    public void store(File targetDir) throws IOException {
        MAPPER.writeValue(new File(targetDir, RESOURCE_NAME), this);
    }

    public Path getBaseDir() {
        return baseDir;
    }

    public void setBaseDir(Path baseDir) {
        this.baseDir = baseDir;
    }

    public LinkedHashSet<String> getClassPath() {
        return classPath;
    }

    public void setClassPath(LinkedHashSet<String> classPath) {
        this.classPath = classPath;
    }

    public GeneratorConfiguration getGenerator() {
        return generator;
    }

    public void setGenerator(GeneratorConfiguration generator) {
        this.generator = generator;
    }

    public ParserConfiguration getParser() {
        return parser;
    }

    public void setParser(ParserConfiguration parser) {
        this.parser = parser;
    }

    public String getBuildDir() {
        return buildDir;
    }

    public void setBuildDir(String buildDir) {
        this.buildDir = buildDir;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        EngineConfiguration that = (EngineConfiguration) o;
        return Objects.equals(baseDir, that.baseDir)
                && Objects.equals(classPath, that.classPath)
                && Objects.equals(generator, that.generator)
                && Objects.equals(parser, that.parser)
                && Objects.equals(buildDir, that.buildDir);
    }

    @Override
    public int hashCode() {
        return Objects.hash(baseDir, classPath, generator, parser, buildDir);
    }
}
