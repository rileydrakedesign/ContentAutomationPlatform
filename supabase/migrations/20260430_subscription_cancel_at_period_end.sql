-- Track Stripe's cancel_at_period_end so the dashboard can show a
-- "Cancels on <date>" hint when the user has scheduled cancellation
-- via the Billing Portal.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
