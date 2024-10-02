package com.vaadin.hilla.signals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.vaadin.hilla.signals.core.event.ListStateEvent;
import com.vaadin.hilla.signals.core.event.StateEvent;
import com.vaadin.hilla.signals.core.event.MissingFieldException;
import jakarta.annotation.Nullable;
import org.junit.Assert;
import org.junit.Test;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertThrows;

import static com.vaadin.hilla.signals.core.event.ListStateEvent.InsertPosition;
import static com.vaadin.hilla.signals.core.event.ListStateEvent.ListEntry;
import static org.junit.Assert.assertTrue;

public class ListSignalTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final class Entry<V> implements ListEntry<V> {
        private final UUID id;
        private UUID prev;
        private UUID next;
        private final ValueSignal<V> value;

        public Entry(UUID id, @Nullable UUID prev, @Nullable UUID next, V value,
                Class<V> valueType) {
            this.id = id;
            this.prev = prev;
            this.next = next;
            this.value = new ValueSignal<V>(value, valueType);
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

    @Test
    public void constructor_withNullArgs_doesNotAcceptNull() {
        assertThrows(NullPointerException.class, () -> new ListSignal<>(null));
    }

    @Test
    public void getId_returns_not_null() {
        var listSignal = new ListSignal<>(String.class);
        assertNotNull(listSignal.getId());
    }

    @Test
    public void subscribe_returns_flux_withJsonEvents() {
        var signal = new ListSignal<>(Person.class);

        var flux = signal.subscribe();

        flux.subscribe(Assert::assertNotNull);
    }

    @Test
    public void subscribe_toAnEntry_returns_flux_withJsonEvents() {
        var listSignal = new ListSignal<>(Person.class);
        var listFlux = listSignal.subscribe();

        var entryIds = new ArrayList<String>();
        var counter = new AtomicInteger(0);
        listFlux.subscribe(eventJson -> {
            // skip the initial state notification when counter is 0
            if (counter.get() == 1) {
                assertTrue(isAccepted(eventJson));
                entryIds.add(extractEntryId(eventJson));
            }
            counter.incrementAndGet();
        });
        var evt = createInsertEvent(new Person("John", 42, true),
                InsertPosition.LAST);
        listSignal.submit(evt);
        assertEquals(2, counter.get());

        var entryFlux = listSignal.subscribe(entryIds.get(0));
        entryFlux.subscribe(Assert::assertNotNull);
    }

    @Test
    public void submit_notifies_subscribers_whenInsertingAtLast() {
        var signal = new ListSignal<>(Person.class);
        Flux<ObjectNode> flux = signal.subscribe();

        var name = "John";
        var age = 42;
        var adult = true;

        var counter = new AtomicInteger(0);
        flux.subscribe(eventJson -> {
            assertNotNull(eventJson);

            if (counter.get() == 0) {
                // notification for the initial state
                var entries = extractEntries(eventJson, Person.class,
                        Entry::new);
                assertEquals(0, entries.size());
            } else if (counter.get() == 1) {
                assertTrue(isAccepted(eventJson));
            }
            counter.incrementAndGet();
        });

        var evt = createInsertEvent(new Person(name, age, adult),
                InsertPosition.LAST);
        signal.submit(evt);

        assertEquals(2, counter.get());

        var entries = extractEntries(signal.createSnapshotEvent(), Person.class,
                Entry::new);
        assertEquals(1, entries.size());
        var entry = entries.get(0);
        assertEquals(name, entry.value().getName());
        assertEquals(age, entry.value().getAge());
        assertEquals(adult, entry.value().isAdult());
    }

    @Test
    public void submit_setEvent_toAnEntry_notifies_subscribersToTheEntry_withCorrectEvents() {
        var listSignal = new ListSignal<>(Person.class);
        var listFlux = listSignal.subscribe();

        var entryIds = new ArrayList<String>();
        var counter = new AtomicInteger(0);
        listFlux.subscribe(eventJson -> {
            // skip the initial state notification when counter is 0
            if (counter.get() > 0) {
                assertTrue(isAccepted(eventJson));
                entryIds.add(extractEntryId(eventJson));
            }
            counter.incrementAndGet();
        });
        var evt = createInsertEvent(new Person("John", 42, true),
                InsertPosition.LAST);
        listSignal.submit(evt);
        var evt2 = createInsertEvent(new Person("Smith", 44, true),
                InsertPosition.LAST);
        listSignal.submit(evt2);

        assertEquals(3, counter.get());

        var entries = extractEntries(listSignal.createSnapshotEvent(),
                Person.class, Entry::new);
        var linkedList = buildLinkedList(entries);
        assertEquals(2, linkedList.size());
        var entry1 = linkedList.get(0);
        assertEquals("John", entry1.value().getName());
        assertEquals(42, entry1.value().getAge());
        assertTrue(entry1.value().isAdult());

        var entryFlux = listSignal.subscribe(entryIds.get(0));
        var entryCounter = new AtomicInteger(0);
        entryFlux.subscribe(eventJson -> {
            // skip the initial state notification when counter is 0
            if (entryCounter.get() == 1) {
                assertEquals(StateEvent.EventType.SET.name().toLowerCase(),
                        eventJson.get(StateEvent.Field.TYPE).asText());
                assertTrue(isAccepted(eventJson));
            }
            entryCounter.incrementAndGet();
        });
        var setEvent = createSetEvent(new Person("Jane", 13, false),
                entryIds.get(0));
        listSignal.submit(setEvent);
        assertEquals(2, entryCounter.get());

        entries = extractEntries(listSignal.createSnapshotEvent(), Person.class,
                Entry::new);
        linkedList = buildLinkedList(entries);
        assertEquals(2, linkedList.size());
        var sameEntry1 = linkedList.get(0);
        assertEquals("Jane", sameEntry1.value().getName());
        assertEquals(13, sameEntry1.value().getAge());
        assertFalse(sameEntry1.value().isAdult());
        var secondEntry = linkedList.get(1);
        assertEquals("Smith", secondEntry.value().getName());
        assertEquals(44, secondEntry.value().getAge());
        assertTrue(secondEntry.value().isAdult());

        assertEquals(entry1.id(), sameEntry1.id());
        assertEquals(entryIds.get(1), secondEntry.id().toString());

        // No change is expected in the list signal itself:
        assertEquals(3, counter.get());
    }

    @Test
    public void submit_replaceEvent_toAnEntry_notifies_subscribersToTheEntry_withCorrectEvents() {
        var listSignal = new ListSignal<>(Person.class);
        var listFlux = listSignal.subscribe();

        var entryIds = new ArrayList<String>();
        var counter = new AtomicInteger(0);
        listFlux.subscribe(eventJson -> {
            // skip the initial state notification when counter is 0
            if (counter.get() > 0) {
                assertTrue(isAccepted(eventJson));
                entryIds.add(extractEntryId(eventJson));
            }
            counter.incrementAndGet();
        });
        var evt = createInsertEvent(new Person("John", 42, true),
                InsertPosition.LAST);
        listSignal.submit(evt);
        var evt2 = createInsertEvent(new Person("Smith", 44, true),
                InsertPosition.LAST);
        listSignal.submit(evt2);

        assertEquals(3, counter.get());

        var entries = extractEntries(listSignal.createSnapshotEvent(),
                Person.class, Entry::new);
        var linkedList = buildLinkedList(entries);
        assertEquals(2, linkedList.size());
        var entry2 = linkedList.get(1);
        assertEquals("Smith", entry2.value().getName());
        assertEquals(44, entry2.value().getAge());
        assertTrue(entry2.value().isAdult());

        var entryFlux = listSignal.subscribe(entryIds.get(1));
        var entryCounter = new AtomicInteger(0);
        entryFlux.subscribe(eventJson -> {
            // skip the initial state notification when counter is 0
            if (entryCounter.get() == 1) {
                assertEquals(StateEvent.EventType.REPLACE.name().toLowerCase(),
                        eventJson.get(StateEvent.Field.TYPE).asText());
                assertTrue(isAccepted(eventJson));
            }
            entryCounter.incrementAndGet();
        });
        var replaceEvent = createReplaceEvent(new Person("Smith", 44, true),
                new Person("Jane", 13, false), entryIds.get(1));
        listSignal.submit(replaceEvent);
        assertEquals(2, entryCounter.get());

        entries = extractEntries(listSignal.createSnapshotEvent(), Person.class,
                Entry::new);
        linkedList = buildLinkedList(entries);
        assertEquals(2, linkedList.size());
        var entry1 = linkedList.get(0);
        assertEquals("John", entry1.value().getName());
        assertEquals(42, entry1.value().getAge());
        assertTrue(entry1.value().isAdult());
        var secondEntry = linkedList.get(1);
        assertEquals("Jane", secondEntry.value().getName());
        assertEquals(13, secondEntry.value().getAge());
        assertFalse(secondEntry.value().isAdult());

        assertEquals(entry2.id(), secondEntry.id());
        assertEquals(entryIds.get(1), secondEntry.id().toString());

        // No change is expected in the list signal itself:
        assertEquals(3, counter.get());
    }

    @Test
    public void submit_willThrow_when_insertingAtPositionsOtherThanLast() {
        var signal = new ListSignal<>(Person.class);

        var name = "John";
        var age = 42;
        var adult = true;

        var person = new Person(name, age, adult);

        assertThrows(UnsupportedOperationException.class, () -> signal
                .submit(createInsertEvent(person, InsertPosition.FIRST)));
        assertThrows(UnsupportedOperationException.class, () -> signal
                .submit(createInsertEvent(person, InsertPosition.BEFORE)));
        assertThrows(UnsupportedOperationException.class, () -> signal
                .submit(createInsertEvent(person, InsertPosition.AFTER)));
    }

    @Test
    public void submit_many_insertLastEvents_notifiesSubscribersWithCorrectStateChanges() {
        var signal = new ListSignal<>(Person.class);
        Flux<ObjectNode> flux = signal.subscribe();

        var name = "John";
        var age = 42;
        var adult = true;

        var counter = new AtomicInteger(0);
        flux.subscribe(eventJson -> {
            assertNotNull(eventJson);
            if (counter.get() == 0) {
                // notification for the initial state
                var entries = extractEntries(eventJson, Person.class,
                        Entry::new);
                assertEquals(0, entries.size());
                // check snapshot events to also marked as accepted
                assertTrue(isAccepted(eventJson));
            } else {
                assertTrue(isAccepted(eventJson));
            }
            counter.incrementAndGet();
        });

        IntStream.of(1, 2, 3, 4, 5).forEach(i -> {
            var evt = createInsertEvent(new Person(name + i, age + i, adult),
                    InsertPosition.LAST);
            signal.submit(evt);
        });
        assertEquals(6, counter.get());

        var snapshot = extractEntries(signal.createSnapshotEvent(),
                Person.class, Entry::new);
        var linkedList = buildLinkedList(snapshot);
        assertEquals(5, linkedList.size());

        for (int i = 0; i < linkedList.size(); i++) {
            var entry = linkedList.get(i);
            assertEquals(name + (i + 1), entry.value().getName());
            assertEquals(age + (i + 1), entry.value().getAge());
            if (i < linkedList.size() - 1) {
                var nextEntry = linkedList.get(i + 1);
                assertEquals(entry.id(), nextEntry.previous());
                assertEquals(entry.next(), nextEntry.id());
            }
        }
    }

    @Test
    public void submit_remove_notifiesWithCorrectStateChanges() {
        var signal = new ListSignal<>(Person.class);
        Flux<ObjectNode> flux = signal.subscribe();

        var name = "John";
        var age = 42;
        var adult = true;

        var counter = new AtomicInteger(0);
        flux.subscribe(eventJson -> {
            assertNotNull(eventJson);
            if (counter.get() > 0) {
                assertTrue(isAccepted(eventJson));
            }
            counter.incrementAndGet();
        });

        var person1 = new Person(name, age, adult);
        var person2 = new Person(name + 2, age + 2, adult);
        var person3 = new Person(name + 3, age + 3, adult);

        var insert1 = createInsertEvent(person1, InsertPosition.LAST);
        var insert2 = createInsertEvent(person2, InsertPosition.LAST);
        var insert3 = createInsertEvent(person3, InsertPosition.LAST);

        signal.submit(insert1);
        signal.submit(insert2);
        signal.submit(insert3);

        var receivedEntries = extractEntries(signal.createSnapshotEvent(),
                Person.class, Entry::new);
        var linkedList = buildLinkedList(receivedEntries);
        assertEquals(3, linkedList.size());

        var entry2 = linkedList.get(1);
        var removeEvent = createRemoveEvent(entry2);
        signal.submit(removeEvent);

        assertEquals(5, counter.get());

        receivedEntries = extractEntries(signal.createSnapshotEvent(),
                Person.class, Entry::new);
        linkedList = buildLinkedList(receivedEntries);
        assertEquals(2, linkedList.size());

        var entry1 = linkedList.get(0);
        var entry3 = linkedList.get(1);

        assertEquals(person1.getName(), entry1.value().getName());
        assertEquals(person1.getAge(), entry1.value().getAge());
        assertEquals(person3.getName(), entry3.value().getName());
        assertEquals(person3.getAge(), entry3.value().getAge());
    }

    @Test
    public void submit_remove_notifiesWithCorrectStateChanges_whenRemovingTheOnlyEntry() {
        var signal = new ListSignal<>(Person.class);
        Flux<ObjectNode> flux = signal.subscribe();

        var name = "John";
        var age = 42;
        var adult = true;

        flux.subscribe(eventJson -> {
            assertNotNull(eventJson);
            isAccepted(eventJson);
        });

        var person1 = new Person(name, age, adult);
        var insert1 = createInsertEvent(person1, InsertPosition.LAST);
        signal.submit(insert1);

        var receivedEntries = extractEntries(signal.createSnapshotEvent(),
                Person.class, Entry::new);
        var linkedList = buildLinkedList(receivedEntries);
        assertEquals(1, linkedList.size());

        var entry1 = linkedList.get(0);
        var removeEvent = createRemoveEvent(entry1);
        signal.submit(removeEvent);

        receivedEntries = extractEntries(signal.createSnapshotEvent(),
                Person.class, Entry::new);
        assertEquals(0, receivedEntries.size());
    }

    @Test
    public void submit_remove_notifiesWithCorrectStateChanges_whenRemovingTheHead() {
        var signal = new ListSignal<>(Person.class);
        Flux<ObjectNode> flux = signal.subscribe();

        var name = "John";
        var age = 42;
        var adult = true;

        flux.subscribe(eventJson -> {
            assertNotNull(eventJson);
            isAccepted(eventJson);
        });

        var person1 = new Person(name, age, adult);
        var person2 = new Person(name + 2, age + 2, adult);
        var insert1 = createInsertEvent(person1, InsertPosition.LAST);
        var insert2 = createInsertEvent(person2, InsertPosition.LAST);
        signal.submit(insert1);
        signal.submit(insert2);

        var receivedEntries = extractEntries(signal.createSnapshotEvent(),
                Person.class, Entry::new);
        var linkedList = buildLinkedList(receivedEntries);
        assertEquals(2, linkedList.size());

        var head = linkedList.get(0);
        var removeEvent = createRemoveEvent(head);
        signal.submit(removeEvent);

        receivedEntries = extractEntries(signal.createSnapshotEvent(),
                Person.class, Entry::new);
        linkedList = buildLinkedList(receivedEntries);
        assertEquals(1, linkedList.size());

        var entry2 = linkedList.get(0);
        assertEquals(person2.getName(), entry2.value().getName());
        assertEquals(person2.getAge(), entry2.value().getAge());

        var person3 = new Person(name + 4, age + 4, adult);
        var insert3 = createInsertEvent(person3, InsertPosition.LAST);
        signal.submit(insert3);

        receivedEntries = extractEntries(signal.createSnapshotEvent(),
                Person.class, Entry::new);
        linkedList = buildLinkedList(receivedEntries);
        assertEquals(2, linkedList.size());
        var newHead = linkedList.get(0);
        assertEquals(person2.getName(), newHead.value().getName());
        assertEquals(person2.getAge(), newHead.value().getAge());
    }

    @Test
    public void submit_remove_notifiesWithCorrectStateChanges_whenRemovingTheTail() {
        var signal = new ListSignal<>(Person.class);
        Flux<ObjectNode> flux = signal.subscribe();

        var name = "John";
        var age = 42;
        var adult = true;

        flux.subscribe(eventJson -> {
            assertNotNull(eventJson);
            isAccepted(eventJson);
        });

        var person1 = new Person(name, age, adult);
        var person2 = new Person(name + 2, age + 2, adult);
        var insert1 = createInsertEvent(person1, InsertPosition.LAST);
        var insert2 = createInsertEvent(person2, InsertPosition.LAST);
        signal.submit(insert1);
        signal.submit(insert2);

        var receivedEntries = extractEntries(signal.createSnapshotEvent(),
                Person.class, Entry::new);
        var linkedList = buildLinkedList(receivedEntries);
        assertEquals(2, linkedList.size());

        var tail = linkedList.get(1);
        var removeEvent = createRemoveEvent(tail);
        signal.submit(removeEvent);

        receivedEntries = extractEntries(signal.createSnapshotEvent(),
                Person.class, Entry::new);
        linkedList = buildLinkedList(receivedEntries);
        assertEquals(1, linkedList.size());

        var head = linkedList.get(0);
        assertEquals(person1.getName(), head.value().getName());
        assertEquals(person1.getAge(), head.value().getAge());

        // insert the second person again
        signal.submit(insert2);

        var person3 = new Person(name + 4, age + 4, adult);
        var insert3 = createInsertEvent(person3, InsertPosition.LAST);
        signal.submit(insert3);

        receivedEntries = extractEntries(signal.createSnapshotEvent(),
                Person.class, Entry::new);
        linkedList = buildLinkedList(receivedEntries);
        tail = linkedList.get(2);
        removeEvent = createRemoveEvent(tail);
        signal.submit(removeEvent);

        receivedEntries = extractEntries(signal.createSnapshotEvent(),
                Person.class, Entry::new);
        linkedList = buildLinkedList(receivedEntries);
        var newTail = linkedList.get(1);
        assertEquals(person2.getName(), newTail.value().getName());
        assertEquals(person2.getAge(), newTail.value().getAge());
    }

    @Test
    public void submit_various_insert_and_remove_notifiesWithCorrectStateChanges() {
        var signal = new ListSignal<>(Person.class);
        Flux<ObjectNode> flux = signal.subscribe();

        var name = "John";
        var age = 42;
        var adult = true;

        flux.subscribe(eventJson -> {
            assertNotNull(eventJson);
            isAccepted(eventJson);
        });

        var person1 = new Person(name + 1, age + 1, adult);
        var person2 = new Person(name + 2, age + 2, adult);
        var person3 = new Person(name + 3, age + 3, adult);
        var person4 = new Person(name + 4, age + 4, adult);
        var person5 = new Person(name + 5, age + 5, adult);
        var person6 = new Person(name + 6, age + 6, adult);

        var insert1 = createInsertEvent(person1, InsertPosition.LAST);
        var insert2 = createInsertEvent(person2, InsertPosition.LAST);
        var insert3 = createInsertEvent(person3, InsertPosition.LAST);
        var insert4 = createInsertEvent(person4, InsertPosition.LAST);
        var insert5 = createInsertEvent(person5, InsertPosition.LAST);
        var insert6 = createInsertEvent(person6, InsertPosition.LAST);

        signal.submit(insert1);
        signal.submit(insert2);
        signal.submit(insert3);
        signal.submit(insert4);
        signal.submit(insert5);

        var receivedEntries = extractEntries(signal.createSnapshotEvent(),
                Person.class, Entry::new);
        var linkedList = buildLinkedList(receivedEntries);
        assertEquals(5, linkedList.size());

        var entry1 = linkedList.get(0);
        var entry2 = linkedList.get(1);
        var entry3 = linkedList.get(2);
        var entry4 = linkedList.get(3);
        var entry5 = linkedList.get(4);

        signal.submit(createRemoveEvent(entry2));
        signal.submit(createRemoveEvent(entry4));

        signal.submit(insert6);

        signal.submit(createRemoveEvent(entry5));

        receivedEntries = extractEntries(signal.createSnapshotEvent(),
                Person.class, Entry::new);
        linkedList = buildLinkedList(receivedEntries);
        assertEquals(3, linkedList.size());

        var entry6 = linkedList.get(2);

        signal.submit(insert2);
        signal.submit(insert4);

        signal.submit(createRemoveEvent(entry1));
        signal.submit(createRemoveEvent(entry3));
        signal.submit(createRemoveEvent(entry6));

        receivedEntries = extractEntries(signal.createSnapshotEvent(),
                Person.class, Entry::new);
        linkedList = buildLinkedList(receivedEntries);
        assertEquals(2, linkedList.size());

        assertEquals(person2.getName(), linkedList.get(0).value().getName());
        assertEquals(person4.getName(), linkedList.get(1).value().getName());

        signal.submit(createRemoveEvent(linkedList.get(0)));
        signal.submit(createRemoveEvent(linkedList.get(1)));

        receivedEntries = extractEntries(signal.createSnapshotEvent(),
                Person.class, Entry::new);
        assertEquals(0, receivedEntries.size());

        signal.submit(insert6);
        signal.submit(insert5);
        signal.submit(insert4);
        signal.submit(insert3);
        signal.submit(insert2);
        signal.submit(insert1);

        receivedEntries = extractEntries(signal.createSnapshotEvent(),
                Person.class, Entry::new);
        linkedList = buildLinkedList(receivedEntries);
        assertEquals(6, linkedList.size());

        for (int i = linkedList.size(); i > 0; i--) {
            var entry = linkedList.get(6 - i);
            assertEquals(name + i, entry.value().getName());
            assertEquals(age + i, entry.value().getAge());
        }
    }

    private <T> ObjectNode createInsertEvent(T value, InsertPosition position) {
        return new ListStateEvent<>(UUID.randomUUID().toString(),
                ListStateEvent.EventType.INSERT, value, position).toJson();
    }

    private <T> ObjectNode createRemoveEvent(ListEntry<T> toRemove) {
        ObjectNode event = MAPPER.createObjectNode();
        event.put(StateEvent.Field.ID, UUID.randomUUID().toString());
        event.put(StateEvent.Field.TYPE,
                ListStateEvent.EventType.REMOVE.name().toLowerCase());
        event.put(ListStateEvent.Field.ENTRY_ID, toRemove.id().toString());
        return event;
    }

    private <T> ObjectNode createSetEvent(T value, String entryId) {
        var setEvent = new StateEvent<>(entryId, StateEvent.EventType.SET,
                value);
        return setEvent.toJson();
    }

    private <T> ObjectNode createReplaceEvent(T expectedValue, T value,
            String entryId) {
        var setEvent = new StateEvent<>(entryId, StateEvent.EventType.REPLACE,
                value, expectedValue);
        return setEvent.toJson();
    }

    private <V> List<ListStateEvent.ListEntry<V>> buildLinkedList(
            Collection<ListStateEvent.ListEntry<V>> entries) {
        Map<UUID, ListStateEvent.ListEntry<V>> entryMap = new HashMap<>();
        // Populate the map with entries, using their id as the key
        for (ListStateEvent.ListEntry<V> entry : entries) {
            entryMap.put(entry.id(), entry);
        }

        // Find the starting entry (where previous is null or a specific UUID
        // indicating the start)
        ListStateEvent.ListEntry<V> start = null;
        for (ListStateEvent.ListEntry<V> entry : entries) {
            if (entry.previous() == null) {
                start = entry;
                break;
            }
        }
        if (start == null) {
            throw new IllegalArgumentException(
                    "No head entry found (entry with previous == null).");
        }

        // Traverse and build the linked list
        List<ListStateEvent.ListEntry<V>> linkedList = new ArrayList<>();
        ListStateEvent.ListEntry<V> current = start;
        while (current != null) {
            linkedList.add(current);
            current = entryMap.get(current.next());
        }
        return linkedList;
    }

    private static <X> List<ListEntry<X>> extractEntries(JsonNode json,
            Class<X> valueType,
            ListStateEvent.ListEntryFactory<X> entryFactory) {
        var rawEntries = json.get(ListStateEvent.Field.ENTRIES);
        if (rawEntries == null) {
            throw new MissingFieldException(ListStateEvent.Field.ENTRIES);
        }
        List<ListEntry<X>> entries = new ArrayList<>();
        for (JsonNode rawEntry : rawEntries) {
            var id = extractOrGenerateId(rawEntry);
            var next = extractUUIDOrNull(rawEntry, ListStateEvent.Field.NEXT);
            var prev = extractUUIDOrNull(rawEntry, ListStateEvent.Field.PREV);
            var value = StateEvent.convertValue(
                    StateEvent.extractValue(rawEntry, true), valueType);
            entries.add(entryFactory.create(id, prev, next, value, valueType));
        }
        return entries;
    }

    private static UUID extractOrGenerateId(JsonNode rawEntry) {
        var id = rawEntry.get(StateEvent.Field.ID);
        if (id == null) {
            return UUID.randomUUID();
        }
        return UUID.fromString(id.asText());
    }

    private static UUID extractUUIDOrNull(JsonNode json, String fieldName) {
        var rawId = json.get(fieldName);
        return rawId == null ? null : UUID.fromString(rawId.asText());
    }

    private static boolean isAccepted(ObjectNode event) {
        return event.has(StateEvent.Field.ACCEPTED)
                && event.get(StateEvent.Field.ACCEPTED).asBoolean();
    }

    private static String extractEntryId(JsonNode json) {
        var entryId = json.get(ListStateEvent.Field.ENTRY_ID);
        return entryId == null ? null : entryId.asText();
    }
}
