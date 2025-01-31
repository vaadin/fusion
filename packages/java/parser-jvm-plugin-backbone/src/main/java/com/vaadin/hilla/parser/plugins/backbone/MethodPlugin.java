package com.vaadin.hilla.parser.plugins.backbone;

import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.jspecify.annotations.NonNull;

import com.vaadin.hilla.parser.core.AbstractPlugin;
import com.vaadin.hilla.parser.core.Node;
import com.vaadin.hilla.parser.core.NodeDependencies;
import com.vaadin.hilla.parser.core.NodePath;
import com.vaadin.hilla.parser.core.RootNode;
import com.vaadin.hilla.parser.models.ClassInfoModel;
import com.vaadin.hilla.parser.models.MethodInfoModel;
import com.vaadin.hilla.parser.plugins.backbone.nodes.EndpointExposedNode;
import com.vaadin.hilla.parser.plugins.backbone.nodes.EndpointNode;
import com.vaadin.hilla.parser.plugins.backbone.nodes.MethodNode;

import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;

public final class MethodPlugin
        extends AbstractPlugin<BackbonePluginConfiguration> {
    public static final String MEDIA_TYPE = "application/json";

    @Override
    public void enter(NodePath<?> nodePath) {
        if (!(nodePath.getNode() instanceof MethodNode)) {
            return;
        }

        var methodNode = (MethodNode) nodePath.getNode();

        var endpointParent = findClosestEndpoint(nodePath);
        if (endpointParent.isEmpty()) {
            return;
        }

        var endpointNode = (EndpointNode) endpointParent.get();

        if (methodNode.getTarget().getPost() != null) {
            throw new IllegalStateException("Post for method " + methodNode
                    + " in endpoint " + endpointNode + " is already set");
        }
        methodNode.getTarget().post(createOperation(endpointNode, methodNode));
    }

    @Override
    public void exit(NodePath<?> nodePath) {
        if (!(nodePath.getNode() instanceof MethodNode)) {
            return;
        }

        var methodNode = (MethodNode) nodePath.getNode();

        var endpointParent = findClosestEndpoint(nodePath);
        if (endpointParent.isEmpty()) {
            return;
        }

        var endpointNode = (EndpointNode) endpointParent.get();

        var endpointName = endpointNode.getTarget().getName();
        var methodName = methodNode.getSource().getName();

        var rootNode = (RootNode) nodePath.getRootPath().getNode();
        rootNode.getTarget().path("/" + endpointName + "/" + methodName,
                methodNode.getTarget());
        // The class name is needed to map the endpoint to its implementation at
        // runtime
        endpointNode.getTarget().addExtension("x-class-name",
                endpointNode.getSource().getName());
    }

    @NonNull
    @Override
    public NodeDependencies scan(@NonNull NodeDependencies nodeDependencies) {
        var node = nodeDependencies.getNode();
        if (node instanceof EndpointNode
                || node instanceof EndpointExposedNode) {
            var endpointCls = (ClassInfoModel) node.getSource();
            var methodNodes = endpointCls.getMethods().stream()
                    .filter(MethodInfoModel::isPublic)
                    .collect(Collectors.toMap(MethodInfoModel::getName,
                            Function.identity(), (m1, m2) -> {
                                throw new BackbonePluginException(String.format(
                                        "Overloaded methods are not supported (method '%s' in class '%s')",
                                        m1.getName(), endpointCls.getName()));
                            }))
                    .values().stream().<Node<?, ?>> map(MethodNode::of);
            return nodeDependencies.appendChildNodes(methodNodes);
        }

        return nodeDependencies;
    }

    private Operation createOperation(EndpointNode endpointNode,
            MethodNode methodNode) {
        var operation = new Operation();

        var endpointName = endpointNode.getTarget().getName();

        operation
                .operationId(String.format("%s_%s_POST", endpointName,
                        methodNode.getSource().getName()))
                .addTagsItem(endpointName).responses(createResponses());

        return operation;
    }

    private ApiResponses createResponses() {
        var response = new ApiResponse().description("");
        return new ApiResponses().addApiResponse("200", response);
    }

    private Optional<Node<?, ?>> findClosestEndpoint(NodePath<?> nodePath) {
        return nodePath.getParentPath().stream()
                .<Node<?, ?>> map(NodePath::getNode)
                .filter(n -> n instanceof EndpointNode).findFirst();
    }
}
