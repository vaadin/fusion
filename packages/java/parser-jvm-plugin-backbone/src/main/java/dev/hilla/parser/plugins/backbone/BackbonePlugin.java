package dev.hilla.parser.plugins.backbone;

import java.util.Collection;

import javax.annotation.Nonnull;

import dev.hilla.parser.core.Plugin;
import dev.hilla.parser.core.RelativeClassInfo;
import dev.hilla.parser.core.SharedStorage;

public final class BackbonePlugin implements Plugin {
    private int order = 0;

    @Override
    public void execute(@Nonnull Collection<RelativeClassInfo> endpoints,
            @Nonnull Collection<RelativeClassInfo> entities,
            @Nonnull SharedStorage storage) {
        var model = storage.getOpenAPI();
        var context = new Context(storage.getAssociationMap());

        new EndpointProcessor(endpoints, model, context).process();
        new EntityProcessor(entities, model, context).process();
    }

    @Override
    public int getOrder() {
        return order;
    }

    @Override
    public void setOrder(int order) {
        this.order = order;
    }
}
