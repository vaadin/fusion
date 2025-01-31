package com.vaadin.hilla.internal;

import com.vaadin.flow.server.ExecutionFailedException;
import com.vaadin.hilla.ApplicationContextProvider;
import com.vaadin.hilla.engine.EngineConfiguration;
import com.vaadin.hilla.internal.fixtures.CustomEndpoint;
import com.vaadin.hilla.internal.fixtures.EndpointNoValue;
import com.vaadin.hilla.internal.fixtures.MyEndpoint;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ContextConfiguration;

import static org.junit.jupiter.api.Assertions.assertThrowsExactly;

class AbstractTaskEndpointGeneratorTest extends EndpointsTaskTest {
    @Test
    void shouldThrowIfEngineConfigurationIsNull() {
        assertThrowsExactly(NullPointerException.class, () -> {
            new TestTaskEndpointGenerator(null);
        }, "Engine configuration cannot be null");
    }

    private class TestTaskEndpointGenerator
            extends AbstractTaskEndpointGenerator {
        TestTaskEndpointGenerator(EngineConfiguration engineConfiguration) {
            super(engineConfiguration);
        }

        @Override
        public void execute() throws ExecutionFailedException {
            // no-op
        }
    }
}
