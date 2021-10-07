package com.vaadin.fusion.parser;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.io.File;
import java.net.URISyntaxException;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.Collections;
import java.util.Objects;

import org.junit.jupiter.api.Test;

public class ParserConfigTests {
    @Test
    public void should_parseJSONConfigFile() throws URISyntaxException {
        ParserConfig config = ParserConfig
                .parse(findResource("json-test.config.json"));

        assertConfig(config);
    }

    @Test
    public void should_parseYAMLConfigFile() throws URISyntaxException {
        ParserConfig config = ParserConfig
                .parse(findResource("yaml-test.config.yml"));

        assertConfig(config);
    }

    @Test
    public void should_parseEmptyConfigFile() throws URISyntaxException {
        ParserConfig config = ParserConfig
            .parse(findResource("absent-elements.config.json"));

        assertEquals("/path/to/bytecode", config.getClassPath().get());
        assertEquals("com.vaadin.fusion.Endpoint", config.getEndpointAnnotation());
        assertEquals(Collections.emptyList(), config.getDisable());
        assertEquals(Collections.emptyList(), config.getPlugins());
    }

    private void assertConfig(ParserConfig config) {
        assertFalse(config.getClassPath().isPresent());
        assertEquals("com.vaadin.fusion.Endpoint",
                config.getEndpointAnnotation());
        assertEquals(Collections.singletonList("generate-openapi"),
                config.getDisable());
        assertEquals(
                Arrays.asList("com.vaadin.fusion.parser.BasicPlugin",
                        "com.vaadin.fusion.parser.DependencyPlugin"),
                config.getPlugins());
    }

    private File findResource(String resourceName) throws URISyntaxException {
        return Paths.get(Objects
                .requireNonNull(getClass().getResource(resourceName)).toURI())
                .toFile();
    }
}
