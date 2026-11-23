import { events } from "./mockData.js";

const delay = () => new Promise((resolve) => setTimeout(resolve, 180));
const clone = (value) => JSON.parse(JSON.stringify(value));

function apiError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function listEvents(criteria = {}) {
  await delay();
  let result = clone(events).filter((event) => event.published);
  const query = String(criteria.q ?? "").trim().toLowerCase();
  if (query) {
    result = result.filter((event) =>
      [event.title, event.city, event.venue].some((value) =>
        value.toLowerCase().includes(query)));
  }
  if (criteria.city) {
    result = result.filter((event) => event.city === criteria.city);
  }
  if (Number.isFinite(criteria.maxPriceCents)) {
    result = result.filter((event) =>
      event.tiers.some((tier) => tier.priceCents <= criteria.maxPriceCents));
  }
  const sortBy = criteria.sortBy ?? "date";
  result.sort((a, b) => {
    if (sortBy === "price") {
      return Math.min(...a.tiers.map((tier) => tier.priceCents))
        - Math.min(...b.tiers.map((tier) => tier.priceCents));
    }
    if (sortBy === "title") return a.title.localeCompare(b.title);
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
  return result;
}

export async function getEvent(eventId) {
  await delay();
  const event = events.find((item) => item.id === eventId);
  if (!event) throw apiError("NOT_FOUND", "Event not found");
  return clone(event);
}

export async function createBooking({ eventId, tierId, quantity }) {
  await delay();
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw apiError("VALIDATION", "Quantity must be between 1 and 10");
  }
  const event = events.find((item) => item.id === eventId);
  const tier = event?.tiers.find((item) => item.id === tierId);
  if (!event || !tier) throw apiError("NOT_FOUND", "Event or ticket tier not found");
  if (tier.available < quantity) throw apiError("SOLD_OUT", "Not enough seats available");
  tier.available -= quantity;
  const reference = `TKT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const holdExpiresAt = Date.now() + 10 * 60 * 1000;
  return {
    id: `booking-${reference}`,
    reference,
    eventId,
    tierId,
    quantity,
    priceCents: tier.priceCents * quantity,
    amountCents: tier.priceCents * quantity,
    status: "pending",
    holdExpiresAt,
  };
}

export async function pay(bookingOrReference, payment = {}) {
  await delay();
  const reference = typeof bookingOrReference === "string"
    ? bookingOrReference
    : bookingOrReference.reference;
  if (!reference) throw apiError("NOT_FOUND", "Booking not found");
  const shouldDecline = payment.decline === true
    || String(payment.cardNumber ?? "").replace(/\s/g, "").endsWith("0002");
  if (shouldDecline) throw apiError("PAYMENT_DECLINED", "Payment was declined. Please try again.");
  return {
    reference,
    status: "paid",
  };
}
