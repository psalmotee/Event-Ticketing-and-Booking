import {
  addTierService,
  createEventService,
  publishEventService,
} from "../src/services/eventService.js";
import { createSQLiteRepository } from "../src/repositories/sqlite.js";

const repository = createSQLiteRepository();

try {
  if ((await repository.listEvents()).length > 0) {
    console.log("Database already has events; seed skipped.");
  } else {
    const event = await createEventService(repository, {
      title: "Build 5 Sample Event",
      city: "Lagos",
      venue: "Community Hall",
      date: "2027-06-15",
    });
    await addTierService(repository, event.id, {
      name: "General admission",
      priceCents: 2500,
      capacity: 100,
    });
    await publishEventService(repository, event.id);
    console.log("Seeded the Build 5 sample event.");
  }
} finally {
  repository.close();
}
