package com.vaadin.fusion.parser.core;

import java.util.stream.Stream;

import io.github.classgraph.ArrayTypeSignature;
import io.github.classgraph.BaseTypeSignature;
import io.github.classgraph.ClassInfo;
import io.github.classgraph.ClassRefTypeSignature;
import io.github.classgraph.TypeSignature;
import io.github.classgraph.TypeVariableSignature;

public interface RelativeTypeSignature extends Relative<Relative<?>> {
    static RelativeTypeSignature of(TypeSignature signature,
            Relative<?> parent) {
        if (signature instanceof BaseTypeSignature) {
            return new BaseRelativeTypeSignature((BaseTypeSignature) signature,
                    parent);
        } else if (signature instanceof ArrayTypeSignature) {
            return new ArrayRelativeTypeSignature(
                    (ArrayTypeSignature) signature, parent);
        } else if (signature instanceof TypeVariableSignature) {
            return new TypeVariableRelativeTypeSignature(
                    (TypeVariableSignature) signature, parent);
        } else {
            return new ClassRefRelativeTypeSignature(
                    (ClassRefTypeSignature) signature, parent);
        }
    }

    static Stream<ClassInfo> resolve(TypeSignature signature) {
        if (signature == null) {
            return Stream.empty();
        }

        if (signature instanceof BaseTypeSignature) {
            return BaseRelativeTypeSignature
                    .resolve((BaseTypeSignature) signature);
        } else if (signature instanceof ArrayTypeSignature) {
            return ArrayRelativeTypeSignature
                    .resolve((ArrayTypeSignature) signature);
        } else if (signature instanceof TypeVariableSignature) {
            return TypeVariableRelativeTypeSignature
                    .resolve((TypeVariableSignature) signature);
        } else {
            return ClassRefRelativeTypeSignature
                    .resolve((ClassRefTypeSignature) signature);
        }
    }

    @Override
    TypeSignature get();

    @Override
    default Stream<RelativeClassInfo> getDependencies() {
        return resolve(get()).distinct().map(RelativeClassInfo::new);
    }

    default boolean isArray() {
        return false;
    }

    default boolean isBase() {
        return false;
    };

    default boolean isBoolean() {
        return false;
    };

    default boolean isClassRef() {
        return false;
    };

    default boolean isCollection() {
        return false;
    };

    default boolean isDate() {
        return false;
    };

    default boolean isDateTime() {
        return false;
    };

    default boolean isEnum() {
        return false;
    };

    default boolean isMap() {
        return false;
    };

    default boolean isNumber() {
        return false;
    };

    default boolean isOptional() {
        return false;
    };

    default boolean isPrimitive() {
        return false;
    };

    default boolean isString() {
        return false;
    };

    default boolean isSystem() {
        return false;
    };

    default boolean isTypeVariable() {
        return false;
    };

    default boolean isVoid() {
        return false;
    };
}
