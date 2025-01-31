/*
 * Copyright 2000-2022 Vaadin Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */
package com.vaadin.hilla.internal;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

import com.vaadin.flow.server.frontend.TaskGenerateOpenAPI;

/**
 * This test suite is only for triggering the OpenAPI generator. For the actual
 * content of the generator, they are tested in other package
 * {@link com.vaadin.hilla.generator}
 */
public class TaskGenerateOpenAPITest extends EndpointsTaskTest {

    private TaskGenerateOpenAPI taskGenerateOpenApi;

    @Test
    public void should_UseCustomEndpointNameWithoutValueEqual_InsteadOf_UsingClassName()
            throws Exception {
        taskGenerateOpenApi = new TaskGenerateOpenAPIImpl(
                getEngineConfiguration());

        taskGenerateOpenApi.execute();

        var generatedOpenAPI = getGeneratedOpenAPI();

        assertThat(generatedOpenAPI.getPaths().keySet(),
                hasItem("/WithoutValueEqual/bar"));
        assertThat(generatedOpenAPI.getPaths().keySet(),
                not(hasItem("/EndpointNoValue/bar")));
        assertThat(generatedOpenAPI.getPaths().keySet(),
                hasItem("/WithoutValueEqual/foo"));
        assertThat(generatedOpenAPI.getPaths().keySet(),
                not(hasItem("/EndpointNoValue/foo")));
    }

    @Test
    public void should_UseCustomEndpointName_InsteadOf_UsingClassName()
            throws Exception {
        taskGenerateOpenApi = new TaskGenerateOpenAPIImpl(
                getEngineConfiguration());

        taskGenerateOpenApi.execute();

        var generatedOpenAPI = getGeneratedOpenAPI();

        assertThat(generatedOpenAPI.getPaths().keySet(),
                hasItem("/CustomEndpointName/bar"));
        assertThat(generatedOpenAPI.getPaths().keySet(),
                not(hasItem("/CustomEndpoint/bar")));
        assertThat(generatedOpenAPI.getPaths().keySet(),
                hasItem("/CustomEndpointName/foo"));
        assertThat(generatedOpenAPI.getPaths().keySet(),
                not(hasItem("/CustomEndpoint/foo")));
    }

    @Test
    public void should_UseDefaultProperties_when_applicationPropertiesIsEmpty()
            throws Exception {
        taskGenerateOpenApi = new TaskGenerateOpenAPIImpl(
                getEngineConfiguration());

        taskGenerateOpenApi.execute();

        var generatedOpenAPI = getGeneratedOpenAPI();
        var info = generatedOpenAPI.getInfo();
        assertEquals("Hilla Application", info.getTitle(),
                "Generated OpenAPI should have default application title");

        assertEquals("1.0.0", info.getVersion(),
                "Generated OpenAPI should have default application API version");

        var servers = generatedOpenAPI.getServers();
        assertEquals(1, servers.size(),
                "Generated OpenAPI should a default server");
        assertEquals("http://localhost:8080/connect", servers.get(0).getUrl(),
                "Generated OpenAPI should have default url server");

        assertEquals("Hilla Backend", servers.get(0).getDescription(),
                "Generated OpenAPI should have default server description");
    }
}
