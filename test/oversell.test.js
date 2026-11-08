import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addTierService,
  createEventService,
  publishEventService,
} from "../src/services/eventService.js";
import {
  cancelBookingService,
  createBookingService,
} from "../src/services/bookingService.js";
import { createSQLiteRepository } from "../src/repositories/sqlite.js";

test("50 connections competing for the last seat produce one booking", async () => {
  const directory = mkdtempSync(
    join(tmpdir(), "event-ticketing-oversell-test-"),
  );
  const databasePath = join(directory, "test.db");
  const repositories = [];

  try {
    const setup = createSQLiteRepository({ databasePath });
    repositories.push(setup);
    const event = await createEventService(setup, {
      title: "Oversell Test",
      city: "Lagos",
      venue: "Test Hall",
      date: "2027-06-15",
    });
    const tier = await addTierService(setup, event.id, {
      name: "General admission",
      priceCents: 2500,
      capacity: 50,
    });
    await publishEventService(setup, event.id);

    for (const [index, quantity] of [10, 10, 10, 10, 9].entries()) {
      await createBookingService(setup, `initial-buyer-${index}`, {
        eventId: event.id,
        tierId: tier.id,
        quantity,
      });
    }
    assert.equal(tier.available, 1);

    const contenders = Array.from({ length: 50 }, () => {
      const repository = createSQLiteRepository({ databasePath });
      repositories.push(repository);
      return repository;
    });
    const outcomes = await Promise.all(
      contenders.map(async (repository, index) => {
        try {
          await createBookingService(repository, `racer-${index}`, {
            eventId: event.id,
            tierId: tier.id,
            quantity: 1,
          });
          return { success: true };
        } catch (error) {
          if (error.code === "SOLD_OUT")
            return { success: false, code: error.code };
          throw error;
        }
      }),
    );

    assert.equal(outcomes.filter((outcome) => outcome.success).length, 1);
    assert.equal(
      outcomes.filter((outcome) => outcome.code === "SOLD_OUT").length,
      49,
    );

    const observer = createSQLiteRepository({ databasePath });
    repositories.push(observer);
    const persistedTier = await observer.getTier(event.id, tier.id);
    const bookedTickets = (await observer.listBookings()).reduce(
      (total, booking) => total + booking.quantity,
      0,
    );
    assert.equal(tier.capacity - persistedTier.available, tier.capacity);
    assert.equal(bookedTickets, tier.capacity);
  } finally {
    for (const repository of repositories) repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("cancelling a SQLite booking releases its seats", async () => {
  const directory = mkdtempSync(join(tmpdir(), "event-ticketing-cancel-test-"));
  const repository = createSQLiteRepository({
    databasePath: join(directory, "test.db"),
  });

  try {
    const event = await createEventService(repository, {
      title: "Cancellation Test",
      city: "Lagos",
      venue: "Test Hall",
      date: "2027-06-15",
    });
    const tier = await addTierService(repository, event.id, {
      name: "General admission",
      priceCents: 2500,
      capacity: 1,
    });
    await publishEventService(repository, event.id);
    const booking = await createBookingService(repository, "first-buyer", {
      eventId: event.id,
      tierId: tier.id,
      quantity: 1,
    });

    await cancelBookingService(repository, "first-buyer", booking.reference);
    await createBookingService(repository, "next-buyer", {
      eventId: event.id,
      tierId: tier.id,
      quantity: 1,
    });

    assert.equal(tier.available, 0);
  } finally {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
