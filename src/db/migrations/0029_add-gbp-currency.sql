-- Add GBP to the currency_code enum so GB sellers can price in pounds.
-- IF NOT EXISTS keeps the re-run a no-op (run-migrations.sh convention).
-- Safe inside the psql -1 transaction because the new value is NOT
-- consumed in this same file — PG16 only forbids using a freshly added
-- enum value within the transaction that added it.
ALTER TYPE currency_code ADD VALUE IF NOT EXISTS 'GBP';
