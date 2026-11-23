import { listEvents } from "../api.js";
import { el, formatPrice } from "../ui.js";

const app = document.querySelector("#app");

function dateLabel(date) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

function eventCard(event) {
  const lowestPrice = Math.min(...event.tiers.map((tier) => tier.priceCents));
  const date = new Date(event.date);
  const month = new Intl.DateTimeFormat("en-NG", { month: "short" })
    .format(date)
    .toUpperCase();
  const day = new Intl.DateTimeFormat("en-NG", { day: "2-digit" }).format(date);
  const venueAvailable = event.tiers.reduce(
    (sum, tier) => sum + tier.available,
    0,
  );

  return el("article", { className: "event-card" }, [
    el("div", { className: "event-card__visual" }, [
      el("span", {
        className: "event-card__category",
        textContent: event.city,
      }),
      el(
        "div",
        { className: "event-card__date", "aria-label": dateLabel(event.date) },
        [
          el("span", { textContent: month }),
          el("strong", { textContent: day }),
        ],
      ),
      el("div", { className: "event-card__art", "aria-hidden": "true" }, [
        el("span", { className: "event-card__orb event-card__orb--one" }),
        el("span", { className: "event-card__orb event-card__orb--two" }),
      ]),
    ]),
    el("div", { className: "event-card__body" }, [
      el("p", { className: "event-card__venue", textContent: event.venue }),
      el("h2", { textContent: event.title }),
      el("div", { className: "event-card__meta" }, [
        el("span", { textContent: dateLabel(event.date) }),
        el("span", {
          textContent:
            venueAvailable > 0 ? `${venueAvailable} tickets left` : "Sold out",
        }),
      ]),
    ]),
    el("div", { className: "event-card__footer" }, [
      el("div", {}, [
        el("span", { className: "event-card__from", textContent: "From" }),
        el("p", { className: "price", textContent: formatPrice(lowestPrice) }),
      ]),
      el(
        "a",
        {
          className: "button button--arrow",
          href: `/event.html?id=${encodeURIComponent(event.id)}`,
        },
        "View event",
      ),
    ]),
  ]);
}

function renderFilters(events) {
  const cities = [...new Set(events.map((event) => event.city))].sort();
  const cityOptions = [
    el("option", { value: "", textContent: "All cities" }),
    ...cities.map((city) => el("option", { value: city, textContent: city })),
  ];

  const search = el("input", {
    id: "search",
    name: "search",
    type: "search",
    placeholder: "Search events",
  });
  const city = el("select", { id: "city", name: "city" }, cityOptions);
  const maxPrice = el("input", {
    id: "max-price",
    name: "max-price",
    type: "number",
    min: "0",
    step: "500",
    placeholder: "e.g. 5000",
  });
  const sort = el("select", { id: "sort", name: "sort" }, [
    el("option", { value: "date", textContent: "Soonest" }),
    el("option", { value: "price", textContent: "Lowest price" }),
    el("option", { value: "title", textContent: "Title A-Z" }),
  ]);

  const controls = el(
    "form",
    { id: "filters", className: "filters", role: "search" },
    [
      el("div", { className: "field field--search" }, [
        el("label", { for: "search" }, "Search"),
        search,
      ]),
      el("div", { className: "field" }, [
        el("label", { for: "city" }, "City"),
        city,
      ]),
      el("div", { className: "field" }, [
        el("label", { for: "max-price" }, "Max price"),
        el("div", { className: "price-input" }, [
          el("span", { "aria-hidden": "true", textContent: "₦" }),
          maxPrice,
        ]),
      ]),
      el("div", { className: "field" }, [
        el("label", { for: "sort" }, "Sort by"),
        sort,
      ]),
    ],
  );
  controls.addEventListener("submit", (event) => event.preventDefault());

  const results = el("section", {
    className: "event-grid",
    "aria-live": "polite",
  });
  async function update() {
    const naira = Number(maxPrice.value);
    const criteria = {
      q: search.value,
      city: city.value,
      maxPriceCents:
        maxPrice.value === "" || !Number.isFinite(naira)
          ? undefined
          : Math.round(naira * 100),
      sortBy: sort.value,
    };
    const filtered = await listEvents(criteria);
    results.replaceChildren(
      ...(filtered.length
        ? filtered.map(eventCard)
        : [
            el("p", {
              className: "empty-state",
              textContent: "No events match your filters.",
            }),
          ]),
    );
  }
  for (const control of [search, city, maxPrice, sort]) {
    control.addEventListener(control === search ? "input" : "change", update);
  }
  update();
  return [controls, results];
}

async function init() {
  app.className = "page-shell home-page";
  const events = await listEvents();
  const [controls, results] = renderFilters(events);
  app.replaceChildren(
    el("section", { className: "hero" }, [
      el("div", {
        className: "hero__glow hero__glow--one",
        "aria-hidden": "true",
      }),
      el("div", {
        className: "hero__glow hero__glow--two",
        "aria-hidden": "true",
      }),
      el("div", { className: "hero__content" }, [
        el("p", {
          className: "hero__kicker",
          textContent: "Discover your next experience",
        }),
        el("h1", {}, "Live moments. Unforgettable stories."),
        el("p", {
          className: "hero__copy",
          textContent:
            "Find the best concerts, meetups and experiences happening across Nigeria.",
        }),
      ]),
    ]),
    el("section", { id: "events", className: "browse-section" }, [
      controls,
      el("div", { className: "results-heading" }, [
        el("div", {}, [
          el("p", { className: "eyebrow", textContent: "Upcoming" }),
          el("h2", { textContent: "Events near you" }),
        ]),
        el("span", {
          className: "results-count",
          textContent: `${events.length} experiences`,
        }),
      ]),
      results,
    ]),
  );
}

init();
