package dev.hilla.parser.models;

import static dev.hilla.parser.test.helpers.Specializations.entry;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.annotation.Annotation;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.lang.reflect.AnnotatedParameterizedType;
import java.lang.reflect.AnnotatedType;
import java.lang.reflect.ParameterizedType;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.ArgumentsProvider;
import org.junit.jupiter.params.provider.ArgumentsSource;

import dev.hilla.parser.test.helpers.Source;
import dev.hilla.parser.test.helpers.SourceExtension;
import dev.hilla.parser.test.helpers.SpecializationChecker;
import dev.hilla.parser.test.helpers.Specializations;
import dev.hilla.parser.utils.Streams;

import io.github.classgraph.ClassRefTypeSignature;
import io.github.classgraph.ScanResult;

@ExtendWith(SourceExtension.class)
public class ClassRefSignatureModelTests {
    private final CharacteristicsModelProvider.Checker checker = new CharacteristicsModelProvider.Checker();
    private Context.Matches matches;

    @BeforeEach
    public void setUp() {
        matches = new Context.Matches();
    }

    @DisplayName("It should compare parametrized class reference signature with its class info")
    @Test
    public void should_CompareParametrizedClassRefWithClassInfo(
            @Source ScanResult source) {
        var parametrizedFieldName = "staticParametrizedDependency";

        var ctx = new Context.Default(source);
        var bareParametrized = ctx
                .getBareReflectionOrigin(parametrizedFieldName);
        var completeParametrizedHidden = ctx
                .getCompleteReflectionOrigin(parametrizedFieldName);
        var completeParametrized = (AnnotatedParameterizedType) completeParametrizedHidden;
        var sourceParametrized = ctx.getSourceOrigin(parametrizedFieldName);

        var classParametrized = Sample.StaticParametrizedDependency.Sub.class;
        var classInfoParametrized = source
                .getClassInfo(classParametrized.getName());

        assertTrue(
                ClassRefSignatureModel.is(bareParametrized, classParametrized));
        assertTrue(ClassRefSignatureModel.is(completeParametrized,
                classParametrized));
        assertTrue(ClassRefSignatureModel.is(completeParametrizedHidden,
                classParametrized));
        assertTrue(ClassRefSignatureModel.is(sourceParametrized,
                classParametrized));

        assertTrue(ClassRefSignatureModel.is(bareParametrized,
                classInfoParametrized));
        assertTrue(ClassRefSignatureModel.is(completeParametrized,
                classInfoParametrized));
        assertTrue(ClassRefSignatureModel.is(completeParametrizedHidden,
                classInfoParametrized));
        assertTrue(ClassRefSignatureModel.is(sourceParametrized,
                classInfoParametrized));
    }

    @DisplayName("It should compare simple class reference signature with its class info")
    @Test
    public void should_CompareSimpleClassRefWithClassInfo(
            @Source ScanResult source) {
        var simpleFieldName = "staticDependency";

        var ctx = new Context.Default(source);
        var bareSimple = ctx.getBareReflectionOrigin(simpleFieldName);
        var completeSimple = ctx.getCompleteReflectionOrigin(simpleFieldName);
        var sourceSimple = ctx.getSourceOrigin(simpleFieldName);

        var classSimple = Sample.StaticDependency.Sub.class;
        var classInfoSimple = source.getClassInfo(classSimple.getName());

        assertTrue(ClassRefSignatureModel.is(bareSimple, classSimple));
        assertTrue(ClassRefSignatureModel.is(completeSimple, classSimple));
        assertTrue(ClassRefSignatureModel.is(sourceSimple, classSimple));

        assertTrue(ClassRefSignatureModel.is(bareSimple, classInfoSimple));
        assertTrue(ClassRefSignatureModel.is(completeSimple, classInfoSimple));
        assertTrue(ClassRefSignatureModel.is(sourceSimple, classInfoSimple));
    }

    @DisplayName("It should detect class reference characteristics correctly")
    @ParameterizedTest(name = CharacteristicsModelProvider.testNamePattern)
    @ArgumentsSource(CharacteristicsModelProvider.class)
    public void should_DetectCharacteristics(ClassRefSignatureModel model,
            String[] characteristics, ModelKind kind, String testName) {
        checker.apply(model, characteristics);
    }

    @DisplayName("It should get type arguments as a stream")
    @Test
    public void should_GetTypeArgumentsAsStream(@Source ScanResult source)
            throws NoSuchFieldException {
        var ctx = new Context.Default(source);
        var model = ClassRefSignatureModel.of(
                ctx.getCompleteReflectionOrigin(SingleModelProvider.fieldName));
        var expected = List.of(TypeArgumentModel
                .of(matches.getTypeArgument("intTypeArgument")));
        var actual = model.getTypeArgumentsStream()
                .collect(Collectors.toList());

        assertEquals(expected, actual);
    }

