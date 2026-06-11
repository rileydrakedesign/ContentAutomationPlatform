#!/usr/bin/env node
/**
 * Idempotently create the Stripe products/prices for credit packs and the
 * optional Agent plan, then print the env vars to set.
 *
 * Usage:
 *   node scripts/stripe-setup-credits.mjs            # uses STRIPE_SECRET_KEY from .env.local
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup-credits.mjs   # live run (human)
 *
 * Idempotency: each price carries a unique lookup_key; re-runs reuse the
 * existing price instead of creating duplicates.
 */
import Stripe from "stripe";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is not set (.env.local or env)");
  process.exit(1);
}
const mode = key.startsWith("sk_live") ? "LIVE" : "TEST";

// Live mode is a deliberate human action (MCP_PROD_READINESS_PLAN.md §D3):
// require an explicit --live flag so automation can only ever touch test mode.
if (mode === "LIVE" && !process.argv.includes("--live")) {
  console.error(
    "Refusing to run against LIVE Stripe without the --live flag.\n" +
      "Live setup is a human launch task: node scripts/stripe-setup-credits.mjs --live"
  );
  process.exit(1);
}

const stripe = new Stripe(key);

// Locked pricing: MCP_PROD_READINESS_PLAN.md §B2.
const PACKS = [
  { lookupKey: "credits_500", name: "Credit Pack — 500", credits: 500, usd: 600, env: "STRIPE_PRICE_CREDITS_500" },
  { lookupKey: "credits_2000", name: "Credit Pack — 2,000", credits: 2000, usd: 2000, env: "STRIPE_PRICE_CREDITS_2000" },
  { lookupKey: "credits_10000", name: "Credit Pack — 10,000", credits: 10000, usd: 8000, env: "STRIPE_PRICE_CREDITS_10000" },
];

const AGENT_PLAN = {
  lookupKey: "plan_agent",
  name: "Agent Plan",
  usd: 7900,
  env: "NEXT_PUBLIC_STRIPE_AGENT_PRICE_ID",
};

async function findPriceByLookupKey(lookupKey) {
  const res = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  return res.data[0] ?? null;
}

async function ensurePrice({ lookupKey, name, usd, credits, recurring }) {
  const existing = await findPriceByLookupKey(lookupKey);
  if (existing) {
    console.log(`  ✓ ${lookupKey}: exists (${existing.id})`);
    return existing.id;
  }

  const product = await stripe.products.create({
    name,
    metadata: credits
      ? { pack_id: lookupKey, credits: String(credits) }
      : { plan_id: "agent" },
  });

  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: usd,
    lookup_key: lookupKey,
    ...(recurring ? { recurring: { interval: "month" } } : {}),
    tax_behavior: "exclusive",
  });

  console.log(`  + ${lookupKey}: created (${price.id})`);
  return price.id;
}

console.log(`Stripe mode: ${mode}\n`);
console.log("Credit packs (one-time):");
const envLines = [];
for (const pack of PACKS) {
  const id = await ensurePrice(pack);
  envLines.push(`${pack.env}=${id}`);
}

console.log("\nAgent plan ($79/mo, optional — ship/hold is a launch decision):");
const agentId = await ensurePrice({ ...AGENT_PLAN, recurring: true });
envLines.push(`${AGENT_PLAN.env}=${agentId}  # only set this when launching the Agent tier`);

console.log(`\nSet these in Vercel (${mode} mode) and .env.local:\n`);
for (const line of envLines) console.log(`  ${line}`);
console.log(
  "\nReminder: the webhook endpoint must receive checkout.session.completed (it already does) — no new webhook events are needed for packs."
);
