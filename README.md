# Flight Price Advisor

A full-stack web app that helps you decide **whether to buy plane tickets now or wait for a better fare**. Track multiple trips, get smart buy-or-wait recommendations backed by a multi-factor scoring engine, and see real price trends from Google Flights.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)

## What it does

- **Track multiple trips** in a dashboard with buy/wait/monitor recommendations.
- **Multi-factor recommendation engine** — considers booking window, seasonality, holidays, price trends, route characteristics, nonstop restrictions, and user risk tolerance.
- **Real price data** via SerpAPI Google Flights with fallbacks to Travelpayouts and Duffel.
- **60-day historical price chart** for each tracked trip (when using SerpAPI).
- **Plain-English explanations** for every recommendation.
- **Alerts system** for price drops, spikes, and deal thresholds.
- **Risk tolerance profiles** — conservative, balanced, or aggressive.

## Example recommendation output

For the seeded trip (ORD → SJD, Jan 2–9 2027, nonstop only, balanced risk):

> Your ORD to SJD (nonstop only) trip is 8 months away at $678 per person. The situation is balanced — there are reasons to wait and reasons to act. Prices have been stable, so you have some breathing room. We recommend monitoring prices closely and setting a price alert. However, note that your dates overlap with Winter Holidays, so don't wait too long.

## Tech stack

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Styling**: Tailwind CSS 4
- **Charts**: Recharts
- **Persistence**: `localStorage` (no database required)
- **Flight data**: SerpAPI Google Flights (primary), Travelpayouts (fallback), Duffel test mode (fallback), simulator (final fallback)

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── live-flights/       # Price lookup w/ fallback chain
│   │   ├── recommend/          # Run the recommendation engine
│   │   ├── trips/              # Search offers (sim)
│   │   └── alerts/             # Alert condition evaluator
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Dashboard.tsx           # Main dashboard with stats + trip list
│   ├── TripCard.tsx            # Expandable card with chart + analysis
│   ├── TripForm.tsx            # Add-trip form
│   ├── PriceChart.tsx          # Recharts area chart
│   ├── RecommendationBadge.tsx
│   └── AlertsPanel.tsx
└── lib/
    ├── types.ts                # All shared types
    ├── recommendation-engine.ts # 7-factor scoring logic
    ├── price-simulator.ts      # Realistic simulated pricing
    ├── serpapi.ts              # SerpAPI Google Flights client
    ├── travelpayouts.ts        # Travelpayouts/Aviasales client
    ├── duffel.ts               # Duffel test-mode client
    └── store.ts                # localStorage persistence
```

## How the recommendation engine works

For each trip, the engine evaluates these factors and produces a buy/wait/monitor verdict with a confidence score (0–100):

| Factor | Impact |
|---|---|
| **Booking window** | <30 days → strong buy. 2–4 months → neutral/buy. 6+ months → wait. |
| **Peak travel / holidays** | Winter holidays, spring break, July 4th, etc. add urgency. |
| **Nonstop-only restriction** | Limits inventory, increases urgency. |
| **Leisure route** | Higher volatility, more seasonality. |
| **Price trend** | Rising prices → buy. Falling → wait. |
| **Current vs historical average** | >10% above avg → wait. <10% below → buy. |
| **Risk tolerance** | Conservative shifts toward earlier buy. Aggressive shifts toward later. |

Each factor is weighted and summed into a score (0–100). Thresholds: ≥65 = buy, 40–65 = monitor, <40 = wait.

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/flight-price-advisor.git
cd flight-price-advisor
npm install
```

### 2. Set up API keys (all optional — app works with simulated data)

Create a `.env.local` file:

```env
# Primary: Real Google Flights data + 60-day price history
# Get free trial (100 searches) at https://serpapi.com/users/sign_up
SERPAPI_KEY=your_key_here

# Fallback 1: Real aggregated price data
# Get free key at https://travelpayouts.com → connect Aviasales program
TRAVELPAYOUTS_TOKEN=your_token_here

# Fallback 2: Duffel sandbox (not real prices, useful for UI testing)
# Get free test token at https://app.duffel.com → Developers → Access tokens
DUFFEL_API_TOKEN=your_token_here
```

Without any keys, the app uses the simulator — recommendations still work, they're just based on modeled prices instead of real ones.

### 3. Run

```bash
npm run dev
```

Open http://localhost:3000 (or 3001 if 3000 is taken).

## Data source fallback chain

The `/api/live-flights` endpoint tries sources in this order:

1. **SerpAPI Google Flights** — real scraped Google Flights data, includes 60-day price history and typical price range classification
2. **Travelpayouts / Aviasales** — real aggregated prices from partner search engines (Kiwi, Trip.com, etc.); may be stale by hours to days
3. **Duffel test mode** — realistic-shaped but fake data; useful for testing UI plumbing
4. **Simulator** — modeled prices based on route, season, holidays, and booking window

Each trip card displays a badge indicating which source the price came from:

- 🟢 **Live (Google Flights)** — SerpAPI
- 🟢 **Live (Aggregated)** — Travelpayouts
- 🔵 **Sandbox** — Duffel test data
- 🟡 **Simulated** — simulator fallback

## Known limitations

- **Free-tier quotas**: SerpAPI free trial = 100 searches total. Each trip card load uses 1 search (responses are cached in-memory for 1 hour to reduce usage).
- **Niche or far-future routes**: Travelpayouts' cache is thin for uncommon routes (e.g., ORD → SJD 9 months out). The app falls back automatically to the next source.
- **No persistent alert worker**: The `/api/alerts` endpoint evaluates alert conditions but isn't wired to a cron yet. To get real alerts over time, schedule that endpoint to run daily.
- **No real booking**: This is an advisory tool. To actually book flights, follow the link to Google Flights or an airline site.

## Potential enhancements

- Scheduled worker to snapshot live prices daily and build up real historical trends per trip
- Email/SMS notifications via Resend or Twilio when recommendations change
- Multi-city / flexible-date support
- Integration with Duffel production for in-app booking
- Sharing a trip card as a public URL

## License

MIT
