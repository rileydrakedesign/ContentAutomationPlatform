-- Integrity: one subscription row per Stripe customer (resolveUserId looks up
-- by stripe_customer_id, which must be unambiguous), and a partial index for
-- the publish sweep's hot query (WHERE status='scheduled' ORDER BY scheduled_for).
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_customer_id_key
  ON subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due
  ON scheduled_posts (scheduled_for)
  WHERE status = 'scheduled';
