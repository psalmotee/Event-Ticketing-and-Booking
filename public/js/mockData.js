export const events = [
  {
    id: "lagos-tech-meetup",
    title: "Lagos Tech Meetup",
    city: "Lagos",
    venue: "Civic Hall",
    date: "2026-12-05T17:00:00Z",
    published: true,
    description:
      "An evening of product talks, demos and community connections.",
    tiers: [
      {
        id: "lagos-general",
        name: "General",
        priceCents: 500000,
        capacity: 100,
        available: 42,
      },
      {
        id: "lagos-vip",
        name: "VIP",
        priceCents: 1200000,
        capacity: 30,
        available: 0,
      },
    ],
  },
  {
    id: "afrobeats-live",
    title: "Afrobeats Live",
    city: "Abuja",
    venue: "The Arena",
    date: "2026-12-12T18:30:00Z",
    published: true,
    description: "A high-energy live showcase featuring the best in Afrobeats.",
    tiers: [
      {
        id: "afro-regular",
        name: "Regular",
        priceCents: 250000,
        capacity: 200,
        available: 85,
      },
      {
        id: "afro-premium",
        name: "Premium",
        priceCents: 750000,
        capacity: 50,
        available: 8,
      },
    ],
  },
  {
    id: "design-summit",
    title: "Design Summit 2027",
    city: "Lagos",
    venue: "Radisson Conference Centre",
    date: "2027-01-16T09:00:00Z",
    published: true,
    description:
      "A practical day for designers, researchers and design leaders.",
    tiers: [
      {
        id: "design-standard",
        name: "Standard",
        priceCents: 350000,
        capacity: 80,
        available: 21,
      },
    ],
  },
  {
    id: "comedy-night",
    title: "Comedy Under the Stars",
    city: "Port Harcourt",
    venue: "Riverside Park",
    date: "2026-12-20T19:00:00Z",
    published: true,
    description:
      "Open-air comedy with a brilliant line-up of Nigerian performers.",
    tiers: [
      {
        id: "comedy-entry",
        name: "Entry",
        priceCents: 180000,
        capacity: 150,
        available: 61,
      },
      {
        id: "comedy-front",
        name: "Front row",
        priceCents: 420000,
        capacity: 40,
        available: 4,
      },
    ],
  },
];
