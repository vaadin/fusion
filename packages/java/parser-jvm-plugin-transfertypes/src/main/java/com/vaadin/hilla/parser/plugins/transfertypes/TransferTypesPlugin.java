package com.vaadin.hilla.parser.plugins.transfertypes;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import org.jspecify.annotations.NonNull;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import com.vaadin.hilla.mappedtypes.Order;
import com.vaadin.hilla.mappedtypes.Pageable;
import com.vaadin.hilla.mappedtypes.Sort;
import com.vaadin.hilla.parser.core.AbstractPlugin;
import com.vaadin.hilla.parser.core.Node;
import com.vaadin.hilla.parser.core.NodeDependencies;
import com.vaadin.hilla.parser.core.NodePath;
import com.vaadin.hilla.parser.core.Plugin;
import com.vaadin.hilla.parser.core.PluginConfiguration;
import com.vaadin.hilla.parser.models.ClassInfoModel;
import com.vaadin.hilla.parser.models.ClassRefSignatureModel;
import com.vaadin.hilla.parser.models.SignatureModel;
import com.vaadin.hilla.parser.plugins.backbone.BackbonePlugin;
import com.vaadin.hilla.parser.plugins.backbone.nodes.TypedNode;
import com.vaadin.hilla.runtime.transfertypes.EndpointSubscription;
import com.vaadin.hilla.runtime.transfertypes.File;
import com.vaadin.hilla.runtime.transfertypes.Flux;

public final class TransferTypesPlugin
        extends AbstractPlugin<PluginConfiguration> {
    static private final Map<String, Class<?>> classMap = new HashMap<>();

    static {
        classMap.put("org.springframework.data.domain.Page", List.class);
        classMap.put("org.springframework.data.domain.Pageable",
                Pageable.class);
        classMap.put("org.springframework.data.domain.Sort$Order", Order.class);
        classMap.put("org.springframework.data.domain.Sort", Sort.class);
        classMap.put(UUID.class.getName(), String.class);
        classMap.put("reactor.core.publisher.Flux", Flux.class);
        classMap.put("com.vaadin.hilla.EndpointSubscription",
                EndpointSubscription.class);
        classMap.put(JsonNode.class.getName(), Object.class);
        classMap.put(ObjectNode.class.getName(), Object.class);
        classMap.put(ArrayNode.class.getName(), List.class);
        classMap.put("org.springframework.web.multipart.MultipartFile",
                File.class);
    }

    public TransferTypesPlugin() {
        super();
    }

    @Override
    public void enter(NodePath<?> nodePath) {
    }

    @Override
    public void exit(NodePath<?> nodePath) {
    }

    @Override
    public Collection<Class<? extends Plugin>> getRequiredPlugins() {
        return List.of(BackbonePlugin.class);
    }

    @NonNull
    @Override
    public NodeDependencies scan(@NonNull NodeDependencies nodeDependencies) {
        return nodeDependencies.processChildNodes(this::processNodes)
                .processRelatedNodes(this::processNodes);
    }

    private Node<?, ?> mapClassRefNodes(Node<?, ?> node) {
        if (!(node instanceof TypedNode)) {
            return node;
        }

        return (Node<?, ?>) ((TypedNode) node).processType(this::processType);
    }

    private Stream<Node<?, ?>> processNodes(Stream<Node<?, ?>> nodes) {
        return nodes.map(this::mapClassRefNodes);
    }

    private SignatureModel processType(SignatureModel signature) {
        if (!(signature instanceof ClassRefSignatureModel)) {
            return signature;
        }

        var classRef = (ClassRefSignatureModel) signature;
        var className = classRef.getClassInfo().getName();
        if (!classMap.containsKey(className)) {
            return signature;
        }

        var mappedClassInfo = ClassInfoModel.of(classMap.get(className));
        return ClassRefSignatureModel.of(mappedClassInfo,
                classRef.getTypeArguments(), classRef.getAnnotations());
    }
}
