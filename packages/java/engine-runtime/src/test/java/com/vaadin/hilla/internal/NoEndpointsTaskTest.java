package com.vaadin.hilla.internal;

import com.vaadin.flow.server.ExecutionFailedException;
import com.vaadin.flow.server.frontend.TaskGenerateEndpoint;
import com.vaadin.flow.server.frontend.TaskGenerateOpenAPI;
import com.vaadin.hilla.ApplicationContextProvider;
import com.vaadin.hilla.engine.GeneratorProcessor;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;

import javax.annotation.Nonnull;
import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(classes = {
        NoEndpointsTaskTest.NoopApplicationContextProvider.class })
public class NoEndpointsTaskTest extends TaskTest {
    private TaskGenerateOpenAPI taskGenerateOpenApi;
    private TaskGenerateEndpoint taskGenerateEndpoint;

    @Autowired
    ApplicationContext applicationContext;

    @Test
    public void should_GenerateEmptySchema_when_NoEndpointsFound()
            throws ExecutionFailedException, IOException, URISyntaxException {
        // Mock ApplicationContextProvider static API to prevent interference
        // with other tests.
        try (var mockApplicationContextProvider = Mockito
                .mockStatic(ApplicationContextProvider.class)) {
            mockApplicationContextProvider
                    .when(ApplicationContextProvider::getApplicationContext)
                    .thenReturn(applicationContext);
            mockApplicationContextProvider
                    .when(() -> ApplicationContextProvider
                            .runOnContext(Mockito.any()))
                    .thenAnswer(invocationOnMock -> {
                        invocationOnMock
                                .<Consumer<ApplicationContext>> getArgument(0)
                                .accept(applicationContext);
                        return null;
                    });

            // Create files resembling output for previously existing endpoints
            var outputDirectory = Files.createDirectory(
                    getTemporaryDirectory().resolve(getOutputDirectory()));
            var generatedFileListPath = outputDirectory
                    .resolve(GeneratorProcessor.GENERATED_FILE_LIST_NAME);
            var referenceFileListPath = Path.of(Objects
                    .requireNonNull(getClass().getResource(
                            GeneratorProcessor.GENERATED_FILE_LIST_NAME))
                    .toURI());
            Files.copy(referenceFileListPath, generatedFileListPath);
            var referenceFileList = Files.readAllLines(referenceFileListPath);
            for (String line : referenceFileList) {
                var path = outputDirectory.resolve(line);
                Files.createDirectories(path.getParent());
                Files.createFile(path);
            }
            var arbitraryGeneratedFile = outputDirectory.resolve("vaadin.ts");
            Files.createFile(arbitraryGeneratedFile);

            taskGenerateOpenApi = new TaskGenerateOpenAPIImpl(
                    getEngineConfiguration());
            taskGenerateEndpoint = new TaskGenerateEndpointImpl(
                    getEngineConfiguration());

            taskGenerateOpenApi.execute();

            var generatedOpenAPI = getGeneratedOpenAPI();

            assertNull(generatedOpenAPI.getTags(),
                    "Expected OpenAPI tags to be null");
            assertTrue(generatedOpenAPI.getPaths().isEmpty(),
                    "Expected OpenAPI paths to be empty");
            assertNull(generatedOpenAPI.getComponents(),
                    "Expected OpenAPI schemas to be null");

            assertDoesNotThrow(taskGenerateEndpoint::execute,
                    "Expected to not fail without npm dependencies");

            assertFalse(generatedFileListPath.toFile().exists(),
                    "Expected file list to be deleted");
            for (String line : referenceFileList) {
                var path = outputDirectory.resolve(line);
                assertFalse(path.toFile().exists(),
                        String.format("Expected file %s to be deleted", path));
            }
            assertTrue(arbitraryGeneratedFile.toFile().exists(),
                    "Expected non-Hilla generated file to not be deleted");
        }
    }

    static class NoopApplicationContextProvider
            extends ApplicationContextProvider {
        @Override
        public void setApplicationContext(
                @Nonnull ApplicationContext applicationContext)
                throws BeansException {
            // do nothing
        }
    }
}
