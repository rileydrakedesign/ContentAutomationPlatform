-- Defense-in-depth: a purchased credit pack must be fulfilled exactly once per
-- Stripe checkout session. The webhook already claims each event via the
-- stripe_events PK (so Stripe re-delivering the SAME event id is a no-op), but
-- there is no DB-level guard if pack fulfillment is ever re-driven under a
-- different event id for the same session. A partial unique index on the ledger
-- reference (= the Stripe session id) makes a double-grant impossible at the
-- storage layer.
--
-- Scope is limited to pack purchases so ordinary debits/refunds (which reuse
-- reference ids like a scheduled_post id, or leave it null) are unaffected.
create unique index if not exists credit_ledger_pack_purchase_ref_uniq
  on public.credit_ledger (reference_id)
  where action = 'pack.purchase';
