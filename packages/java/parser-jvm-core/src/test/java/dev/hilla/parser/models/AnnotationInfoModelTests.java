package dev.hilla.parser.models;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import dev.hilla.parser.test.helpers.TestHelper;

import io.github.classgraph.ScanResult;

public class AnnotationInfoModelTests {
    private static void checkModelProvidingName(AnnotationInfoModel model) {
        assertEquals(model.getName(), Foo.class.getName());
    }

    private static void checkModelProvidingNoDependencies(
            AnnotationInfoModel model) {
        assertEquals(model.getDependencies().size(), 0);
    }

    @Retention(RetentionPolicy.RUNTIME)
    @Target(ElementType.METHOD)
    @interface Foo {
    }

    @Retention(RetentionPolicy.RUNTIME)
    @Target(ElementType.TYPE)
    @interface Selector {
    }

    @ExtendWith(MockitoExtension.class)
    public static class ReflectionModelTests {
        private AnnotationInfoModel model;

        @BeforeEach
        public void setUp(@Mock Model parent) throws NoSuchMethodException {
            var origin = Sample.class.getMethod("bar").getAnnotation(Foo.class);
            model = AnnotationInfoModel.of(origin, parent);
        }

        @Test
        public void should_CreateCorrectModel_When_JavaReflectionUsed() {
            assertTrue(model.isReflection());
        }

        @Test
        public void should_ProvideName() {
            checkModelProvidingName(model);
        }

        @Test
        public void should_ProvideNoDependencies() {
            checkModelProvidingNoDependencies(model);
        }
    }

    @ExtendWith(MockitoExtension.class)
    public static class SourceModelTests {
        private static final TestHelper helper = new TestHelper();
        private static ScanResult result;
        private AnnotationInfoModel model;

        @AfterAll
        public static void destroy() {
            result.close();
        }

        @BeforeAll
        public static void init() {
            result = helper.createClassGraph().scan();
        }

        @BeforeEach
        public void setUp(@Mock Model parent) {
            var origin = result.getClassesWithAnnotation(Selector.class)
                    .stream().flatMap(cls -> cls.getMethodInfo().stream())
                    .flatMap(method -> method.getAnnotationInfo().stream())
                    .findFirst().get();

            model = AnnotationInfoModel.of(origin, parent);
        }

        @Test
        public void should_ProvideName() {
            checkModelProvidingName(model);
        }

        @Test
        public void should_ProvideNoDependencies() {
            checkModelProvidingNoDependencies(model);
        }

        @Test
        public void should_createCorrectModel_When_ClassGraphUsed() {
            assertTrue(model.isSource());
        }
    }

    @Selector
    static class Sample {
        @Foo
        public void bar() {
        }
    }
}
