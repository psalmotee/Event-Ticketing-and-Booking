import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addTier,
  bookTickets,
  createEvent,
  createStore,
  listEventSummaries,
  publishEvent,
} from '../src/domain/inventory.js';
import { DomainError } from '../src/domain/errors.js';
import { filterEvents, searchEvents, sortEvents } from '../src/domain/eventSearch.js';
import { mergeSort } from '../src/domain/sorting.js';

function errorCode(action) {
  assert.throws(action, (error) => error instanceof DomainError);
  try {
    action();
  } catch (error) {
    return error.code;
  }
  return undefined;
}

function makeSummary(overrides = {}) {
  return {
    id: 'event-1',
    title: 'Lagos Tech Meetup',
    city: 'Lagos',
    venue: 'Civic Hall',
    date: '2026-12-05T17:00:00Z',
    tiers: [{ id: 'tier-1', priceCents: 500000, capacity: 100, available: 10 }],
    ...overrides,
  };
}

test('S02 creates a draft event with a new id and hides it from the public list', () => {
  const store = createStore();
  const event = createEvent(store, {
    title: 'Lagos Tech Meetup', city: 'Lagos', venue: 'Civic Hall', date: '2026-12-05',
  });
  assert.ok(event.id);
  assert.equal(event.published, false);
  assert.deepEqual(listEventSummaries(store), []);
});

test('S02 rejects missing title or city and invalid dates without saving', () => {
  const store = createStore();
  assert.equal(errorCode(() => createEvent(store, {
    city: 'Lagos', venue: 'Civic Hall', date: '2026-12-05',
  })), 'VALIDATION');
  assert.equal(errorCode(() => createEvent(store, {
    title: 'Event', venue: 'Civic Hall', date: '2026-12-05',
  })), 'VALIDATION');
  assert.equal(errorCode(() => createEvent(store, {
    title: 'Event', city: 'Lagos', venue: 'Civic Hall', date: '2026-02-30',
  })), 'VALIDATION');
  assert.equal(store.events.size, 0);
});

test('S03 adds a tier with zero sold and the full capacity available', () => {
  const store = createStore();
  const event = createEvent(store, { name: 'Event' });
  const tier = addTier(store, event.id, { name: 'General', priceCents: 500000, capacity: 100 });
  assert.equal(tier.available, 100);
  assert.equal(tier.capacity - tier.available, 0);
});

test('S03 rejects non-whole prices and capacities below one', () => {
  const store = createStore();
  const event = createEvent(store, { name: 'Event' });
  assert.equal(errorCode(() => addTier(store, event.id, {
    name: 'General', priceCents: 1.5, capacity: 100,
  })), 'VALIDATION');
  assert.equal(errorCode(() => addTier(store, event.id, {
    name: 'General', priceCents: 500000, capacity: 0,
  })), 'VALIDATION');
});

test('S03 rejects a tier for an unknown event', () => {
  const store = createStore();
  assert.equal(errorCode(() => addTier(store, 'missing', {
    name: 'General', priceCents: 500000, capacity: 100,
  })), 'NOT_FOUND');
});

test('S04 publishes a tiered event, rejects empty events, and hides drafts', () => {
  const store = createStore();
  const empty = createEvent(store, { name: 'Empty' });
  const event = createEvent(store, { name: 'Published' });
  addTier(store, event.id, { name: 'General', priceCents: 500, capacity: 2 });
  assert.equal(errorCode(() => publishEvent(store, empty.id)), 'INVALID_STATE');
  publishEvent(store, event.id);
  assert.deepEqual(listEventSummaries(store).map((summary) => summary.title), ['Published']);
  assert.equal(errorCode(() => publishEvent(store, 'missing')), 'NOT_FOUND');
});

test('S05 searches title or venue without regard to case', () => {
  const summaries = [makeSummary(), makeSummary({
    id: 'event-2', title: 'Abuja Jazz Night', city: 'Abuja', venue: 'Jazz Club',
  })];
  assert.deepEqual(filterEvents(summaries, { q: 'JAZZ' }).map((event) => event.id), ['event-2']);
});

test('S05 filters city case-insensitively and date boundaries inclusively', () => {
  const summaries = [makeSummary(), makeSummary({
    id: 'event-2', city: 'Abuja', date: '2026-12-06T00:00:00Z',
  })];
  assert.deepEqual(filterEvents(summaries, { city: 'lagos', from: '2026-12-05', to: '2026-12-05' })
    .map((event) => event.id), ['event-1']);
});

