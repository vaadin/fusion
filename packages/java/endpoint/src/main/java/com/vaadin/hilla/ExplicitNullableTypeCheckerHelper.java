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

package com.vaadin.hilla;

import java.beans.IntrospectionException;
import java.beans.Introspector;
import java.beans.PropertyDescriptor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.lang.reflect.TypeVariable;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.vaadin.hilla.parser.utils.Generics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNullApi;

import static com.vaadin.hilla.ExplicitNullableTypeChecker.isRequired;

/**
 * A helper class for ExplicitNullableTypeChecker.
 */
class ExplicitNullableTypeCheckerHelper {

    // A map for tracking already visited Beans.
    private Map<Type, Set<Object>> visitedBeans;

    private static Logger getLogger() {
        return LoggerFactory.getLogger(EndpointController.class);
    }

    /**
     * Check if the Bean value and type have been visited.
     */
    boolean hasVisited(Object value, Type type) {
        if (visitedBeans == null) {
            return false;
        }
        Set<Object> values = visitedBeans.get(type);
        if (values == null) {
            return false;
        }
        return values.contains(value);
    }

    /**
     * Mark the given value and type have been visited.
     */
    void markAsVisited(Object value, Type type) {
        if (visitedBeans == null) {
            visitedBeans = new HashMap<>();
        }
        visitedBeans.putIfAbsent(type, new HashSet<>());
        visitedBeans.get(type).add(value);
    }

    /**
     * Validates the given value for the given expected method parameter or
     * return value type.
     *
     * @param value
     *            the value to validate
     * @param expectedType
     *            the declared type expected for the value
     * @return error message when the value is null while the expected type does
     *         not explicitly allow null, or null meaning the value is OK.
     */
    String checkValueForType(Object value, Type expectedType) {
        Class<?> clazz;
        if (expectedType instanceof TypeVariable) {
            return null;
        } else if (expectedType instanceof ParameterizedType) {
            clazz = (Class<?>) ((ParameterizedType) expectedType).getRawType();
        } else {
            clazz = (Class<?>) expectedType;
        }

        if (value != null) {
            if (Iterable.class.isAssignableFrom(clazz)) {
                return checkIterable((Iterable<?>) value, expectedType);
            } else if (clazz.isArray() && value instanceof Object[]) {
                return checkIterable(Arrays.asList((Object[]) value),
                        expectedType);
            } else if (Map.class.isAssignableFrom(clazz)) {
                return checkMapValues((Map<?, ?>) value, expectedType);
            } else if (expectedType instanceof Class<?>
                    && !clazz.getName().startsWith("java.")) {
                return checkBeanFields(value, expectedType);
            } else {
                return null;
            }
        }

        if (expectedType.equals(Void.TYPE)) {
            // Corner case: void methods return null value by design
            return null;
        }

        if (Void.class.isAssignableFrom(clazz)) {
            // Corner case: explicit Void parameter
            return null;
        }

        if (Optional.class.isAssignableFrom(clazz)) {
            return String.format(
                    "Got null value for type '%s', consider Optional.empty",
                    expectedType.getTypeName());
        }

        return String.format(
                "Got null value for type '%s', which is neither Optional"
                        + " nor void",
                expectedType.getTypeName());
    }

    private String checkIterable(Iterable<?> value, Type expectedType) {
        Type itemType = Object.class;
        String iterableDescription = "iterable";
        if (expectedType instanceof ParameterizedType) {
            itemType = ((ParameterizedType) expectedType)
                    .getActualTypeArguments()[0];
            iterableDescription = "collection";
        } else if (expectedType instanceof Class<?>) {
            var expectedClass = ((Class<?>) expectedType);

            if (Iterable.class.isAssignableFrom(expectedClass)) {
                // Let's deal with classes extending or implementing an iterator
                itemType = Generics.getExactIterableType(expectedClass)
                        .orElse(Object.class);
                iterableDescription = "collection";
            } else {
                itemType = expectedClass.getComponentType();
                iterableDescription = "array";
            }
        }

        for (Object item : value) {
            String error = checkValueForType(item, itemType);
            if (error != null) {
                return String.format("Unexpected null item in %s type '%s'. %s",
                        iterableDescription, expectedType, error);
            }
        }

        return null;
    }

    private String checkMapValues(Map<?, ?> value, Type expectedType) {
        Type valueType = Object.class;

        if (expectedType instanceof ParameterizedType) {
            valueType = ((ParameterizedType) expectedType)
                    .getActualTypeArguments()[1];
        }

        for (Map.Entry<?, ?> e : value.entrySet()) {
            String error = checkValueForType(e.getValue(), valueType);
            if (error != null) {
                return String.format(
                        "Unexpected null value for key '%s' of "
                                + "map type '%s'. %s",
                        e.getKey(), expectedType, error);
            }
        }

        return null;
    }

    private String checkBeanFields(Object value, Type expectedType) {
        if (hasVisited(value, expectedType)) {
            return null;
        }
        markAsVisited(value, expectedType);
        Class<?> clazz = (Class<?>) expectedType;
        // the context is the package where the object is defined
        boolean requiredByContext = clazz.getPackage() != null
                && clazz.getPackage().isAnnotationPresent(NonNullApi.class);
        try {
            for (PropertyDescriptor propertyDescriptor : Introspector
                    .getBeanInfo(clazz).getPropertyDescriptors()) {
                if (!isPropertySubjectForChecking(propertyDescriptor,
                        requiredByContext)) {
                    continue;
                }

                Method readMethod = propertyDescriptor.getReadMethod();
                Type propertyType = readMethod.getGenericReturnType();
                Object propertyValue = readMethod.invoke(value);

                String error = checkValueForType(propertyValue, propertyType);
                if (error != null) {
                    return String.format(
                            "Unexpected null value in Java "
                                    + "Bean type '%s' property '%s'. %s",
                            expectedType.getTypeName(),
                            propertyDescriptor.getName(), error);
                }
            }
        } catch (IntrospectionException | InvocationTargetException
                | IllegalAccessException e) {
            getLogger().error(
                    "Cannot check for null property values in Java Bean", e);
            return e.toString();
        }

        return null;
    }

    private boolean isPropertySubjectForChecking(
            PropertyDescriptor propertyDescriptor, boolean requiredByContext) {
        try {
            String name = propertyDescriptor.getName();
            Method readMethod = propertyDescriptor.getReadMethod();
            if (readMethod == null) {
                return false;
            }

            Class<?> declaringClass = readMethod.getDeclaringClass();
            final Set<String> declaredFieldNames = Arrays
                    .stream(declaringClass.getDeclaredFields())
                    .map(Field::getName).collect(Collectors.toSet());
            if (!declaredFieldNames.contains(name)) {
                return false;
            }

            Field field = readMethod.getDeclaringClass().getDeclaredField(name);
            return (!Modifier.isStatic(field.getModifiers())
                    && !Modifier.isTransient(field.getModifiers())
                    && isRequired(field, requiredByContext)
                    && !field.isAnnotationPresent(JsonIgnore.class));
        } catch (NoSuchFieldException e) {
            getLogger().error("Unexpected missing declared field in Java Bean",
                    e);
            return false;
        }
    }

}
