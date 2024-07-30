package com.vaadin.hilla.parser.plugins.backbone.exposed;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.vaadin.hilla.parser.core.Parser;
import com.vaadin.hilla.parser.plugins.backbone.BackbonePlugin;
import com.vaadin.hilla.parser.plugins.backbone.test.helpers.TestHelper;

public class ExposedTest {
    private final TestHelper helper = new TestHelper(getClass());

    @Test
    public void should_CorrectlyHandleEndpointExposedAnnotation()
            throws IOException, URISyntaxException {
        var openAPI = new Parser().classLoader(getClass().getClassLoader())
                .classPath(Set.of(helper.getTargetDir().toString()))
                .endpointAnnotations(List.of(Endpoint.class.getName()))
                .endpointExposedAnnotations(
                        List.of(EndpointExposed.class.getName()))
                .addPlugin(new BackbonePlugin())
                .execute(List.of(ExposedEndpoint.class));

        helper.executeParserWithConfig(openAPI);
    }
}
