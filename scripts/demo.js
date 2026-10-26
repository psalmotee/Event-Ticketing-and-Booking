import {
  addTier,
  bookTickets,
  cancelBooking,
  createEvent,
  createStore,
  findBookingByReference,
  joinWaitlist,
} from '../src/domain/inventory.js';

const store = createStore();
const event = createEvent(store, { name: 'Summer Sounds' });
const tier = addTier(store, event.id, { name: 'General admission', capacity: 3, priceCents: 2500 });

const ada = bookTickets(store, {
  eventId: event.id, tierId: tier.id, customerName: 'Ada', quantity: 2,
});
console.log(`Ada booked ${ada.quantity} tickets (${ada.reference}).`);

try {
  bookTickets(store, {
    eventId: event.id, tierId: tier.id, customerName: 'Bayo', quantity: 2,
  });
} catch (error) {
  console.log(`Bayo was refused: ${error.code}.`);
}

const chidi = bookTickets(store, {
  eventId: event.id, tierId: tier.id, customerName: 'Chidi', quantity: 1,
});
console.log(`The event sold out after ${chidi.customerName}'s booking.`);

const first = joinWaitlist(store, {
  eventId: event.id, tierId: tier.id, customerName: 'Dara', quantity: 1,
});
const second = joinWaitlist(store, {
  eventId: event.id, tierId: tier.id, customerName: 'Emeka', quantity: 1,
});
console.log(`${first.customerName} and ${second.customerName} joined the waitlist.`);
console.log(`Lookup found ${findBookingByReference(store, ada.reference).customerName}'s booking.`);

cancelBooking(store, ada.reference);
console.log(`Ada cancelled. The next person in line is ${tier.waitlist.peek().customerName}.`);
