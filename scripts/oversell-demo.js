import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addTierService,
  createEventService,
  publishEventService,
} from "../src/services/eventService.js";
import { createBookingService } from "../src/services/bookingService.js";
import { createSQLiteRepository } from "../src/repositories/sqlite.js";

const directory = mkdtempSync(join(tmpdir(), "event-ticketing-oversell-"));
const databasePath = join(directory, "demo.db");
const repository = createSQLiteRepository({ databasePath });
const contenders = [];
let observer;

try {
  const event = await createEventService(repository, {
    title: "Last Ticket Race",
    city: "Lagos",
    venue: "Community Hall",
    date: "2027-06-15",
  });
  const tier = await addTierService(repository, event.id, {
    name: "General admission",
    priceCents: 2500,
    capacity: 50,
  });
  await publishEventService(repository, event.id);

  for (const [index, quantity] of [10, 10, 10, 10, 9].entries()) {
    await createBookingService(repository, `initial-buyer-${index}`, {
      eventId: event.id,
      tierId: tier.id,
      quantity,
    });
  }

  for (let index = 0; index < 50; index += 1) {
    contenders.push(createSQLiteRepository({ databasePath }));
  }

  const attempts = await Promise.all(
    Array.from({ length: 50 }, async (_, index) => {
      try {
        await createBookingService(contenders[index], `racer-${index}`, {
          eventId: event.id,
          tierId: tier.id,
          quantity: 1,
        });
        return true;
      } catch (error) {
        if (error.code === "SOLD_OUT") return false;
        throw error;
      }
    }),
  );
  const successful = attempts.filter(Boolean).length;
  const soldOut = attempts.length - successful;
  observer = createSQLiteRepository({ databasePath });
  const persistedTier = await observer.getTier(event.id, tier.id);
  const bookedTickets = (await observer.listBookings()).reduce(
    (total, booking) => total + booking.quantity,
    0,
  );

  console.log(`Requests competing for the final seat: ${attempts.length}`);
  console.log(`Bookings succeeded: ${successful}`);
  console.log(`SOLD_OUT responses: ${soldOut}`);
  console.log(
    `Seats sold: ${tier.capacity - persistedTier.available}/${tier.capacity}`,
  );
  console.log(
    `Tickets in bookings: ${bookedTickets}/${tier.capacity} capacity`,
  );
} finally {
  for (const contender of contenders) contender.close();
  observer?.close();
  repository.close();
  rmSync(directory, { recursive: true, force: true });
}
