-- One row per item per scan.
-- scanned_at is the real save time, not the quarter-hour mark on the scans table.
-- These rows are the 15-minute history of P10, median, quantity, and average.
-- They are kept. The scanner does not delete them by age.

create table scan_prices (
  house_id bigint not null references houses (id),
  item_id integer not null,
  scanned_at timestamptz not null,
  p10_price bigint not null,
  median_price bigint not null,
  quantity bigint not null,
  average_price bigint not null,
  primary key (house_id, item_id, scanned_at)
);

-- A later item page reads one item from newest scan to oldest.
create index scan_prices_item_time_idx on scan_prices (item_id, scanned_at desc);

grant select on scan_prices to anon, authenticated;
grant all on scan_prices to service_role;

alter table scan_prices enable row level security;

create policy scan_prices_public_read on scan_prices
  for select to anon, authenticated
  using (true);
