/*
 * Copyright 2000-2024 Vaadin Ltd.
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

package com.vaadin.hilla.signals;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.vaadin.hilla.signals.core.event.ListStateEvent;
import com.vaadin.hilla.signals.core.event.StateEvent;
import com.vaadin.hilla.signals.core.event.InvalidEventTypeException;
import com.vaadin.hilla.signals.core.event.MissingFieldException;
import com.vaadin.hilla.signals.operation.ListInsertOperation;
import com.vaadin.hilla.signals.operation.ListRemoveOperation;
import com.vaadin.hilla.signals.operation.OperationValidator;
import com.vaadin.hilla.signals.operation.ReplaceValueOperation;
import com.vaadin.hilla.signals.operation.SetValueOperation;
import com.vaadin.hilla.signals.operation.ValidationResult;
import com.vaadin.hilla.signals.operation.ValueOperation;
import jakarta.annotation.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.Flux;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;

import static com.vaadin.hilla.signals.core.event.ListStateEvent.ListEntry;

public class ListSignal<T> extends Signal<T> {

    private static final class Entry<V> implements ListEntry<V> {
        private final UUID id;
        private UUID prev;
        private UUID next;
        private final ValueSignal<V> value;

        public Entry(UUID id, @Nullable UUID prev, @Nullable UUID next,
                ValueSignal<V> valueSignal) {
            this.id = id;
            this.prev = prev;
            this.next = next;
            this.value = valueSignal;
        }

        public Entry(UUID id, ValueSignal<V> valueSignal) {
            this(id, null, null, valueSignal);
        }

        @Override
        public UUID id() {
            return id;
        }

        @Override
        public UUID previous() {
            return prev;
        }

        @Override
        public UUID next() {
            return next;
        }

        @Override
        public V value() {
            return value.getValue();
        }

        @Override
        public ValueSignal<V> getValueSignal() {
            return value;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o)
                return true;
            if (!(o instanceof ListEntry<?> entry))
                return false;
            return Objects.equals(id, entry.id());
        }

        @Override
        public int hashCode() {
            return Objects.hashCode(id);
        }
    }

    private static final Logger LOGGER = LoggerFactory
            .getLogger(ListSignal.class);
    private final Map<UUID, Entry<T>> entries = new HashMap<>();

    private UUID head;
    private UUID tail;

    public ListSignal(Class<T> valueType) {
        super(valueType);
    }

    protected ListSignal(ListSignal<T> delegate) {
        super(delegate);
    }

    @Override
    protected ListSignal<T> getDelegate() {
        return (ListSignal<T>) super.getDelegate();
    }

    @Override
    public Flux<ObjectNode> subscribe(String signalId) {
        if (getDelegate() != null) {
            return getDelegate().subscribe(signalId);
        }
        var signalEntry = entries.get(UUID.fromString(signalId));
        return signalEntry.value.subscribe();
    }

    @Override
    public void submit(ObjectNode event) {
        var rawEventType = StateEvent.extractRawEventType(event);
        // check if the event is targeting a child signal:
        if (StateEvent.EventType.find(rawEventType).isPresent()) {
            submitToChild(event);
        } else {
            super.submit(event);
        }
    }

    protected void submitToChild(ObjectNode event) {
        if (getDelegate() != null) {
            getDelegate().submitToChild(event);
            return;
        }
        // For internal signals, the signal id is the event id:
        var entryId = StateEvent.extractId(event);
        var signalEntry = entries.get(UUID.fromString(entryId));
        if (signalEntry == null) {
            LOGGER.debug(
                    "Signal entry not found for id: {}. Ignoring the event: {}",
                    entryId, event);
            return;
        }
        signalEntry.value.submit(event);
    }

    @Override
    protected ObjectNode createSnapshotEvent() {
        if (getDelegate() != null) {
            return getDelegate().createSnapshotEvent();
        }
        var entries = this.entries.values().stream()
                .map(entry -> (ListEntry<T>) entry).toList();
        var event = new ListStateEvent<>(getId().toString(),
                ListStateEvent.EventType.SNAPSHOT, entries);
        event.setAccepted(true);
        return event.toJson();
    }

    @Override
    protected ObjectNode processEvent(ObjectNode event) {
        try {
            var stateEvent = new ListStateEvent<>(event, getValueType());
            return switch (stateEvent.getEventType()) {
            case INSERT -> handleInsert(stateEvent).toJson();
            case REMOVE -> handleRemoval(stateEvent).toJson();
            default -> throw new UnsupportedOperationException(
                    "Unsupported event: " + stateEvent.getEventType());
            };
        } catch (InvalidEventTypeException e) {
            throw new UnsupportedOperationException(
                    "Unsupported JSON: " + event, e);
        }
    }

    protected ListStateEvent<T> handleInsert(ListStateEvent<T> event) {
        if (getDelegate() != null) {
            return getDelegate().handleInsert(event);
        }
        if (event.getValue() == null) {
            throw new MissingFieldException(StateEvent.Field.VALUE);
        }
        var toBeInserted = createEntry(event.getValue());
        if (entries.containsKey(toBeInserted.id())) {
            // already exists (the chances of this happening are extremely low)
            LOGGER.warn(
                    "Duplicate UUID generation detected when adding a new entry: {}, rejecting the insert event.",
                    toBeInserted.id());
            event.setAccepted(false);
            return event;
        }
        switch (event.getPosition()) {
        case FIRST -> throw new UnsupportedOperationException(
                "Insert first is not supported");
        case BEFORE -> throw new UnsupportedOperationException(
                "Insert before is not supported");
        case AFTER -> throw new UnsupportedOperationException(
                "Insert after is not supported");
        case LAST -> {
            if (tail == null) {
                // first entry being added:
                head = tail = toBeInserted.id();
            } else {
                var currentTail = entries.get(tail);
                currentTail.next = toBeInserted.id();
                toBeInserted.prev = currentTail.id();
                tail = toBeInserted.id();
            }
            entries.put(toBeInserted.id(), toBeInserted);
            event.setEntryId(toBeInserted.id());
            event.setAccepted(true);
            return event;
        }
        }
        return event;
    }

    private Entry<T> createEntry(T value) {
        return new Entry<>(UUID.randomUUID(), createValueSignal(value));
    }

    private ValueSignal<T> createValueSignal(T value) {
        return new ValueSignal<>(value, getValueType());
    }

    protected ListStateEvent<T> handleRemoval(ListStateEvent<T> event) {
        if (getDelegate() != null) {
            return getDelegate().handleRemoval(event);
        }
        if (event.getEntryId() == null) {
            throw new MissingFieldException(ListStateEvent.Field.ENTRY_ID);
        }
        if (head == null || entries.isEmpty()) {
            event.setAccepted(false);
            return event;
        }
        var toBeRemovedEntry = entries.get(event.getEntryId());
        if (toBeRemovedEntry == null) {
            // no longer exists anyway
            event.setAccepted(true);
            return event;
        }

        if (head.equals(toBeRemovedEntry.id())) {
            // removing head
            if (toBeRemovedEntry.next() == null) {
                // removing the only entry
                head = tail = null;
            } else {
                var newHead = entries.get(toBeRemovedEntry.next());
                head = newHead.id();
                newHead.prev = null;
            }
        } else {
            var prev = entries.get(toBeRemovedEntry.previous());
            var next = entries.get(toBeRemovedEntry.next());
            if (next == null) {
                // removing tail
                tail = prev.id();
                prev.next = null;
            } else {
                prev.next = next.id();
                next.prev = prev.id();
            }
        }
        entries.remove(toBeRemovedEntry.id());

        event.setAccepted(true);
        return event;
    }

    protected ListEntry<T> getEntry(UUID entryId) {
        return entries.get(entryId);
    }

    private static class ValidatedListSignal<T> extends ListSignal<T> {

        private final OperationValidator<T> operationValidator;

        private ValidatedListSignal(ListSignal<T> delegate,
                OperationValidator<T> operationValidator) {
            super(delegate);
            this.operationValidator = operationValidator;
        }

        @Override
        protected ListStateEvent<T> handleInsert(ListStateEvent<T> event) {
            var listInsertOperation = new ListInsertOperation<>(event.getId(),
                    event.getPosition(), event.getValue());
            var validationResult = operationValidator
                    .validate(listInsertOperation);
            return handleValidationResult(event, validationResult,
                    super::handleInsert);
        }

        @Override
        protected ListStateEvent<T> handleRemoval(ListStateEvent<T> event) {
            if (event.getEntryId() == null) {
                throw new MissingFieldException(ListStateEvent.Field.ENTRY_ID);
            }
            var entryToRemove = getEntry(event.getEntryId());
            var listRemoveOperation = new ListRemoveOperation<>(event.getId(),
                    entryToRemove);
            var validationResult = operationValidator
                    .validate(listRemoveOperation);
            return handleValidationResult(event, validationResult,
                    super::handleRemoval);
        }

        @Override
        protected void submitToChild(ObjectNode event) {
            // are we interested in this event:
            if (!StateEvent.isSetEvent(event)
                    && !StateEvent.isReplaceEvent(event)) {
                super.submitToChild(event);
                return;
            }

            var valueOperation = extractValueOperation(event);
            var validationResult = operationValidator.validate(valueOperation);
            handleValidationResult(event, validationResult,
                    super::submitToChild);
        }

        private ValueOperation<T> extractValueOperation(ObjectNode event) {
            if (StateEvent.isSetEvent(event)) {
                return SetValueOperation.of(event, getValueType());
            } else if (StateEvent.isReplaceEvent(event)) {
                return ReplaceValueOperation.of(event, getValueType());
            } else {
                throw new UnsupportedOperationException(
                        "Unsupported event: " + event);
            }
        }

        private ListStateEvent<T> handleValidationResult(
                ListStateEvent<T> event, ValidationResult validationResult,
                Function<ListStateEvent<T>, ListStateEvent<T>> handler) {
            if (validationResult.isOk()) {
                return handler.apply(event);
            } else {
                return rejectEvent(event, validationResult);
            }
        }

        private ListStateEvent<T> rejectEvent(ListStateEvent<T> event,
                ValidationResult result) {
            event.setAccepted(false);
            event.setValidationError(result.getErrorMessage());
            return event;
        }

        private void handleValidationResult(ObjectNode event,
                ValidationResult validationResult,
                Consumer<ObjectNode> handler) {
            if (validationResult.isOk()) {
                handler.accept(event);
            } else {
                handler.accept(rejectEvent(event, validationResult));
            }
        }

        private ObjectNode rejectEvent(ObjectNode event,
                ValidationResult result) {
            var stateEvent = new StateEvent<>(event, getValueType());
            stateEvent.setAccepted(false);
            stateEvent.setValidationError(result.getErrorMessage());
            return stateEvent.toJson();
        }
    }

    /**
     * Returns a new signal that validates the operations with the provided
     * validator. As the same validator is for all operations, the validator
     * should be able to handle all operations that the signal supports.
     * <p>
     * For example, the following code creates a signal that disallows adding
     * values containing the word "bad":
     * <!-- @formatter:off -->
     * <pre><code>
     * ListSignal&lt;String&gt; signal = new ListSignal&lt;&gt;(String.class);
     * ListSignal&lt;String&gt; noBadWordSignal = signal.withOperationValidator(op -&gt; {
     *    if (op instanceof ListInsertOperation&lt;String&gt; insertOp &amp;&amp; insertOp.value().contains("bad")) {
     *        return ValidationResult.reject("Bad words are not allowed");
     *    }
     *    return ValidationResult.allow();
     * });
     * </code></pre>
     * <!-- @formatter:on -->
     * In the example above, the validator does not cover the set and replace
     * operations that can affect the entry values after insertion.
     * A similar type checking can be done for the set and replace operation
     * if needed. However, the <code>ValueOperation</code> type allows unifying
     * the validation logic for all the operations that are manipulating the
     * value.
     * The following example shows how to define a validator that covers all the
     * operations that can affect the entry values:
     * <!-- @formatter:off -->
     * <pre><code>
     * ListSignal&lt;String&gt; signal = new ListSignal&lt;&gt;(String.class);
     * ListSignal&lt;String&gt; noBadWordSignal = signal.withOperationValidator(op -&gt; {
     *    if (op instanceof ValueOperation&lt;String&gt; valueOp &amp;&amp; valueOp.value().contains("bad")) {
     *        return ValidationResult.reject("Bad words are not allowed");
     *    }
     *    return ValidationResult.allow();
     * });
     * </code></pre>
     * <!-- @formatter:on -->
     * As <code>ListInsertOperation</code>, <code>SetValueOperation</code>, and
     * <code>ReplaceValueOperation</code> implement the
     * <code>ValueOperation</code>, the validator covers all of these
     * operations.
     *
     * @param validator
     *            the operation validator, not <code>null</code>
     * @return a new signal that validates the operations with the provided
     *         validator
     * @throws NullPointerException
     *             if the validator is <code>null</code>
     */
    public ListSignal<T> withOperationValidator(
            OperationValidator<T> validator) {
        Objects.requireNonNull(validator, "Validator cannot be null");
        return new ValidatedListSignal<>(this, validator);
    }

    @Override
    public ListSignal<T> asReadonly() {
        return this.withOperationValidator(op -> ValidationResult
                .reject("Read-only signal does not allow any modifications"));
    }
}
