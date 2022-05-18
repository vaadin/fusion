package dev.hilla.parser.plugins.transfertypes.pageable.bare;

import java.io.File;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;

import dev.hilla.parser.core.ParserConfig;
import dev.hilla.parser.plugins.backbone.BackbonePlugin;
import dev.hilla.parser.plugins.transfertypes.TransferTypesPlugin;
import dev.hilla.parser.plugins.transfertypes.test.helpers.TestHelper;
import java.util.Arrays;
import java.util.stream.Collectors;

public class BarePageableTest {
    private final TestHelper helper = new TestHelper(getClass());

    @Test
    public void should_ConsiderInternalDependenciesForReplacedEntities()
            throws IOException, URISyntaxException {
        var classpath = helper.getExtendedClassPath(Pageable.class);

        var config = new ParserConfig.Builder()
                .classPath(Arrays.stream(classpath.split(File.pathSeparator))
                        .collect(Collectors.toSet()))
                .endpointAnnotation(Endpoint.class.getName())
                .addPlugin(new TransferTypesPlugin())
                .addPlugin(new BackbonePlugin()).finish();

        helper.executeParserWithConfig(config);
    }

    @Test
    public void should_CorrectlyResolveReplacedDependencies()
            throws IOException, URISyntaxException {
        var classpath = helper.getExtendedClassPath(Pageable.class);

        var config = new ParserConfig.Builder()
                .classPath(Arrays.stream(classpath.split(File.pathSeparator))
                        .collect(Collectors.toSet()))
                .endpointAnnotation(Endpoint.class.getName())
                .addPlugin(new TransferTypesPlugin())
                .addPlugin(new BackbonePlugin()).finish();

        helper.executeParserWithConfig(config);
    }
}