test('S05 filters by cheapest price and availability, leaving no-tier events out of price filters', () => {
  const summaries = [
    makeSummary({ id: 'cheap', tiers: [{ priceCents: 100, available: 0 }] }),
    makeSummary({ id: 'dear', tiers: [{ priceCents: 200, available: 4 }] }),
    makeSummary({ id: 'none', tiers: [] }),
  ];
  assert.deepEqual(filterEvents(summaries, { maxPriceCents: 100 }).map((event) => event.id), ['cheap']);
  assert.deepEqual(filterEvents(summaries, { onlyAvailable: true }).map((event) => event.id),
    ['dear']);
});

test('S05 sorts by date, price, and availability with required tie breakers', () => {
  const summaries = [
    makeSummary({ id: 'b', title: 'Beta', date: '2026-12-05T10:00:00Z', tiers: [{ priceCents: 200, available: 1 }] }),
    makeSummary({ id: 'a', title: 'Alpha', date: '2026-12-05T10:00:00Z', tiers: [{ priceCents: 200, available: 5 }] }),
    makeSummary({ id: 'none', title: 'None', tiers: [] }),
  ];
  assert.deepEqual(sortEvents(summaries, 'date').map((event) => event.id), ['a', 'b', 'none']);
  assert.deepEqual(sortEvents(summaries, 'price').map((event) => event.id), ['a', 'b', 'none']);
  assert.deepEqual(sortEvents(summaries, 'availability').map((event) => event.id), ['a', 'b', 'none']);
});

test('S05 rejects bad dates, fractional prices, and unknown sort options', () => {
  const summaries = [makeSummary()];
  assert.equal(errorCode(() => filterEvents(summaries, { from: 'not-a-date' })), 'VALIDATION');
  assert.equal(errorCode(() => filterEvents(summaries, { maxPriceCents: 1.2 })), 'VALIDATION');
  assert.equal(errorCode(() => sortEvents(summaries, 'title')), 'VALIDATION');
});

test('S05 filtering and sorting never mutate the original list, including an empty list', () => {
  const summaries = [makeSummary(), makeSummary({ id: 'event-2' })];
  const original = structuredClone(summaries);
  assert.deepEqual(searchEvents(summaries, {}, 'date').length, 2);
  assert.deepEqual(filterEvents([], {}), []);
  assert.deepEqual(summaries, original);
});

test('mergeSort returns a new stable array without using or changing the input', () => {
  const items = [{ key: 1, order: 'first' }, { key: 1, order: 'second' }, { key: 0, order: 'third' }];
  const original = structuredClone(items);
  const sorted = mergeSort(items, (left, right) => left.key - right.key);
  assert.notStrictEqual(sorted, items);
  assert.deepEqual(sorted.map((item) => item.order), ['third', 'first', 'second']);
  assert.deepEqual(items, original);
});

test('S06 books published inventory at whole-cent price and leaves seats', () => {
  const store = createStore();
  const event = createEvent(store, { name: 'Event' });
  const tier = addTier(store, event.id, { name: 'General', priceCents: 500, capacity: 3 });
  publishEvent(store, event.id);
  const booking = bookTickets(store, {
    eventId: event.id, tierId: tier.id, customerName: 'Ada', quantity: 2,
  });
  assert.equal(booking.status, 'CONFIRMED');
  assert.equal(booking.priceCents, 1000);
  assert.equal(tier.available, 1);
});

test('S06 rejects overselling without changing inventory', () => {
  const store = createStore();
  const event = createEvent(store, { name: 'Event' });
  const tier = addTier(store, event.id, { name: 'General', priceCents: 500, capacity: 1 });
  assert.equal(errorCode(() => bookTickets(store, {
    eventId: event.id, tierId: tier.id, customerName: 'Ada', quantity: 2,
  })), 'SOLD_OUT');
  assert.equal(tier.available, 1);
});

test('S06 rejects zero, negative, fractional, and over-limit quantities', () => {
  const store = createStore();
  const event = createEvent(store, { name: 'Event' });
  const tier = addTier(store, event.id, { name: 'General', priceCents: 500, capacity: 20 });
  for (const quantity of [0, -1, 1.5, 11]) {
    assert.equal(errorCode(() => bookTickets(store, {
      eventId: event.id, tierId: tier.id, customerName: 'Ada', quantity,
    })), 'VALIDATION');
  }
});
