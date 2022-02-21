package dev.hilla.parser.models;

import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

final class MethodInfoReflectionModel extends AbstractModel<Method>
        implements MethodInfoModel, ReflectionModel {
    private List<AnnotationInfoModel> annotations;
    private List<MethodParameterInfoModel> parameters;
    private SignatureModel resultType;

    public MethodInfoReflectionModel(Method method, Model parent) {
        super(method, parent);
    }

    @Override
    public List<AnnotationInfoModel> getAnnotations() {
        if (annotations == null) {
            annotations = Arrays.stream(origin.getAnnotations())
                    .map(annotation -> AnnotationInfoModel.of(annotation, this))
                    .collect(Collectors.toList());
        }

        return annotations;
    }

    @Override
    public String getName() {
        return origin.getName();
    }

    @Override
    public boolean isPublic() {
        return Modifier.isPublic(origin.getModifiers());
    }

    @Override
    public boolean isPrivate() {
        return Modifier.isPrivate(origin.getModifiers());
    }

    @Override
    public boolean isProtected() {
        return Modifier.isProtected(origin.getModifiers());
    }

    @Override
    public boolean isStatic() {
        return Modifier.isStatic(origin.getModifiers());
    }

    @Override
    public boolean isFinal() {
        return Modifier.isFinal(origin.getModifiers());
    }

    @Override
    public boolean isSynchronized() {
        return Modifier.isSynchronized(origin.getModifiers());
    }

    @Override
    public boolean isBridge() {
        return origin.isBridge();
    }

    @Override
    public boolean isSynthetic() {
        return origin.isSynthetic();
    }

    @Override
    public boolean isVarArgs() {
        return origin.isVarArgs();
    }

    @Override
    public boolean isNative() {
        return Modifier.isNative(origin.getModifiers());
    }

    @Override
    public boolean isAbstract() {
        return Modifier.isAbstract(origin.getModifiers());
    }

    @Override
    public boolean isStrict() {
        return Modifier.isStrict(origin.getModifiers());
    }

    @Override
    public List<MethodParameterInfoModel> getParameters() {
        if (parameters == null) {
            parameters = Arrays.stream(origin.getParameters()).map(
                    parameter -> MethodParameterInfoModel.of(parameter, this))
                    .collect(Collectors.toList());
        }

        return parameters;
    }

    @Override
    public SignatureModel getResultType() {
        if (resultType == null) {
            resultType = SignatureModel.of(origin.getAnnotatedReturnType(),
                    this);
        }

        return resultType;
    }
}
