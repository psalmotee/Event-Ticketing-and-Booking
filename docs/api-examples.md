# Build 4 API examples

Start the server with `npm start`, then run these calls in order.

```bash
# Create an event
curl -X POST http://localhost:3000/api/events \
  -H "content-type: application/json" \
  -d '{"title":"Lagos Tech Meetup","city":"Lagos","venue":"Civic Hall","date":"2026-12-05T17:00:00Z"}'

# Add a ticket tier (replace EVENT_ID with the returned id)
curl -X POST http://localhost:3000/api/events/EVENT_ID/tiers \
  -H "content-type: application/json" \
  -d '{"name":"General","priceCents":500000,"capacity":100}'

# Publish the event
curl -X POST http://localhost:3000/api/events/EVENT_ID/publish

# Search published events
curl "http://localhost:3000/api/events?q=tech&city=lagos&sort=date"

# Book tickets (replace TIER_ID with the tier id)
curl -X POST http://localhost:3000/api/bookings \
  -H "content-type: application/json" -H "x-user-id: attendee-1" \
  -d '{"eventId":"EVENT_ID","tierId":"TIER_ID","quantity":2}'

# Pay a booking (replace REFERENCE with the returned reference)
curl -X POST http://localhost:3000/api/bookings/REFERENCE/pay \
  -H "content-type: application/json" -H "x-user-id: attendee-1" \
  -d '{}'

# Cancel an unpaid booking
curl -X POST http://localhost:3000/api/bookings/REFERENCE/cancel \
  -H "x-user-id: attendee-1"
```
