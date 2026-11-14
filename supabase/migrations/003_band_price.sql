-- Average unit price of the quantity after the cheapest 10% and through the cheapest 50%.
-- Nullable so rows saved before this column stay as they are. A missing band is a gap, not zero.
-- Apply this in the Supabase SQL editor before the scanner that writes band_price runs.

alter table latest_prices add column band_price bigint;
alter table scan_prices add column band_price bigint;
alter table daily_prices add column band_price bigint;

-- Same daily upsert as 001, plus the band. p10_low still only moves downward.
create or replace function upsert_daily_prices(rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into daily_prices (
    house_id,
    item_id,
    day,
    p10_price,
    median_price,
    quantity,
    average_price,
    p10_low,
    band_price
  )
  select
    (entry->>'house_id')::bigint,
    (entry->>'item_id')::integer,
    (entry->>'day')::date,
    (entry->>'p10_price')::bigint,
    (entry->>'median_price')::bigint,
    (entry->>'quantity')::bigint,
    (entry->>'average_price')::bigint,
    (entry->>'p10_low')::bigint,
    (entry->>'band_price')::bigint
  from jsonb_array_elements(rows) as entry
  on conflict (house_id, item_id, day) do update
  set
    p10_price = excluded.p10_price,
    median_price = excluded.median_price,
    quantity = excluded.quantity,
    average_price = excluded.average_price,
    p10_low = least(daily_prices.p10_low, excluded.p10_low),
    band_price = excluded.band_price;
end;
$$;

-- Replacing the function keeps the old grants, but say so again so a fresh run is enough.
revoke all on function upsert_daily_prices(jsonb) from public, anon, authenticated;
grant execute on function upsert_daily_prices(jsonb) to service_role;
