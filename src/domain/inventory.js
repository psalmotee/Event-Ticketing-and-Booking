import { DomainError } from './errors.js';
import { newId, newReference } from './ids.js';
import { Queue } from './waitlistQueue.js';

const MAX_TICKETS = 10;

function requireObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION', `${name} must be an object`);
  }
}

function requireText(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function requirePositiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DomainError('VALIDATION', `${name} must be a positive integer`);
  }
  return value;
}

function requireCents(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError('VALIDATION', `${name} must be a non-negative whole number of cents`);
  }
  return value;
}

function requireDate(value, name) {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)
    || Number.isNaN(Date.parse(value))) {
    throw new DomainError('VALIDATION', `${name} must be a valid ISO date`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day) {
      throw new DomainError('VALIDATION', `${name} must be a valid ISO date`);
    }
  }
  return value;
}

function getEvent(store, eventId) {
  const event = store.events.get(eventId);
  if (!event) {
    throw new DomainError('NOT_FOUND', `Event not found: ${eventId}`);
  }
  return event;
}

function getTier(store, eventId, tierId) {
  const event = getEvent(store, eventId);
  const tier = event.tiers.get(tierId);
  if (!tier) {
    throw new DomainError('NOT_FOUND', `Ticket tier not found: ${tierId}`);
  }
  return tier;
}

export function createStore() {
  return {
    events: new Map(),
    bookingsByReference: new Map(),
  };
}

export function createEvent(store, details) {
  requireObject(store, 'store');
  requireObject(details, 'event');
  const usesBuildTwoShape = ['title', 'city', 'venue', 'date'].some((key) => key in details);
  const name = requireText(details.title ?? details.name, 'event title');
  const event = { id: newId(), name, tiers: new Map(), published: false };
  if (usesBuildTwoShape) {
    event.title = name;
    event.city = requireText(details.city, 'event city');
    event.venue = requireText(details.venue, 'event venue');
    event.date = requireDate(details.date, 'event date');
  }
  store.events.set(event.id, event);
  return event;
}

export function addTier(store, eventId, details) {
  requireObject(store, 'store');
  requireText(eventId, 'eventId');
  requireObject(details, 'tier');
  const event = getEvent(store, eventId);
  const name = requireText(details.name, 'tier name');
  const capacity = requirePositiveInteger(details.capacity, 'tier capacity');
  const priceCents = requireCents(details.priceCents, 'tier priceCents');
  const tier = {
    id: newId(),
    eventId,
    name,
    capacity,
    available: capacity,
    priceCents,
  };
  event.tiers.set(tier.id, tier);
  return tier;
}

function bookingDetails(details, operation) {
  requireObject(details, operation);
  const eventId = requireText(details.eventId, 'eventId');
  const tierId = requireText(details.tierId, 'tierId');
  const customerName = requireText(details.customerName, 'customerName');
  const quantity = requirePositiveInteger(details.quantity, 'quantity');
  if (quantity > MAX_TICKETS) {
    throw new DomainError('VALIDATION', 'quantity must be between 1 and 10');
  }
  return { eventId, tierId, customerName, quantity };
}

export function bookTickets(store, details) {
  requireObject(store, 'store');
  const request = bookingDetails(details, 'booking');
  const tier = getTier(store, request.eventId, request.tierId);
  if (tier.available < request.quantity) {
    throw new DomainError('SOLD_OUT', 'Not enough seats available');
  }

  tier.available -= request.quantity;
  const booking = {
    id: newId(),
    reference: newReference(),
    ...request,
    priceCents: tier.priceCents * request.quantity,
    status: 'CONFIRMED',
  };
  store.bookingsByReference.set(booking.reference, booking);
  return booking;
}

export function cancelBooking(store, reference) {
  requireObject(store, 'store');
  const bookingReference = requireText(reference, 'reference');
  const booking = store.bookingsByReference.get(bookingReference);
  if (!booking) {
    throw new DomainError('NOT_FOUND', `Booking not found: ${bookingReference}`);
  }
  if (booking.status === 'CANCELLED') {
    throw new DomainError('ALREADY_CANCELLED', 'Booking has already been cancelled');
  }

  const tier = getTier(store, booking.eventId, booking.tierId);
  tier.available += booking.quantity;
  booking.status = 'CANCELLED';
  return booking;
}

export function findBookingByReference(store, reference) {
  requireObject(store, 'store');
  const bookingReference = requireText(reference, 'reference');
  return store.bookingsByReference.get(bookingReference);
}

export function joinWaitlist(store, details) {
  requireObject(store, 'store');
  const request = bookingDetails(details, 'waitlist entry');
  const tier = getTier(store, request.eventId, request.tierId);
  if (!tier.waitlist) {
    tier.waitlist = new Queue();
  }
  const entry = { id: newId(), ...request, status: 'WAITING' };
  tier.waitlist.enqueue(entry);
  return entry;
}

export function publishEvent(store, eventId) {
  requireObject(store, 'store');
  const event = getEvent(store, eventId);
  if (event.tiers.size === 0) {
    throw new DomainError('INVALID_STATE', 'An event must have at least one ticket tier');
  }
  event.published = true;
  return event;
}

export function listEventSummaries(store, { publishedOnly = true } = {}) {
  requireObject(store, 'store');
  if (typeof publishedOnly !== 'boolean') {
    throw new DomainError('VALIDATION', 'publishedOnly must be a boolean');
  }
  return [...store.events.values()]
    .filter((event) => !publishedOnly || event.published === true)
    .map((event) => ({
      id: event.id,
      title: event.title ?? event.name,
      name: event.name,
      city: event.city,
      venue: event.venue,
      date: event.date,
      published: event.published === true,
      tiers: [...event.tiers.values()].map((tier) => ({
        id: tier.id,
        name: tier.name,
        priceCents: tier.priceCents,
        capacity: tier.capacity,
        available: tier.available,
        sold: tier.capacity - tier.available,
      })),
    }));
}
