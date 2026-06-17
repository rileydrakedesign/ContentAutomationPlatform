#!/usr/bin/env node
/**
 * Register (idempotently) a QStash schedule that triggers the publish-scheduled
 * safety-net sweep every 5 minutes. This gives sub-daily recovery of missed /
 * stuck scheduled posts WITHOUT needing a Vercel Pro cron — QStash schedules are
 * not Vercel crons and are included in the QStash free tier (≤1,000 schedules,
 * ≤1,000 messages/day; a 5-min sweep is 288/day).
 *
 * The sweep's POST handler verifies the QStash signature, so no secret is stored
 * in the schedule config.
 *
 * Run once per environment:
 *   node scripts/setup-qstash-schedule.mjs
 *
 * Requires QSTASH_TOKEN and APP_URL (or NEXT_PUBLIC_APP_URL). Loads .env.local
 * if present.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Client } from "@upstash/qstash";

const token = process.env.QSTASH_TOKEN;
const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

if (!token || !appUrl) {
  console.error("Missing QSTASH_TOKEN or APP_URL/NEXT_PUBLIC_APP_URL");
  process.exit(1);
}

const destination = `${appUrl}/api/cron/publish-scheduled`;
const cron = "*/5 * * * *";
const qstash = new Client({ token });

const existing = await qstash.schedules.list();
const match = existing.find((s) => s.destination === destination);
if (match) {
  console.log(`Schedule already exists (${match.scheduleId}): ${match.cron} -> ${destination}`);
  process.exit(0);
}

const { scheduleId } = await qstash.schedules.create({
  destination,
  cron,
  body: JSON.stringify({ trigger: "publish-sweep" }),
  headers: { "Content-Type": "application/json" },
});

console.log(`Created QStash schedule ${scheduleId}: ${cron} -> ${destination}`);
