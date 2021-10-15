package com.vaadin.fusion.parser.core;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import io.github.classgraph.ClassInfo;
import io.github.classgraph.ClassRefTypeSignature;

public final class ClassRefRelativeTypeSignature
        extends AbstractRelative<ClassRefTypeSignature, Relative<?>>
        implements RelativeTypeSignature {
    private static final Class<?>[] DATE_CLASSES = { Date.class,
            LocalDate.class };
    private static final Class<?>[] DATE_TIME_CLASSES = { LocalDateTime.class,
            Instant.class, LocalTime.class };
    private static final Class<?>[] NUMBER_CLASSES = { Byte.class, Short.class,
            Integer.class, Long.class, Float.class, Double.class };

    private final Class<?> currentClass;
    private final List<RelativeTypeArgument> typeArguments;

    ClassRefRelativeTypeSignature(ClassRefTypeSignature origin,
            Relative<?> parent) {
        super(origin, parent);
        currentClass = origin.loadClass();
        typeArguments = origin.getTypeArguments().stream()
                .map(arg -> new RelativeTypeArgument(arg, this))
                .collect(Collectors.toList());
    }

    public static Stream<ClassInfo> resolve(ClassRefTypeSignature signature) {
        ClassInfo classInfo = signature.getClassInfo();

        Stream<ClassInfo> typeArgumentsDependencies = signature
                .getTypeArguments().stream()
                .flatMap(argument -> RelativeTypeSignature
                        .resolve(argument.getTypeSignature()));

        // ClassInfo for all native class refs (like List<>, Set<>, etc.),
        // is null. So if it is not null, it is not a standard stuff, so we can
        // resolve it directly. Otherwise, we resolve their type arguments.
        return classInfo != null
                ? Stream.of(Stream.of(classInfo), typeArgumentsDependencies)
                        .flatMap(Function.identity())
                : typeArgumentsDependencies;
    }

    @Override
    public boolean isBoolean() {
        return Objects.equals(origin.getFullyQualifiedClassName(),
                Boolean.class.getName());
    }

    @Override
    public boolean isClassRef() {
        return true;
    }

    @Override
    public boolean isIterable() {
        return Iterable.class.isAssignableFrom(currentClass);
    }

    @Override
    public boolean isDate() {
        return Arrays.stream(DATE_CLASSES)
                .anyMatch(cls -> cls.isAssignableFrom(currentClass));
    }

    @Override
    public boolean isDateTime() {
        return Arrays.stream(DATE_TIME_CLASSES)
                .anyMatch(cls -> cls.isAssignableFrom(currentClass));
    }

    @Override
    public boolean isEnum() {
        return currentClass.isEnum();
    }

    @Override
    public boolean isMap() {
        return Map.class.isAssignableFrom(currentClass);
    }

    @Override
    public boolean isNumber() {
        return Arrays.stream(NUMBER_CLASSES)
                .anyMatch(cls -> cls.isAssignableFrom(currentClass));
    }

    @Override
    public boolean isOptional() {
        return Optional.class.isAssignableFrom(currentClass);
    }

    @Override
    public boolean isString() {
        return String.class.isAssignableFrom(currentClass);
    }

    @Override
    public boolean isSystem() {
        return origin.getClassInfo() == null;
    }

    public List<RelativeTypeArgument> getTypeArguments() {
        return typeArguments;
    }
}
