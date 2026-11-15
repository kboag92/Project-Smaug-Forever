-- Neutral auction history is kept for a few days. Alliance history is not touched.
-- latest_prices is one current row per item, so this delete leaves the live book alone.
-- The scanner calls this with the neutral house id only.

create or replace function delete_house_history(target_house_id bigint, keep_days integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from scan_prices
  where house_id = target_house_id
    and scanned_at < (now() - make_interval(days => keep_days));

  delete from daily_prices
  where house_id = target_house_id
    and day < ((now() at time zone 'utc')::date - keep_days);
end;
$$;

revoke all on function delete_house_history(bigint, integer) from public, anon, authenticated;
grant execute on function delete_house_history(bigint, integer) to service_role;
