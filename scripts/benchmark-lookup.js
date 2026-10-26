import { performance } from 'node:perf_hooks';
import { newReference } from '../src/domain/ids.js';

const BOOKINGS = 100_000;
const LOOKUPS = 500;
const bookings = Array.from({ length: BOOKINGS }, (_, index) => ({
  reference: `BOOKING-${index}`,
}));
const bookingsByReference = new Map(bookings.map((booking) => [booking.reference, booking]));
const references = Array.from({ length: LOOKUPS }, (_, index) => `BOOKING-${(index * 197) % BOOKINGS}`);

const measure = (lookup) => {
  const start = performance.now();
  for (const reference of references) lookup(reference);
  return performance.now() - start;
};

const arrayMilliseconds = measure((reference) => bookings.find((booking) => booking.reference === reference));
const mapMilliseconds = measure((reference) => bookingsByReference.get(reference));
console.log(`Array.find: ${arrayMilliseconds.toFixed(3)} ms`);
console.log(`Map.get:    ${mapMilliseconds.toFixed(3)} ms`);
console.log(`Sample generated reference: ${newReference()}`);
