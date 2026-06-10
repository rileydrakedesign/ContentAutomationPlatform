-- Out-of-order Stripe event guard: record the Stripe event.created timestamp
-- that last wrote the row so older (delayed/retried) events can be skipped.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_event_created TIMESTAMPTZ;
