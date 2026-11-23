import { createBooking, getEvent, pay } from "../api.js";
import { el, formatPrice } from "../ui.js";

const app = document.querySelector("#app");
const eventId = new URLSearchParams(window.location.search).get("id");

function dateLabel(date) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(date));
}

function tierCard(event, tier) {
  const soldOut = tier.available <= 0;
  const quantity = el("input", {
    id: `quantity-${tier.id}`,
    name: `quantity-${tier.id}`,
    type: "number",
    min: "1",
    max: String(Math.min(10, tier.available)),
    value: "1",
  });
  const buy = el("button", {
    type: "button",
    className: "button",
    disabled: soldOut,
  }, soldOut ? "Sold out" : "Choose tickets");

  buy.addEventListener("click", async () => {
    const selectedQuantity = Number(quantity.value);
    if (!Number.isInteger(selectedQuantity) || selectedQuantity < 1
      || selectedQuantity > 10 || selectedQuantity > tier.available) {
      quantity.setCustomValidity(`Choose between 1 and ${Math.min(10, tier.available)} tickets.`);
      quantity.reportValidity();
      return;
    }
    quantity.setCustomValidity("");
    buy.disabled = true;
    buy.textContent = "Creating booking...";
    try {
      const booking = await createBooking({
        eventId: event.id,
        tierId: tier.id,
        quantity: selectedQuantity,
      });
      renderCheckout(event, tier, booking);
    } catch (error) {
      buy.disabled = false;
      buy.textContent = "Choose tickets";
      document.querySelector("#checkout-error").replaceChildren(
        el("p", { className: "error", textContent: error.message }),
      );
    }
  });

  return el("article", { className: `tier-card${soldOut ? " tier-card--sold-out" : ""}` }, [
    el("div", { className: "tier-card__main" }, [
      el("span", { className: "tier-card__badge", textContent: soldOut ? "Unavailable" : "Available" }),
      el("h3", { textContent: tier.name }),
      el("p", { className: "seat-count", textContent: soldOut ? "Sold out" : `${tier.available} seats remaining` }),
    ]),
    el("div", { className: "tier-card__purchase" }, [
      el("p", { className: "tier-card__price", textContent: formatPrice(tier.priceCents) }),
      el("div", { className: "tier-actions" }, [
        el("div", { className: "field field--compact" }, [
          el("label", { for: quantity.id }, "Qty"),
          quantity,
        ]),
        buy,
      ]),
    ]),
  ]);
}

function renderCheckout(event, tier, booking) {
  const checkout = document.querySelector("#checkout");
  const countdown = el("p", { className: "countdown", "aria-live": "polite" });
  const paymentForm = el("form", { className: "payment-form" });
  const cardName = el("input", { id: "card-name", name: "cardName", type: "text", autocomplete: "cc-name", required: true });
  const cardNumber = el("input", { id: "card-number", name: "cardNumber", type: "text", inputmode: "numeric", autocomplete: "cc-number", placeholder: "Use 4000 0000 0000 0002 to decline", required: true });
  const error = el("div", { id: "payment-error", role: "alert" });
  const payButton = el("button", { type: "submit", className: "button" }, "Pay now");

  paymentForm.append(
    el("div", { className: "field" }, [el("label", { for: "card-name" }, "Name on card"), cardName]),
    el("div", { className: "field" }, [el("label", { for: "card-number" }, "Card number"), cardNumber]),
    payButton,
  );

  paymentForm.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    error.replaceChildren();
    payButton.disabled = true;
    payButton.textContent = "Processing...";
    try {
      await pay(booking, { cardNumber: cardNumber.value });
      checkout.replaceChildren(
        el("h2", { textContent: "Payment confirmed" }),
        el("p", { textContent: `Your booking ${booking.reference} is paid.` }),
        el("a", { className: "button", href: "/index.html" }, "Browse more events"),
      );
    } catch (paymentError) {
      error.replaceChildren(el("p", { className: "error", textContent: paymentError.message }));
      payButton.disabled = false;
      payButton.textContent = "Try payment again";
    }
  });

  function updateCountdown() {
    const remaining = Math.max(0, booking.holdExpiresAt - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    countdown.textContent = `Seats held for ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    if (remaining === 0) {
      clearInterval(timer);
      paymentForm.querySelectorAll("button, input").forEach((control) => { control.disabled = true; });
      countdown.textContent = "Your seat hold has expired.";
    }
  }
  let timer;
  updateCountdown();
  timer = setInterval(updateCountdown, 1000);

  checkout.replaceChildren(
    el("h2", { textContent: "Checkout" }),
    el("p", { textContent: `${booking.quantity} × ${tier.name} — ${formatPrice(booking.amountCents)}` }),
    countdown,
    paymentForm,
    error,
  );
  checkout.scrollIntoView({ behavior: "smooth" });
}

async function init() {
  if (!eventId) {
    app.replaceChildren(el("h1", { textContent: "Event not found" }));
    return;
  }
  app.replaceChildren(el("p", { className: "loading", textContent: "Loading event..." }));
  try {
    const event = await getEvent(eventId);
    app.className = "page-shell event-page";
    app.replaceChildren(
      el("a", { className: "back-link", href: "/index.html" }, "← All events"),
      el("header", { className: "event-hero" }, [
        el("div", { className: "event-hero__visual", "aria-hidden": "true" }, [
          el("span", { className: "event-hero__orb event-hero__orb--one" }),
          el("span", { className: "event-hero__orb event-hero__orb--two" }),
        ]),
        el("div", { className: "event-hero__content" }, [
          el("p", { className: "eyebrow", textContent: event.city }),
          el("h1", { textContent: event.title }),
          el("div", { className: "event-facts" }, [
            el("p", { className: "event-fact", textContent: dateLabel(event.date) }),
            el("p", { className: "event-fact", textContent: event.venue }),
          ]),
        ]),
      ]),
      el("div", { className: "event-layout" }, [
        el("div", { className: "event-details" }, [
          el("section", { className: "about-event" }, [
            el("p", { className: "eyebrow", textContent: "About this event" }),
            el("h2", { textContent: "What to expect" }),
            el("p", { textContent: event.description }),
          ]),
          el("section", { className: "tiers" }, [
            el("div", { className: "section-heading" }, [
              el("p", { className: "eyebrow", textContent: "Tickets" }),
              el("h2", { textContent: "Choose your experience" }),
            ]),
            el("div", { id: "checkout-error" }),
            ...event.tiers.map((tier) => tierCard(event, tier)),
          ]),
        ]),
        el("aside", { id: "checkout", className: "checkout", "aria-live": "polite" }, [
          el("p", { className: "eyebrow", textContent: "Secure checkout" }),
          el("h2", { textContent: "Your booking" }),
          el("p", { className: "muted", textContent: "Choose a ticket tier to continue." }),
        ]),
      ]),
    );
  } catch (error) {
    app.replaceChildren(
      el("h1", { textContent: "Event not found" }),
      el("p", { className: "error", textContent: error.message }),
      el("a", { className: "button", href: "/index.html" }, "Back to events"),
    );
  }
}

init();
