package dev.hilla.internal;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

public class EngineConfigurationTest {
    private Path temporaryDirectory;
    private File configFile;

    private EngineConfiguration engineConfiguration = new EngineConfiguration();

    private ObjectMapper objectMapper = new ObjectMapper();
    private static final URL TEST_CONFIG = EngineConfigurationTest.class
            .getResource("hilla-engine-configuration.json");

    @BeforeEach
    public void setUp() throws IOException {
        this.temporaryDirectory = Files
                .createTempDirectory(getClass().getName());
        this.configFile = this.temporaryDirectory
                .resolve(EngineConfiguration.RESOURCE_NAME).toFile();

        this.engineConfiguration.setBaseDir(Path.of("base"));
        this.engineConfiguration.setBuildDir("build");
        this.engineConfiguration.setClassPath(
                new LinkedHashSet<>(List.of("build/classes", "dependency")));
        var parserConfiguration = new ParserConfiguration();
        parserConfiguration.setEndpointAnnotation("dev.hilla.test.Endpoint");
        parserConfiguration
                .setEndpointExposedAnnotation("dev.hilla.test.EndpointExposed");
        parserConfiguration.setClassPath(new ParserClassPathConfiguration());
        parserConfiguration.setPlugins(new ParserConfiguration.Plugins(
                List.of(new ParserConfiguration.Plugin(
                        "parser-jvm-plugin-use")),
                List.of(new ParserConfiguration.Plugin(
                        "parser-jvm-plugin-disable"))));
        parserConfiguration.setOpenAPIPath("test-openapi.json");
        this.engineConfiguration.setParser(parserConfiguration);

        var generatorConfiguration = new GeneratorConfiguration();
        this.engineConfiguration.setGenerator(generatorConfiguration);
    }

    @AfterEach
    public void tearDown() {
        if (this.configFile.exists()) {
            this.configFile.delete();
        }
        this.temporaryDirectory.toFile().delete();
    }

    @Test
    public void should_SerializeToJsonFile() throws IOException {
        engineConfiguration.store(temporaryDirectory.toFile());

        var storedConfig = (ObjectNode) objectMapper.readTree(configFile);
        // baseDir gets stored as absolute URI, relativize for comparison
        var storedBaseDir = Path
                .of(URI.create(storedConfig.get("baseDir").asText()));
        var relativeBaseDir = Path.of(".").toAbsolutePath()
                .relativize(storedBaseDir);
        storedConfig.set("baseDir", new TextNode(relativeBaseDir.toString()));
        var expectedConfig = objectMapper.readTree(TEST_CONFIG);

        assertEquals(expectedConfig.toPrettyString(),
                storedConfig.toPrettyString());
    }

    @Test
    public void should_DeserializeFromJsonFile()
            throws IOException, URISyntaxException {
        Files.copy(Path.of(TEST_CONFIG.toURI()), configFile.toPath());

        var loadedConfig = EngineConfiguration
                .load(temporaryDirectory.toFile());

        assertNotNull(loadedConfig);
        assertEquals(engineConfiguration, loadedConfig);
    }
}
