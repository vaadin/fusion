package dev.hilla.parser.plugins.backbone.jackson;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Set;

import org.junit.jupiter.api.Test;

import dev.hilla.parser.core.Parser;
import dev.hilla.parser.plugins.backbone.BackbonePlugin;
import dev.hilla.parser.plugins.backbone.test.helpers.TestHelper;

public class JacksonTest {
    private final TestHelper helper = new TestHelper(getClass());

    @Test
    public void should_CorrectlyIgnoreFieldsBasedOnJSONAnnotations()
            throws IOException, URISyntaxException {
        var openAPI = new Parser()
                .classLoader(ClassLoader.getSystemClassLoader())
                .classPath(Set.of(helper.getTargetDir().toString()))
                .endpointAnnotation(Endpoint.class.getName())
                .addPlugin(new BackbonePlugin()).execute();

        helper.executeParserWithConfig(openAPI);
    }
}
