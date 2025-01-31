package com.vaadin.hilla.internal;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.File;
import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;

import org.apache.commons.io.FileUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.vaadin.flow.server.frontend.TaskGenerateEndpoint;

public class TaskGenerateEndpointTest extends EndpointsTaskTest {

    private Path outputDirectory;
    private TaskGenerateEndpoint taskGenerateEndpoint;

    @BeforeEach
    public void setUp() throws IOException, URISyntaxException {
        var referenceOpenAPIJsonFile = Path.of(Objects
                .requireNonNull(getClass().getResource(
                        "openapi/esmodule-generator-TwoEndpointsThreeMethods.json"))
                .toURI());
        Files.createDirectories(getOpenAPIFile().getParent());
        Files.copy(referenceOpenAPIJsonFile, getOpenAPIFile());
        outputDirectory = Files.createDirectory(
                getTemporaryDirectory().resolve(getOutputDirectory()));
    }

    @Test
    public void should_generate_Two_TypeScriptFiles() throws Exception {
        File ts1 = outputDirectory.resolve("FooBarEndpoint.ts").toFile();
        File ts2 = outputDirectory.resolve("FooFooEndpoint.ts").toFile();
        File client = outputDirectory.resolve("connect-client.default.ts")
                .toFile();

        assertFalse(ts1.exists());
        assertFalse(ts2.exists());
        assertFalse(client.exists());

        taskGenerateEndpoint = new TaskGenerateEndpointImpl(
                getEngineConfiguration());
        taskGenerateEndpoint.execute();

        assertTrue(ts1.exists());
        assertTrue(ts2.exists());
        assertTrue(client.exists());

        String output = FileUtils.readFileToString(client, "UTF-8");
        assertThat(output, containsString(
                "import { ConnectClient as ConnectClient_1 } from \"@vaadin/hilla-frontend\";"));
        assertThat(output, containsString(
                "const client_1 = new ConnectClient_1({ prefix: \"connect\" });"));
        assertThat(output, containsString("export default client_1;"));
    }

    @Test
    public void should_use_custom_endpoint_name_when_connect_client_exists()
            throws Exception {
        File ts1 = outputDirectory.resolve("FooBarEndpoint.ts").toFile();
        File ts2 = outputDirectory.resolve("FooFooEndpoint.ts").toFile();
        File client = outputDirectory.resolve("connect-client.default.ts")
                .toFile();
        File customConnectClient = Files
                .createFile(
                        getTemporaryDirectory().resolve("connect-client.ts"))
                .toFile();

        assertFalse(ts1.exists());
        assertFalse(ts2.exists());
        assertFalse(client.exists());
        assertTrue(customConnectClient.exists());

        taskGenerateEndpoint = new TaskGenerateEndpointImpl(
                getEngineConfiguration());
        taskGenerateEndpoint.execute();

        assertTrue(ts1.exists());
        assertTrue(ts2.exists());
        assertFalse(client.exists());

        String outputEndpoinTs1 = FileUtils.readFileToString(ts1, "UTF-8");
        String outputEndpoinTs2 = FileUtils.readFileToString(ts2, "UTF-8");
        assertThat(outputEndpoinTs1, containsString(
                "import client_1 from \"../connect-client.js\";"));
        assertThat(outputEndpoinTs2, containsString(
                "import client_1 from \"../connect-client.js\";"));
    }
}
