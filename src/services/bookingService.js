import {
  bookTickets,
  cancelBooking,
  createBookingDraft,
} from "../domain/inventory.js";
import { assertTransition } from "../domain/bookingStateMachine.js";
import { DomainError } from "../domain/errors.js";

function requireUser(userId) {
  if (typeof userId !== "string" || userId.trim() === "") {
    throw new DomainError("VALIDATION", "x-user-id header is required");
  }
  return userId.trim();
}

export async function createBookingService(repository, userId, details) {
  const owner = requireUser(userId);
  const event = await repository.getEvent(details?.eventId);
  if (!event)
    throw new DomainError("NOT_FOUND", `Event not found: ${details?.eventId}`);
  if (!event.published)
    throw new DomainError("INVALID_STATE", "Event is not published");
  const bookingDetails = {
    ...details,
    customerName: owner,
  };
  const booking = repository.atomicReservations
    ? createBookingDraft(repository.domainStore, bookingDetails)
    : bookTickets(repository.domainStore, bookingDetails);
  booking.userId = owner;
  booking.amountCents = booking.priceCents;
  booking.status = "pending";
  delete booking.customerName;
  await repository.saveBooking(booking);
  return booking;
}

export async function payBookingService(
  repository,
  gateway,
  userId,
  reference,
  paymentRequest,
) {
  const owner = requireUser(userId);
  const booking = await repository.getBooking(reference);
  if (!booking)
    throw new DomainError("NOT_FOUND", `Booking not found: ${reference}`);
  if (booking.userId !== owner)
    throw new DomainError("FORBIDDEN", "Booking belongs to another user");
  assertTransition(booking.status, "paid");
  const result = await gateway.charge({
    amountCents: booking.amountCents,
    shouldDecline: paymentRequest?.decline === true,
  });
  if (!result.success)
    throw new DomainError("PAYMENT_DECLINED", "Payment was declined");
  booking.status = "paid";
  await repository.saveBooking(booking);
  return booking;
}

export async function cancelBookingService(repository, userId, reference) {
  const owner = requireUser(userId);
  const booking = await repository.getBooking(reference);
  if (!booking)
    throw new DomainError("NOT_FOUND", `Booking not found: ${reference}`);
  if (booking.userId !== owner)
    throw new DomainError("FORBIDDEN", "Booking belongs to another user");
  assertTransition(booking.status, "cancelled");
  const cancelled = cancelBooking(repository.domainStore, reference);
  cancelled.status = "cancelled";
  await repository.saveBooking(cancelled);
  return cancelled;
}
