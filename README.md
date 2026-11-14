# Forever auction scan

This job reads the WoW: Forever auction houses from the Blizzard API every 15 minutes. It stores four numbers per item:

- **P10 price** — average unit price of the cheapest 10% of the listed quantity
- **Median price** — unit price at the halfway point of that quantity
- **Quantity** — units listed
- **Average** — average unit price across every listed unit

Prices are integer copper. Raw listings are not stored. The live row is overwritten each scan. The daily row keeps those four numbers from the latest scan of that UTC day, plus `p10_low`, the cheapest P10 seen that day.

The default market is US PvP (ruleset 1), Alliance only. Change `region`, `rulesetId`, and `factions` in [src/config.ts](src/config.ts) for another market. Several houses share the Alliance name. The job keeps the fullest non-empty one and skips a house whose listing ids match one already kept.

## One-time setup

1. Create a client at [develop.battle.net](https://develop.battle.net/). The scanner uses the client-credentials flow, so a redirect URL is not required.
2. Create a free project at [supabase.com](https://supabase.com/).
3. Open the Supabase SQL editor and run [supabase/migrations/001_auction.sql](supabase/migrations/001_auction.sql).
4. Copy `.env.example` to `.env` and fill in the Battle.net client id and secret, the Supabase URL, and the service-role key.

## Run

```bash
npm install
npm test
npm start
```

`npm test` checks the price math and does not call Blizzard or Supabase. `npm start` does one live scan.

## Schedule

GitHub Actions runs the scan every 15 minutes from [.github/workflows/scan.yml](.github/workflows/scan.yml). Standard runners are free on a **public** repository. Add these repository secrets:

- `BNET_CLIENT_ID`
- `BNET_CLIENT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

You can also start the workflow by hand from the Actions tab.

A later website or companion app can read `latest_prices`, `daily_prices`, `items`, `houses`, and `scans` with the Supabase anon key. That key is select-only. Do not put the service-role key in a website.
