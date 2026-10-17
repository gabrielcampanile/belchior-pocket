-- Bitcoin as a currency (manual accounts). BTC amounts are stored in satoshis (8 decimals)
-- in the same *_cents bigint columns; the per-currency decimals live in
-- src/domain/currency.ts. 21M BTC = 2.1e15 sats, far below bigint (and JS) limits.
alter type public.currency_code add value if not exists 'BTC';

-- A BRL->BTC rate is ~0.0000028: numeric(20,10) would keep only ~5 significant digits.
-- Unconstrained numeric keeps the exact value returned by the source.
alter table public.exchange_rates alter column rate type numeric;
