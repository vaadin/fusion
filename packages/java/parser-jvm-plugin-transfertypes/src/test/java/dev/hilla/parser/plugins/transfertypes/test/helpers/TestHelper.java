package dev.hilla.parser.plugins.transfertypes.test.helpers;

import static dev.hilla.parser.testutils.OpenAPIAssertions.assertEquals;

import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.stream.Collectors;

import com.fasterxml.jackson.databind.ObjectMapper;

import dev.hilla.parser.core.Parser;
import dev.hilla.parser.core.ParserConfig;
import dev.hilla.parser.testutils.ResourceLoader;
import io.swagger.v3.core.util.Json;
import io.swagger.v3.oas.models.OpenAPI;

public final class TestHelper {
    private final ObjectMapper mapper = Json.mapper();
    private final ResourceLoader resourceLoader;
    private final Path targetDir;

    public TestHelper(Class cls) {
        resourceLoader = createResourceLoader(cls);

        try {
            targetDir = resourceLoader.findTargetDirPath();
        } catch (URISyntaxException e) {
            throw new RuntimeException(e);
        }
    }

    private static ResourceLoader createResourceLoader(Class<?> target) {
        return new ResourceLoader(target::getResource,
                target::getProtectionDomain);
    }

    public Path getTargetDir() {
        return targetDir;
    }

    public void executeParserWithConfig(ParserConfig config)
            throws IOException, URISyntaxException {
        var parser = new Parser(config);
        parser.execute();

        var expected = mapper.readValue(resourceLoader.find("openapi.json"),
                OpenAPI.class);
        var actual = parser.getStorage().getOpenAPI();

        assertEquals(expected, actual);
    }

    public String getExtendedClassPath(Class<?>... classes)
            throws URISyntaxException {
        return ResourceLoader.getClasspath(
                Arrays.stream(classes).map(TestHelper::createResourceLoader)
                        .collect(Collectors.toList()));
    }
}
