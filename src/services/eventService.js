import {
  addTier,
  createEvent,
  listEventSummaries,
  publishEvent,
} from '../domain/inventory.js';
import { searchEvents } from '../domain/eventSearch.js';
import { DomainError } from '../domain/errors.js';

function requireRepository(repository) {
  if (!repository?.domainStore) throw new TypeError('A repository is required');
}

export async function createEventService(repository, details) {
  requireRepository(repository);
  const event = createEvent(repository.domainStore, details);
  await repository.saveEvent(event);
  return event;
}

export async function addTierService(repository, eventId, details) {
  requireRepository(repository);
  if (!(await repository.getEvent(eventId))) {
    throw new DomainError('NOT_FOUND', `Event not found: ${eventId}`);
  }
  const tier = addTier(repository.domainStore, eventId, details);
  await repository.saveTier(tier);
  return tier;
}

export async function publishEventService(repository, eventId) {
  requireRepository(repository);
  const event = publishEvent(repository.domainStore, eventId);
  await repository.saveEvent(event);
  return event;
}

export async function searchEventService(repository, criteria = {}, sortBy = 'date') {
  requireRepository(repository);
  const summaries = listEventSummaries(repository.domainStore);
  return searchEvents(summaries, criteria, sortBy);
}