    @DisplayName("It should have the same hashCode for source and reflection models")
    @ParameterizedTest(name = EqualityModelProvider.testNamePattern)
    @ArgumentsSource(EqualityModelProvider.class)
    public void should_HaveSameHashCodeForSourceAndReflectionModels(
            Map.Entry<AnnotatedType, ClassRefTypeSignature> origins,
            String testName) {
        var reflectionModel = ClassRefSignatureModel.of(origins.getKey());
        var sourceModel = ClassRefSignatureModel.of(origins.getValue());

        assertEquals(reflectionModel.hashCode(), sourceModel.hashCode());
    }

    @DisplayName("It should have source and reflection models equal")
    @ParameterizedTest(name = EqualityModelProvider.testNamePattern)
    @ArgumentsSource(EqualityModelProvider.class)
    public void should_HaveSourceAndReflectionModelsEqual(
            Map.Entry<AnnotatedType, ClassRefTypeSignature> origins,
            String testName) {
        var reflectionModel = ClassRefSignatureModel.of(origins.getKey());
        var sourceModel = ClassRefSignatureModel.of(origins.getValue());

        assertEquals(reflectionModel, reflectionModel);
        assertEquals(reflectionModel, sourceModel);

        assertEquals(sourceModel, sourceModel);
        assertEquals(sourceModel, reflectionModel);

        assertNotEquals(sourceModel, new Object());
        assertNotEquals(reflectionModel, new Object());
    }

    @DisplayName("It should resolve class info")
    @ParameterizedTest(name = SingleModelProvider.testNamePattern)
    @ArgumentsSource(SingleModelProvider.class)
    public void should_ResolveClassInfo(ClassRefSignatureModel model,
            ModelKind kind) {
        var cls = ClassInfoModel
                .of(Sample.DynamicParametrizedDependency.Sub.class);

        assertEquals(cls, model.resolve());

        switch (kind) {
        case REFLECTION_COMPLETE:
        case SOURCE: {
            var owner = ClassInfoModel
                    .of(Sample.DynamicParametrizedDependency.class);
            var grandOwner = ClassInfoModel.of(Sample.class);
            var grandGrandOwner = ClassInfoModel.of(getClass());

            assertEquals(owner, model.getOwner()
                    .map(ClassRefSignatureModel::resolve).orElse(null));

            assertEquals(grandOwner,
                    model.getOwner().flatMap(ClassRefSignatureModel::getOwner)
                            .map(ClassRefSignatureModel::resolve).orElse(null));

            assertEquals(grandGrandOwner,
                    model.getOwner().flatMap(ClassRefSignatureModel::getOwner)
                            .flatMap(ClassRefSignatureModel::getOwner)
                            .map(ClassRefSignatureModel::resolve).orElse(null));
        }
            break;
        case REFLECTION_BARE:
            break;
        }
    }

    @DisplayName("It should resolve type owner")
    @ParameterizedTest(name = SingleModelProvider.testNamePattern)
    @ArgumentsSource(SingleModelProvider.class)
    public void should_ResolveTypeOwner(ClassRefSignatureModel model,
            ModelKind kind) {
        switch (kind) {
        case REFLECTION_COMPLETE:
        case SOURCE: {
            assertEquals(Sample.DynamicParametrizedDependency.class.getName(),
                    model.getOwner().map(ClassRefSignatureModel::getClassName)
                            .orElse(null));

            assertEquals(Sample.class.getName(),
                    model.getOwner().flatMap(ClassRefSignatureModel::getOwner)
                            .map(ClassRefSignatureModel::getClassName)
                            .orElse(null));

            assertEquals(getClass().getName(),
                    model.getOwner().flatMap(ClassRefSignatureModel::getOwner)
                            .flatMap(ClassRefSignatureModel::getOwner)
                            .map(ClassRefSignatureModel::getClassName)
                            .orElse(null));

            assertEquals(Optional.empty(),
                    model.getOwner().flatMap(ClassRefSignatureModel::getOwner)
                            .flatMap(ClassRefSignatureModel::getOwner)
                            .flatMap(ClassRefSignatureModel::getOwner));
        }
            break;
        case REFLECTION_BARE:
            break;
        }
    }

