package com.vaadin.hilla.parser.plugins.transfertypes.file;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.vaadin.hilla.parser.core.Parser;
import com.vaadin.hilla.parser.plugins.backbone.BackbonePlugin;
import com.vaadin.hilla.parser.plugins.transfertypes.TransferTypesPlugin;
import com.vaadin.hilla.parser.plugins.transfertypes.test.helpers.TestHelper;

public class MultipartFileTest {
    private final TestHelper helper = new TestHelper(getClass());

    @Test
    public void should_ReplaceMultipartFileClassWithLocalFileClass()
        throws IOException, URISyntaxException {
        var openAPI = new Parser()
            .classPath(Set.of(helper.getTargetDir().toString()))
            .endpointAnnotations(List.of(Endpoint.class))
            .addPlugin(new BackbonePlugin())
            .addPlugin(new TransferTypesPlugin())
            .execute(List.of(MultipartFileEndpoint.class));

        helper.executeParserWithConfig(openAPI);
    }
}
