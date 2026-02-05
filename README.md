# BE@RBRICK Crowd-Sourced Pricing Engine (Node.js)

Backend-only Node.js app implementing the same crowd-sourced pricing engine
Follows **SPECIFICATION.md** and **CLARIFICATIONS.md** (event-sourced, deterministic workers).

## Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **DB:** PostgreSQL + Prisma
- **Auth:** JWT (Bearer)

## Setup

```bash
cp .env.example .env
# Set DATABASE_URL, JWT_SECRET

npm install
npx prisma migrate dev --name init
npm run db:seed
```

## Run API

```bash
npm run dev
# or: npm start
```

API base: `http://localhost:3000/api`

## Routes

| Method | Path                          | Auth     | Description                                                 |
| ------ | ----------------------------- | -------- | ----------------------------------------------------------- |
| POST   | `/api/login`                  | —        | Body: `{ "email", "password" }`                             |
| POST   | `/api/logout`                 | Bearer   | Revoke (client discards token)                              |
| GET    | `/api/me`                     | Bearer   | Current user                                                |
| POST   | `/api/vote_intents`           | Bearer   | Body: `{ "brick_id", "vote_type" }` (UNDER \| FAIR \| OVER) |
| GET    | `/api/bricks`                 | Optional | All bricks info (sentiment only if user has voted)          |
| GET    | `/api/bricks/:brick_id/state` | Optional | Single brick state (sentiment only if user has voted)       |

## Workers (spec Appendix B)

Run in order: **enrich** → **aggregate**. Snapshot on schedule (e.g. 11:07 PM EST).

```bash
npm run worker:enrich    # vote_intents → vote_events (credits, fair range, user weight)
npm run worker:aggregate # vote_events → brick_price_state (sentiment, caps, momentum, freeze, cycle)
npm run worker:snapshot  # daily close → brick_price_history
```

- **Enrich:** UserIdentityState, credit regain, baseline from history, XP events.
- **Aggregate:** Movement eligibility, anchor/intensity/caps, momentum, freeze, cycle reset, recheck.

Use Supervisor/PM2 or cron to run workers continuously.

## Project structure

- `config/pricing.js` — fair range, tiers, caps, credits, freeze, cycle, catch-up (env-overridable)
- `prisma/` — schema, migrations, seed
- `src/`
  - `controllers/` — Auth, Brick, VoteIntent
  - `middleware/` — auth, optionalAuth
  - `routes/api.js`
  - `services/` — AuthService, VoteCreditService
  - `services/pricing/` — Sentiment, Confidence, Reliability, MovementEligibility, Intensity, Cap, Momentum, Anchor, Cycle, Freeze, OrderAware, Recheck, FairRange, PricingTier, UserWeight
  - `scripts/` — enrich-votes, aggregate-prices, snapshot

## Manual / logic testing (SPECIFICATION + CLARIFICATIONS)

- **Get brick ID:** `node scripts/inspect-db.js brick-id`
- **Reset cursors/credits (test):** `npm run reset:cursors`, `npm run reset:credits`
- **Full flow test (intent → enrich → aggregate → state):** `npm run test:flow`
- ** logic test (DB insert + enrich + aggregate + credits + sentiment + snapshot):** `npm run test:logic`
  [docs/MANUAL_TEST_STEPS.md](./docs/MANUAL_TEST_STEPS.md), [docs/LOCAL_TESTING.md](./docs/LOCAL_TESTING.md).

## Testing (Jest)

API tests need a running DB (same as dev). Run seed first: `npm run db:seed`.

```bash
npm test          # all tests
npm run test:unit # unit tests only (pricing services)
npm run test:api  # API tests only (health, auth, bricks, vote_intents)
```

- **Unit:** Sentiment, FairRange, PricingTier, Confidence, MovementEligibility, Intensity, Anchor, Momentum, Freeze, Cap (no DB).
- **API:** Health, login (validation + success), me, logout, bricks state (404, 200 without auth), vote_intents (401, 422, 201).

## Test user (after seed)

- Email: `admin@example.com`
- Password: `password123`