    @DisplayName("It should resolve underlying class correctly")
    @ParameterizedTest(name = SingleModelProvider.testNamePattern)
    @ArgumentsSource(SingleModelProvider.class)
    public void should_ResolveUnderlyingClass(ClassRefSignatureModel model,
            ModelKind kind) {
        assertEquals(Sample.DynamicParametrizedDependency.Sub.class.getName(),
                model.getClassName());
    }

    @DisplayName("It should resolve underlying type arguments")
    @ParameterizedTest(name = SingleModelProvider.testNamePattern)
    @ArgumentsSource(SingleModelProvider.class)
    public void should_ResolveUnderlyingTypeArguments(
            ClassRefSignatureModel model, ModelKind kind)
            throws NoSuchFieldException {
        switch (kind) {
        case REFLECTION_COMPLETE:
        case SOURCE: {
            var intTypeArgument = TypeArgumentModel
                    .of(matches.getTypeArgument("intTypeArgument"));
            var stringTypeArgument = TypeArgumentModel
                    .of(matches.getTypeArgument("stringTypeArgument"));

            assertEquals(List.of(intTypeArgument), model.getTypeArguments());

            assertEquals(List.of(stringTypeArgument),
                    model.getOwner()
                            .map(ClassRefSignatureModel::getTypeArguments)
                            .orElseGet(List::of));
        }
            break;
        case REFLECTION_BARE:
            assertEquals(List.of(), model.getTypeArguments());
            break;
        }
    }

    enum ModelKind {
        SOURCE("SOURCE"), REFLECTION_COMPLETE(
                "REFLECTION (complete)"), REFLECTION_BARE("REFLECTION (bare)");

        private final String text;

        ModelKind(String text) {
            this.text = text;
        }

        @Override
        public String toString() {
            return text;
        }
    }

    static final class CharacteristicsModelProvider
            implements ArgumentsProvider {
        public static final String testNamePattern = "{2} [{3}]";

        private static final Specializations specializations = Specializations
                .of(entry(Boolean.class.getName(), "isBoolean", "isClassRef",
                        "isJDKClass"),
                        entry(Byte.class.getName(), "isByte", "isClassRef",
                                "isJDKClass"),
                        entry(Character.class.getName(), "isCharacter",
                                "isClassRef", "isJDKClass"),
                        entry(Double.class.getName(), "isDouble", "isClassRef",
                                "isJDKClass"),
                        entry(Float.class.getName(), "isFloat", "isClassRef",
                                "isJDKClass"),
                        entry(List.class.getName(), "isIterable", "isClassRef",
                                "isJDKClass"),
                        entry(Long.class.getName(), "isLong", "isClassRef",
                                "isJDKClass"),
                        entry(Short.class.getName(), "isShort", "isClassRef",
                                "isJDKClass"),
                        entry(Sample.Characteristics.Enum.class.getName(),
                                "isEnum", "isClassRef"),
                        entry(Integer.class.getName(), "isInteger",
                                "isClassRef", "isJDKClass"),
                        entry(Date.class.getName(), "isDate", "isClassRef",
                                "isJDKClass"),
                        entry(LocalDateTime.class.getName(), "isDateTime",
                                "isClassRef", "isJDKClass"),
                        entry(Map.class.getName(), "isMap", "isClassRef",
                                "isJDKClass"),
                        entry(Object.class.getName(), "isNativeObject",
                                "isClassRef", "isJDKClass"),
                        entry(Optional.class.getName(), "isOptional",
                                "isClassRef", "isJDKClass"),
                        entry(String.class.getName(), "isString", "isClassRef",
                                "isJDKClass"));

        @Override
        public Stream<? extends Arguments> provideArguments(
                ExtensionContext context) {
            var ctx = new Context.Characteristics(context);

            var complete = ctx.getCompleteReflectionOrigins().entrySet()
                    .stream().map(entry -> {
                        var origin = entry.getValue();
                        var name = origin instanceof AnnotatedParameterizedType
                                ? ((Class<?>) ((ParameterizedType) origin
                                        .getType()).getRawType()).getName()
                                : ((Class<?>) origin.getType()).getName();

                        return Arguments.of(ClassRefSignatureModel.of(origin),
                                specializations.get(name),
                                ModelKind.REFLECTION_COMPLETE, entry.getKey());
                    });
            var bare = ctx.getBareReflectionOrigins().entrySet().stream()
                    .map(entry -> Arguments.of(
                            ClassRefSignatureModel.of(entry.getValue()),
                            specializations.get(entry.getValue().getName()),
                            ModelKind.REFLECTION_BARE, entry.getKey()));

            var source = ctx.getSourceOrigins().entrySet().stream()
                    .map(entry -> Arguments.of(
                            ClassRefSignatureModel.of(entry.getValue()),
                            specializations.get(entry.getValue()
                                    .getFullyQualifiedClassName()),
                            ModelKind.SOURCE, entry.getKey()));

            return Streams.combine(complete, bare, source);
        }

        static final class Checker
                extends SpecializationChecker<ClassRefSignatureModel> {
            private static final List<String> allowedMethods = List.of(
                    "isBoolean", "isByte", "isCharacter", "isClassRef",
                    "isDate", "isDateTime", "isDouble", "isEnum", "isFloat",
                    "isInteger", "isIterable", "isJDKClass", "isLong", "isMap",
                    "isNativeObject", "isOptional", "isShort", "isString");

            public Checker() {
                super(ClassRefSignatureModel.class,
                        ClassRefSignatureModel.class.getDeclaredMethods(),
                        allowedMethods);
            }
        }
    }

