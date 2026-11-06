export class MemoryRepository {
  #store = {
    events: new Map(),
    bookingsByReference: new Map(),
  };

  async saveEvent(event) {
    this.#store.events.set(event.id, event);
    return event;
  }

  async getEvent(id) {
    return this.#store.events.get(id);
  }

  async listEvents() {
    return [...this.#store.events.values()];
  }

  async saveTier(tier) {
    const event = this.#store.events.get(tier.eventId);
    if (event) event.tiers.set(tier.id, tier);
    return tier;
  }

  async getTier(eventId, tierId) {
    return this.#store.events.get(eventId)?.tiers.get(tierId);
  }

  async saveBooking(booking) {
    this.#store.bookingsByReference.set(booking.reference, booking);
    return booking;
  }

  async getBooking(reference) {
    return this.#store.bookingsByReference.get(reference);
  }

  async listBookings() {
    return [...this.#store.bookingsByReference.values()];
  }

  get domainStore() {
    return this.#store;
  }
}

export function createMemoryRepository() {
  return new MemoryRepository();
}
