package com.vaadin.fusion.parser.core;

import java.util.Objects;
import java.util.Optional;

abstract class AbstractRelative<T, P extends Relative<?>> implements Relative<P> {
    protected final T origin;
    protected final P parent;

    public AbstractRelative(T origin, P parent) {
        this.origin = origin;
        this.parent = parent;
    }

    @Override
    public T get() {
        return origin;
    }

    @Override
    public Optional<P> getParent() {
        return Optional.of(parent);
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }

        if (!(other instanceof AbstractRelative<?, ?>)) {
            return false;
        }

        return Objects.equals(origin,
            ((AbstractRelative<?, ?>) other).origin);
    }

    @Override
    public int hashCode() {
        return origin.hashCode();
    }
}