    static final class EqualityModelProvider implements ArgumentsProvider {
        public static final String testNamePattern = "BOTH [{1}]";

        @Override
        public Stream<? extends Arguments> provideArguments(
                ExtensionContext context) {
            var ctx = new Context.Default(context);

            return ctx.getNames().stream().map(name -> {
                var complete = ctx.getCompleteReflectionOrigin(name);
                var source = ctx.getSourceOrigin(name);

                return Arguments.of(Map.entry(complete, source), name);
            });
        }
    }

    static final class ParametrizedModelProvider implements ArgumentsProvider {
        public static final String testNamePattern = "{1} [{2}]";

        @Override
        public Stream<? extends Arguments> provideArguments(
                ExtensionContext context) {
            var ctx = new Context.Default(context);

            var complete = ctx.getCompleteReflectionOrigins().entrySet()
                    .stream()
                    .filter(entry -> entry.getKey().contains("Parametrized"))
                    .map(entry -> Arguments.of(
                            ClassRefSignatureModel.of(entry.getValue()),
                            ModelKind.REFLECTION_COMPLETE, entry.getKey()));

            var bare = ctx.getBareReflectionOrigins().entrySet().stream()
                    .filter(entry -> entry.getKey().contains("Parametrized"))
                    .map(entry -> Arguments.of(
                            ClassRefSignatureModel.of(entry.getValue()),
                            ModelKind.REFLECTION_BARE, entry.getKey()));

            var source = ctx.getSourceOrigins().entrySet().stream()
                    .filter(entry -> entry.getKey().contains("Parametrized"))
                    .map(entry -> Arguments.of(
                            ClassRefSignatureModel.of(entry.getValue()),
                            ModelKind.SOURCE, entry.getKey()));

            return Streams.combine(complete, bare, source);
        }

    }

    static final class SingleModelProvider implements ArgumentsProvider {
        public static final String fieldName = "dynamicParametrizedDependency";
        public static final String testNamePattern = "{1}";

        @Override
        public Stream<? extends Arguments> provideArguments(
                ExtensionContext context) {
            var ctx = new Context.Default(context);

            var complete = ctx.getCompleteReflectionOrigin(fieldName);
            var bare = ctx.getBareReflectionOrigin(fieldName);
            var source = ctx.getSourceOrigin(fieldName);

            return Stream.of(
                    Arguments.of(ClassRefSignatureModel.of(complete),
                            ModelKind.REFLECTION_COMPLETE),
                    Arguments.of(ClassRefSignatureModel.of(bare),
                            ModelKind.REFLECTION_BARE),
                    Arguments.of(ClassRefSignatureModel.of(source),
                            ModelKind.SOURCE));
        }
    }

    @Nested
    @DisplayName("As an AnnotatedModel")
    public class AsAnnotatedModel {
        @DisplayName("It should get a type annotation")
        @ParameterizedTest(name = SingleModelProvider.testNamePattern)
        @ArgumentsSource(SingleModelProvider.class)
        public void should_GetTypeAnnotation(ClassRefSignatureModel model,
                ModelKind kind) throws NoSuchFieldException {
            switch (kind) {
            case REFLECTION_COMPLETE:
            case SOURCE: {
                var fooAnnotation = AnnotationInfoModel
                        .of(matches.getAnnotation("fooAnnotation"));
                var barAnnotation = AnnotationInfoModel
                        .of(matches.getAnnotation("barAnnotation"));

                assertEquals(List.of(fooAnnotation), model.getAnnotations());

                assertEquals(List.of(barAnnotation),
                        model.getOwner()
                                .map(ClassRefSignatureModel::getAnnotations)
                                .orElseGet(List::of));
            }
                break;
            case REFLECTION_BARE:
                assertEquals(Optional.empty(), model.getOwner());
                break;
            }
        }
    }

