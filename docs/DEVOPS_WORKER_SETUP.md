# BE@RBRICK Crowd-Sourced Pricing Engine — Worker Setup (DevOps)

This doc is for DevOps to run the **3 workers** required by the Node.js backend.

---

## 1. Overview

| Worker        | Purpose                                                                          | How to run                      |
| ------------- | -------------------------------------------------------------------------------- | ------------------------------- |
| **Enrich**    | `vote_intents` → `vote_events` (credits, fair range, user weight)                | Run continuously (loop or PM2)  |
| **Aggregate** | `vote_events` → `brick_price_state` (sentiment, caps, momentum, freeze, recheck) | Run continuously (loop or PM2)  |
| **Snapshot**  | Daily close → `brick_price_history`                                              | Once per day on schedule (cron) |

**Order:** Enrich runs before Aggregate. Snapshot is independent, run once daily.

---

## 2. Prerequisites

- Node.js 18+
- App repo cloned, `npm install` done
- `.env` configured (at least `DATABASE_URL`, `JWT_SECRET`; optional `WORKER_LOOP_INTERVAL_MS` for loop interval in ms)
- PostgreSQL up; migrations and seed applied:
  ```bash
  npx prisma migrate deploy
  npm run db:seed
  ```

---

## 3. Option A — Single loop process (Enrich + Aggregate)

One process runs **enrich** then **aggregate** in a loop. Easiest for small/medium load.

**Script:** `npm run worker:loop`

- Runs: `node src/scripts/enrich-votes.js` then `node src/scripts/aggregate-prices.js`, then sleeps.
- **Env:** `WORKER_LOOP_INTERVAL_MS` (default `60000` = 1 minute).

**Run with PM2 example:**

```bash
cd /path/to/crowd-sourced-node
WORKER_LOOP_INTERVAL_MS=60000 pm2 start npm --name "pricing-worker-loop" -- run worker:loop
pm2 save
pm2 startup   # if not already done
```

**Snapshot:** Run separately on a schedule (see Section 5).

---

## 4. Option B — Separate Enrich and Aggregate processes

Run two long‑running processes: one for enrich, one for aggregate.

**Enrich:**

```bash
pm2 start npm --name "pricing-worker-enrich" -- run worker:enrich
```

**Aggregate:**

```bash
pm2 start npm --name "pricing-worker-aggregate" -- run worker:aggregate
```

Adjust restart policy / cron if you want them to run on an interval instead of 24/7 (e.g. every 1–2 min via cron calling the same npm scripts).

**Snapshot:** Run separately on a schedule (see Section 5).

---

## 5. Snapshot worker (daily)

Snapshot writes daily close to `brick_price_history`. Run **once per day** at a fixed time (e.g. 11:07 PM EST = 04:07 UTC next day, or as per product).

**One-off run:**

```bash
cd /path/to/crowd-sourced-node
npm run worker:snapshot
```

**Cron example (daily at 04:07 UTC):**

```cron
7 4 * * * cd /path/to/crowd-sourced-node && npm run worker:snapshot >> /var/log/pricing-snapshot.log 2>&1
```

Replace `/path/to/crowd-sourced-node` with actual app path. Ensure cron user has correct `.env` and `node` in PATH.

### 5.1 Cron Management

**Adding/Editing Cron Jobs:**

```bash
# Edit crontab
crontab -e

# View current crontab
crontab -l

# Remove all cron jobs (careful!)
crontab -r
```

**Example Cron Entry (daily at 04:07 UTC):**

```cron
7 4 * * * cd /path/to/bearbrick-backend && npm run worker:snapshot >> /var/log/pricing-snapshot.log 2>&1
```

**Cron Syntax:**

```
* * * * * command
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday = 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

**Common Cron Patterns:**

- `0 * * * *` - Every hour
- `*/5 * * * *` - Every 5 minutes
- `0 0 * * *` - Daily at midnight
- `0 4 * * *` - Daily at 4 AM UTC
- `7 4 * * *` - Daily at 04:07 UTC (11:07 PM EST previous day)

**Verifying Cron:**

```bash
# Check cron service status
sudo systemctl status cron  # Ubuntu/Debian
sudo systemctl status crond  # CentOS/RHEL

# View cron logs
grep CRON /var/log/syslog  # Ubuntu/Debian
grep CRON /var/log/messages  # CentOS/RHEL

# Test cron job manually
cd /path/to/bearbrick-backend && npm run worker:snapshot
```

**Important Notes:**

- Cron runs with minimal environment variables. Set PATH and load `.env` explicitly if needed:

  ```cron
  7 4 * * * cd /path/to/bearbrick-backend && /usr/bin/node /path/to/npm run worker:snapshot >> /var/log/pricing-snapshot.log 2>&1
  ```

- Use absolute paths in cron jobs
- Ensure the cron user has read access to `.env` file
- Log output to a file for debugging

**Alternative: Using PM2 Cron (Recommended)**

PM2 supports cron-like scheduling without system cron:

```bash
# Install PM2
npm install -g pm2

# Start snapshot with PM2 cron
pm2 start npm --name "pricing-snapshot" --cron "7 4 * * *" -- run worker:snapshot

# Or use ecosystem file
pm2 start ecosystem.config.js
```

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: "pricing-snapshot",
      script: "npm",
      args: "run worker:snapshot",
      cron_restart: "7 4 * * *",
      autorestart: false,
    },
  ],
};
```

---

## 6. Summary checklist

- [ ] Node 18+, dependencies installed, `.env` and DB ready
- [ ] **Enrich + Aggregate:** Either `worker:loop` (Option A) or separate `worker:enrich` + `worker:aggregate` (Option B) running continuously (e.g. PM2)
- [ ] **Snapshot:** Cron (or scheduler) running `npm run worker:snapshot` once per day
- [ ] Logs/monitoring for all worker processes (PM2 logs, cron log path as above)

---

## 7. Useful commands

| Command                    | Description                                     |
| -------------------------- | ----------------------------------------------- |
| `npm run worker:enrich`    | Run enrich once                                 |
| `npm run worker:aggregate` | Run aggregate once                              |
| `npm run worker:snapshot`  | Run snapshot once                               |
| `npm run worker:loop`      | Run enrich → aggregate in a loop (use with PM2) |

PM2: `pm2 list`, `pm2 logs`, `pm2 restart <name>`.
