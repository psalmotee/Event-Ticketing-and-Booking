import test from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { startServer } from "../src/server.js";
import { createMemoryRepository } from "../src/repositories/memory.js";

function call(port, path, { method = "GET", body, user } = {}) {
  return new Promise((resolve, reject) => {
    const requestHandle = request(
      {
        port,
        path,
        method,
        headers: {
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(user === undefined ? {} : { "x-user-id": user }),
        },
      },
      (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          text += chunk;
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            body: text ? JSON.parse(text) : undefined,
          }),
        );
      },
    );
    requestHandle.on("error", reject);
    if (body !== undefined) requestHandle.write(JSON.stringify(body));
    requestHandle.end();
  });
}

async function withServer(action) {
  const server = startServer({ port: 0, repository: createMemoryRepository() });
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    return await action(server.address().port);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("Build 4 API creates, publishes, searches, books, declines, pays and cancels", async () => {
  await withServer(async (port) => {
    const created = await call(port, "/api/events", {
      method: "POST",
      body: {
        title: "API Event",
        city: "Lagos",
        venue: "Hall",
        date: "2026-12-05",
      },
    });
    assert.equal(created.status, 201);
    const eventId = created.body.id;

    const tier = await call(port, `/api/events/${eventId}/tiers`, {
      method: "POST",
      body: { name: "General", priceCents: 500, capacity: 2 },
    });
    assert.equal(tier.status, 201);
    const published = await call(port, `/api/events/${eventId}/publish`, {
      method: "POST",
    });
    assert.equal(published.status, 200);
    assert.equal((await call(port, "/api/events?city=lagos")).body.length, 1);

    const booking = await call(port, "/api/bookings", {
      method: "POST",
      user: "user-1",
      body: { eventId, tierId: tier.body.id, quantity: 1 },
    });
    assert.equal(booking.status, 201);
    const reference = booking.body.reference;

    const declined = await call(port, `/api/bookings/${reference}/pay`, {
      method: "POST",
      user: "user-1",
      body: { decline: true },
    });
    assert.equal(declined.status, 402);
    assert.equal(declined.body.error.code, "PAYMENT_DECLINED");

    const paid = await call(port, `/api/bookings/${reference}/pay`, {
      method: "POST",
      user: "user-1",
      body: {},
    });
    assert.equal(paid.body.status, "paid");
    const unauthorized = await call(port, `/api/bookings/${reference}/pay`, {
      method: "POST",
      user: "other",
      body: {},
    });
    assert.equal(unauthorized.body.error.code, "FORBIDDEN");
  });
});