    abstract static class Context {
        private final Map<String, Class<?>> bareReflectionOrigins = new HashMap<>();
        private final Map<String, AnnotatedType> completeReflectionOrigins = new HashMap<>();
        private final Map<String, ClassRefTypeSignature> sourceOrigins = new HashMap<>();

        Context(ScanResult source, Class<?> target) {
            var classInfo = source.getClassInfo(target.getName());

            for (var field : target.getDeclaredFields()) {
                var name = field.getName();

                completeReflectionOrigins.put(name, field.getAnnotatedType());
                bareReflectionOrigins.put(name, field.getType());
                sourceOrigins.put(name, (ClassRefTypeSignature) classInfo
                        .getFieldInfo(name).getTypeSignatureOrTypeDescriptor());
            }
        }

        public Class<?> getBareReflectionOrigin(String name) {
            return bareReflectionOrigins.get(name);
        }

        public Map<String, Class<?>> getBareReflectionOrigins() {
            return bareReflectionOrigins;
        }

        public AnnotatedType getCompleteReflectionOrigin(String name) {
            return completeReflectionOrigins.get(name);
        }

        public Map<String, AnnotatedType> getCompleteReflectionOrigins() {
            return completeReflectionOrigins;
        }

        public Set<String> getNames() {
            return bareReflectionOrigins.keySet();
        }

        public ClassRefTypeSignature getSourceOrigin(String name) {
            return sourceOrigins.get(name);
        }

        public Map<String, ClassRefTypeSignature> getSourceOrigins() {
            return sourceOrigins;
        }

        static final class Matches {
            public Annotation getAnnotation(String name)
                    throws NoSuchFieldException {
                var annotations = Sample.Matches.class.getDeclaredField(name)
                        .getAnnotatedType().getAnnotations();

                if (annotations.length > 0) {
                    return annotations[0];
                }

                throw new NoSuchFieldException(
                        "No annotated field with name \"" + name + "\" found");
            }

            public AnnotatedType getTypeArgument(String name)
                    throws NoSuchFieldException {
                var owner = Sample.Matches.class.getDeclaredField(name)
                        .getAnnotatedType();

                if (owner instanceof AnnotatedParameterizedType) {
                    return ((AnnotatedParameterizedType) owner)
                            .getAnnotatedActualTypeArguments()[0];
                }

                throw new NoSuchFieldException(
                        "No parametrized field with name \"" + name
                                + "\" found");
            }
        }

        static class Characteristics extends Context {
            Characteristics(ScanResult source) {
                super(source, Sample.Characteristics.class);
            }

            Characteristics(ExtensionContext context) {
                this(SourceExtension.getSource(context));
            }
        }

        static class Default extends Context {
            Default(ScanResult source) {
                super(source, Sample.class);
            }

            Default(ExtensionContext context) {
                this(SourceExtension.getSource(context));
            }
        }
    }

    static class Sample {
        private @Bar DynamicDependency.@Foo Sub dynamicDependency;
        private @Bar DynamicParametrizedDependency<String>.@Foo Sub<Integer> dynamicParametrizedDependency;
        private StaticDependency.@Foo Sub staticDependency;
        private StaticParametrizedDependency.@Foo Sub<Integer> staticParametrizedDependency;
        private @Foo List<String> topLevelParametrizedDependency;

        @Retention(RetentionPolicy.RUNTIME)
        @Target(ElementType.TYPE_USE)
        @interface Bar {
        }

        @Retention(RetentionPolicy.RUNTIME)
        @Target(ElementType.TYPE_USE)
        @interface Foo {
        }

        static class Characteristics {
            private Boolean aBoolean;
            private Byte aByte;
            private Character aChar;
            private Double aDouble;
            private Float aFloat;
            private Long aLong;
            private Short aShort;
            private Enum anEnum;
            private Integer anInt;
            private Date date;
            private LocalDateTime dateTime;
            private List<?> list;
            private Map<?, ?> map;
            private Object object;
            private Optional<?> optional;
            private String string;

            enum Enum {
            }
        }

        class DynamicDependency {
            class Sub {
            }
        }

        class DynamicParametrizedDependency<U> {
            class Sub<T> {
            }
        }

        static class Matches {
            private @Bar String barAnnotation;
            private @Foo String fooAnnotation;
            private List<Integer> intTypeArgument;
            private List<String> stringTypeArgument;
        }

        static class StaticDependency {
            static class Sub {
            }
        }

        static class StaticParametrizedDependency<U> {
            static class Sub<T> {
            }
        }
    }
}
