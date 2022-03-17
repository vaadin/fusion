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

package dev.hilla;

import java.lang.annotation.Annotation;
import java.lang.reflect.AnnotatedElement;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.lang.reflect.Type;
import java.util.List;
import java.util.stream.Stream;

import com.github.javaparser.ast.expr.AnnotationExpr;

/**
 * A checker for TypeScript null compatibility in Vaadin endpoint methods
 * parameter and return types.
 */
public class ExplicitNullableTypeChecker {
    /**
     * Checks if the reflected element should be required (not nullable) in the
     * generated Typescript code based on annotations.
     *
     * @param element
     *            an element to be required
     * @return a result of check
     */
    public static boolean isRequired(AnnotatedElement element) {
        if ((element instanceof Field
                && ((Field) element).getType().isPrimitive())
                || (element instanceof Parameter
                        && ((Parameter) element).getType().isPrimitive())) {
            return true;
        }

        Stream<Annotation> annotations = Stream.of(element.getAnnotations());

        if (element instanceof Field) {
            annotations = Stream.concat(annotations, Stream
                    .of(((Field) element).getAnnotatedType().getAnnotations()));
        } else if (element instanceof Parameter) {
            annotations = Stream.concat(annotations, Stream.of(
                    ((Parameter) element).getAnnotatedType().getAnnotations()));
        }

        return annotations.anyMatch(annotation -> "nonnull"
                .equalsIgnoreCase(annotation.annotationType().getSimpleName()));
    }

    /**
     * Checks if the parsed node should be required (not nullable) in the
     * generated Typescript code based on the list of annotations.
     *
     * @param annotations
     *            a list of node annotations to check
     * @return a result of check
     */
    public static boolean isRequired(List<AnnotationExpr> annotations) {
        return annotations != null && annotations.stream()
                .anyMatch(annotation -> "nonnull".equalsIgnoreCase(
                        annotation.getName().getIdentifier()));
    }

    /**
     * Validates the given value for the given expected method return value
     * type.
     *
     * @param value
     *            the value to validate
     * @param annotatedElement
     *            the entity to be type checked
     * @return error message when the value is null while the expected type does
     *         not explicitly allow null, or null meaning the value is OK.
     */
    public String checkValueForAnnotatedElement(Object value,
            AnnotatedElement annotatedElement) {
        if (!isRequired(annotatedElement)) {
            return null;
        }
        if (annotatedElement instanceof Method) {
            return checkValueForType(value,
                    ((Method) annotatedElement).getGenericReturnType());
        }
        return null;
    }

    String checkValueForType(Object value, Type expectedType) {
        return new ExplicitNullableTypeCheckerHelper().checkValueForType(value,
                expectedType);
    }
}
