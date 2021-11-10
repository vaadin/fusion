package com.vaadin.fusion.parser.plugins.backbone;

import static io.swagger.v3.oas.models.Components.COMPONENTS_SCHEMAS_REF;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import javax.annotation.Nonnull;

import com.vaadin.fusion.parser.core.RelativeClassInfo;
import com.vaadin.fusion.parser.core.RelativeMethodInfo;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.media.ComposedSchema;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;

class EntityProcessor extends Processor {
    private static String decapitalize(String string) {
        char[] c = string.toCharArray();
        c[0] = Character.toLowerCase(c[0]);
        return new String(c);
    }

    public EntityProcessor(@Nonnull List<RelativeClassInfo> classes,
            @Nonnull OpenAPI model) {
        super(classes, model);
    }

    @Override
    public void process() {
        model.components(prepareComponents());
    }

    private Components prepareComponents() {
        Components components = new Components();

        classes.stream()
                .flatMap(cls -> cls.getInheritanceChain().getClassesStream())
                .forEach(entity -> {
                    if (components.getSchemas() == null
                            || (!components.getSchemas()
                                    .containsKey(entity.get().getName()))) {
                        ComponentSchemaProcessor processor = new ComponentSchemaProcessor(
                                entity);

                        components.addSchemas(processor.getKey(),
                                processor.getValue());
                    }
                });

        return components;
    }

    private static class ComponentSchemaProcessor {
        private final RelativeClassInfo entity;

        public ComponentSchemaProcessor(RelativeClassInfo entity) {
            this.entity = entity;
        }

        public String getKey() {
            return entity.get().getName();
        }

        public Schema<?> getValue() {
            return entity.get().isEnum() ? processEnum()
                    : processClassWithSuperClasses();
        }

        private Schema<?> processEnum() {
            StringSchema schema = new StringSchema();

            schema.setEnum(entity.getFieldsStream()
                    .filter(field -> field.get().isPublic())
                    .map(field -> field.get().getName())
                    .collect(Collectors.toList()));

            return schema;
        }

        private Schema<?> processClassWithSuperClasses() {
            Schema<?> processed = processDirectClass();

            Optional<Schema<?>> result = entity.getSuperClass()
                    .map(cls -> new ComposedSchema()
                            .anyOf(Arrays.asList(
                                    new Schema<>().$ref(COMPONENTS_SCHEMAS_REF
                                            + cls.get().getName()),
                                    processed)));

            return result.orElse(processed);
        }

        private Schema<?> processDirectClass() {
            ObjectSchema schema = new ObjectSchema();

            entity.getMethodsStream()
                    .filter(method -> method.get().getName().startsWith("get"))
                    .forEach(method -> {
                        ComponentSchemaPropertyProcessor processor = new ComponentSchemaPropertyProcessor(
                                method);

                        schema.addProperties(processor.getKey(),
                                processor.getValue());
                    });

            return schema;
        }
    }

    private static class ComponentSchemaPropertyProcessor {
        private final RelativeMethodInfo method;

        public ComponentSchemaPropertyProcessor(RelativeMethodInfo method) {
            this.method = method;
        }

        public String getKey() {
            return decapitalize(method.get().getName().substring(3));
        }

        public Schema<?> getValue() {
            return new SchemaProcessor(method.getResultType()).process();
        }
    }
}
