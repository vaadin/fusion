package com.example.application;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import org.junit.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class InternalEndpointIT {
    Path frontedDir = Path.of("src", "main", "frontend");
    Path generatedDir = frontedDir.resolve("generated");

    @Test
    public void shouldNotRunEndpointGeneratorForOnlyInternalEndpointsPresent() {
        assertTrue(Files.exists(frontedDir.resolve("index.html")),
                "Expected the frontend directory to have the index.html file");
        assertFalse(Files.exists(generatedDir.resolve("endpoints.ts")),
                "Expected the endpoints.ts file to not be generated");
        assertFalse(
                Files.exists(generatedDir
                        .resolve(Path.of("com", "vaadin", "hilla"))),
                "Expected the Hilla directory to not be generated");
    }

}
