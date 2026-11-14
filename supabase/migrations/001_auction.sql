-- WoW Forever auction summaries.
-- Prices are integer copper. 100 copper = 1 silver. 10,000 copper = 1 gold.
-- The scanner writes with the service-role key. A later website reads with the anon key.

-- One row per Blizzard auction house we actually store.
-- House ids such as 113 repeat across regions, so the real key includes region and ruleset.
create table houses (
  id bigint generated always as identity primary key,
  region text not null,
  ruleset_id integer not null,
  blizzard_id integer not null,
  name text not null,
  faction text not null check (faction in ('alliance', 'horde', 'blackwater')),
  updated_at timestamptz not null default now(),
  unique (region, ruleset_id, blizzard_id)
);

-- Item names come from the static API, a few dozen per scan.
-- id is the Blizzard item id. name stays null until that lookup succeeds.
create table items (
  id integer primary key,
  name text,
  quality text,
  item_level integer,
  vendor_sell_copper integer,
  icon_url text,
  item_class text,
  fetched_at timestamptz
);

-- One row per house per 15-minute window. This is the freshness log, not the price history.
create table scans (
  id bigint generated always as identity primary key,
  house_id bigint not null references houses (id),
  scanned_at timestamptz not null,
  item_count integer not null,
  status text not null check (status in ('success', 'failed')),
  unique (house_id, scanned_at)
);

-- Latest market for each item. Overwritten every successful scan.
-- is_listed goes false when the item is missing, and the last prices stay put.
create table latest_prices (
  house_id bigint not null references houses (id),
  item_id integer not null,
  p10_price bigint not null,
  median_price bigint not null,
  quantity bigint not null,
  average_price bigint not null,
  is_listed boolean not null default true,
  scanned_at timestamptz not null,
  primary key (house_id, item_id)
);

-- One summary per item per UTC day.
-- The four price fields are the latest scan of that day.
-- p10_low is the cheapest P10 seen that day, so a midday undercut is kept.
create table daily_prices (
  house_id bigint not null references houses (id),
  item_id integer not null,
  day date not null,
  p10_price bigint not null,
  median_price bigint not null,
  quantity bigint not null,
  average_price bigint not null,
  p10_low bigint not null,
  primary key (house_id, item_id, day)
);

-- A later item page looks up one item across houses and days.
create index latest_prices_item_id_idx on latest_prices (item_id);
create index daily_prices_item_day_idx on daily_prices (item_id, day desc);

-- Insert or update today's row. p10_low only ever moves downward.
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
    p10_low
  )
  select
    (entry->>'house_id')::bigint,
    (entry->>'item_id')::integer,
    (entry->>'day')::date,
    (entry->>'p10_price')::bigint,
    (entry->>'median_price')::bigint,
    (entry->>'quantity')::bigint,
    (entry->>'average_price')::bigint,
    (entry->>'p10_low')::bigint
  from jsonb_array_elements(rows) as entry
  on conflict (house_id, item_id, day) do update
  set
    p10_price = excluded.p10_price,
    median_price = excluded.median_price,
    quantity = excluded.quantity,
    average_price = excluded.average_price,
    p10_low = least(daily_prices.p10_low, excluded.p10_low);
end;
$$;

-- Items we did not see in this scan keep their last prices but are no longer listed.
-- Rows written by this scan share seen_at, so the strict less-than leaves them alone.
create or replace function mark_unlisted(target_house_id bigint, seen_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update latest_prices
  set is_listed = false
  where house_id = target_house_id
    and scanned_at < seen_at
    and is_listed = true;
end;
$$;

-- Drop daily history older than keep_days so the free 500 MB database stays bounded.
create or replace function delete_old_daily_prices(keep_days integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from daily_prices
  where day < ((now() at time zone 'utc')::date - keep_days);
end;
$$;

-- The website can read. Only the scanner (service role) can call the write functions.
revoke all on function upsert_daily_prices(jsonb) from public, anon, authenticated;
revoke all on function mark_unlisted(bigint, timestamptz) from public, anon, authenticated;
revoke all on function delete_old_daily_prices(integer) from public, anon, authenticated;
grant execute on function upsert_daily_prices(jsonb) to service_role;
grant execute on function mark_unlisted(bigint, timestamptz) to service_role;
grant execute on function delete_old_daily_prices(integer) to service_role;

grant select on houses, items, scans, latest_prices, daily_prices to anon, authenticated;
grant all on houses, items, scans, latest_prices, daily_prices to service_role;

alter table houses enable row level security;
alter table items enable row level security;
alter table scans enable row level security;
alter table latest_prices enable row level security;
alter table daily_prices enable row level security;

create policy houses_public_read on houses for select to anon, authenticated using (true);
create policy items_public_read on items for select to anon, authenticated using (true);
create policy scans_public_read on scans for select to anon, authenticated using (true);
create policy latest_prices_public_read on latest_prices for select to anon, authenticated using (true);
create policy daily_prices_public_read on daily_prices for select to anon, authenticated using (true);
