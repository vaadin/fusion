package dev.hilla.parser.models;

import java.lang.reflect.AnnotatedElement;
import java.util.stream.Stream;

public interface ReflectionSignatureModel extends ReflectionModel {
    @Override
    AnnotatedElement get();
}
