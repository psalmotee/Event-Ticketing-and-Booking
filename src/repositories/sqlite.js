import { createDatabase } from "../db/connection.js";
import { DomainError } from "../domain/errors.js";

function eventFromRow(row) {
  const event = {
    id: row.id,
    name: row.title,
    tiers: new Map(),
    published: row.published === 1,
  };
  if (row.city !== null || row.venue !== null || row.starts_at !== null) {
    event.title = row.title;
    event.city = row.city;
    event.venue = row.venue;
    event.date = row.starts_at;
  }
  if (row.organizer_id !== null) event.organizerId = row.organizer_id;
  return event;
}

function tierFromRow(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    priceCents: row.price_cents,
    capacity: row.capacity,
    available: row.capacity - row.sold,
  };
}

function bookingFromRow(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    tierId: row.tier_id,
    reference: row.reference,
    userId: row.user_id,
    quantity: row.quantity,
    amountCents: row.amount_cents,
    priceCents: row.amount_cents,
    status: row.status,
  };
}

export class SQLiteRepository {
  #database;
  #store = {
    events: new Map(),
    bookingsByReference: new Map(),
  };

  constructor({ databasePath } = {}) {
    this.#database = createDatabase(databasePath);
    this.#loadStore();
  }

  get atomicReservations() {
    return true;
  }

  #loadStore() {
    const events = this.#database.prepare("SELECT * FROM events").all();
    for (const row of events) this.#store.events.set(row.id, eventFromRow(row));

    const tiers = this.#database.prepare("SELECT * FROM ticket_tiers").all();
    for (const row of tiers) {
      const event = this.#store.events.get(row.event_id);
      if (event) event.tiers.set(row.id, tierFromRow(row));
    }

    const bookings = this.#database
      .prepare(
        `
      SELECT bookings.*, ticket_tiers.event_id
      FROM bookings
      JOIN ticket_tiers ON ticket_tiers.id = bookings.tier_id
    `,
      )
      .all();
    for (const row of bookings) {
      this.#store.bookingsByReference.set(row.reference, bookingFromRow(row));
    }
  }

  async saveEvent(event) {
    this.#database
      .prepare(
        `
      INSERT INTO events (id, organizer_id, title, city, venue, starts_at, published)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        organizer_id = excluded.organizer_id,
        title = excluded.title,
        city = excluded.city,
        venue = excluded.venue,
        starts_at = excluded.starts_at,
        published = excluded.published
    `,
      )
      .run(
        event.id,
        event.organizerId ?? null,
        event.title ?? event.name,
        event.city ?? null,
        event.venue ?? null,
        event.date ?? null,
        event.published ? 1 : 0,
      );
    return event;
  }

  async getEvent(id) {
    return this.#store.events.get(id);
  }

  async listEvents() {
    return [...this.#store.events.values()];
  }

  async saveTier(tier) {
    this.#database
      .prepare(
        `
      INSERT INTO ticket_tiers (id, event_id, name, price_cents, capacity, sold)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        event_id = excluded.event_id,
        name = excluded.name,
        price_cents = excluded.price_cents,
        capacity = excluded.capacity,
        sold = excluded.sold
    `,
      )
      .run(
        tier.id,
        tier.eventId,
        tier.name,
        tier.priceCents,
        tier.capacity,
        tier.capacity - tier.available,
      );
    return tier;
  }

  async getTier(eventId, tierId) {
    return this.#store.events.get(eventId)?.tiers.get(tierId);
  }

  async saveBooking(booking) {
    const event = this.#store.events.get(booking.eventId);
    const tier = event?.tiers.get(booking.tierId);
    if (!tier) throw new Error(`Ticket tier not found: ${booking.tierId}`);

    let isNewBooking = false;
    let releasesSeats = false;
    this.#database.exec("BEGIN");
    try {
      const existingBooking = this.#database
        .prepare("SELECT id, status FROM bookings WHERE id = ?")
        .get(booking.id);
      isNewBooking = !existingBooking;
      releasesSeats = Boolean(
        existingBooking &&
        !["cancelled", "CANCELLED"].includes(existingBooking.status) &&
        ["cancelled", "CANCELLED"].includes(booking.status),
      );
      if (isNewBooking) {
        const reservation = this.#database
          .prepare(
            "UPDATE ticket_tiers SET sold = sold + ? WHERE id = ? AND sold + ? <= capacity",
          )
          .run(booking.quantity, tier.id, booking.quantity);
        if (reservation.changes !== 1) {
          throw new DomainError("SOLD_OUT", "Not enough seats available");
        }
      } else if (releasesSeats) {
        const release = this.#database
          .prepare(
            "UPDATE ticket_tiers SET sold = sold - ? WHERE id = ? AND sold >= ?",
          )
          .run(booking.quantity, tier.id, booking.quantity);
        if (release.changes !== 1) {
          throw new DomainError(
            "INVALID_STATE",
            "Booking seats were not reserved",
          );
        }
      }
      this.#database
        .prepare(
          `
        INSERT INTO users (id, name, role)
        VALUES (?, ?, 'attendee')
        ON CONFLICT(id) DO NOTHING
      `,
        )
        .run(booking.userId, booking.userId);
      this.#database
        .prepare(
          `
        INSERT INTO bookings (id, user_id, tier_id, reference, quantity, amount_cents, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          tier_id = excluded.tier_id,
          reference = excluded.reference,
          quantity = excluded.quantity,
          amount_cents = excluded.amount_cents,
          status = excluded.status
      `,
        )
        .run(
          booking.id,
          booking.userId,
          booking.tierId,
          booking.reference,
          booking.quantity,
          booking.amountCents ?? booking.priceCents,
          booking.status,
        );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }

    if (isNewBooking) tier.available -= booking.quantity;
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

  close() {
    this.#database.close();
  }
}

export function createSQLiteRepository(options) {
  return new SQLiteRepository(options);
}
