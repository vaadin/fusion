package dev.hilla.parser.models;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

import io.github.classgraph.TypeArgument;

final class TypeArgumentSourceModel
        extends TypeArgumentAbstractModel<TypeArgument>
        implements SourceSignatureModel {
    TypeArgumentSourceModel(TypeArgument origin) {
        super(origin);
    }

    @Override
    public TypeArgument.Wildcard getWildcard() {
        return origin.getWildcard();
    }

    @Override
    protected List<AnnotationInfoModel> prepareAnnotations() {
        return getAssociatedTypes().stream()
                .flatMap(SignatureModel::getAnnotationsStream)
                .collect(Collectors.toList());
    }

    @Override
    protected List<SignatureModel> prepareAssociatedTypes() {
        var signature = origin.getTypeSignature();

        return signature == null ? Collections.emptyList()
                : List.of(SignatureModel.of(signature));
    }
}
