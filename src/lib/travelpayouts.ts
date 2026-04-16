/**
 * Travelpayouts / Aviasales Data API client - server-side only.
 * Docs: https://travelpayouts.github.io/slate/
 *
 * KEY GOTCHA: Travelpayouts indexes by IATA *city* code (CHI, NYC, LON)
 * not airport code (ORD, JFK, LHR). We map airport -> city before querying.
 *
 * Data comes from real user searches across partner sites (Aviasales, Kiwi,
 * Trip.com, etc.) so it's real prices but may be hours to days stale.
 * Niche routes or far-future dates may have no data.
 */

const BASE = "https://api.travelpayouts.com";

// Airport IATA -> City IATA mapping (common US + leisure destinations)
const AIRPORT_TO_CITY: Record<string, string> = {
  ORD: "CHI", MDW: "CHI",
  JFK: "NYC", LGA: "NYC", EWR: "NYC",
  LAX: "LAX", BUR: "LAX", LGB: "LAX", ONT: "LAX",
  SFO: "SFO", OAK: "SFO", SJC: "SFO",
  DCA: "WAS", IAD: "WAS", BWI: "WAS",
  HNL: "HNL", OGG: "OGG", KOA: "KOA", LIH: "LIH",
  IAH: "HOU", HOU: "HOU",
  DFW: "DFW", DAL: "DFW",
  MIA: "MIA", FLL: "MIA",
  SJD: "SJD", CUN: "CUN", PVR: "PVR", MEX: "MEX",
  // Most others: airport code == city code
};

function toCityCode(airport: string): string {
  return AIRPORT_TO_CITY[airport] || airport;
}

export interface TPFlight {
  price: number;
  airline: string;
  flightNumber: string;
  departureAt: string;
  returnAt: string;
  numberOfChanges: number;
  foundAt: string;
  duration: number;
}

export interface TPHistoryPoint {
  date: string;
  price: number;
  airline: string;
}

interface LatestPriceItem {
  value: number;
  trip_class: number;
  show_to_affiliates: boolean;
  return_date: string;
  origin: string;
  destination: string;
  depart_date: string;
  distance: number;
  actual: boolean;
  number_of_changes: number;
  found_at: string;
  gate: string;
  duration?: number;
}

interface LatestPriceResponse {
  success: boolean;
  data?: LatestPriceItem[];
  error?: string;
}

async function fetchLatest(
  originCity: string,
  destCity: string,
  opts: { month?: string; limit?: number } = {}
): Promise<LatestPriceItem[]> {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) return [];

  const url = new URL(`${BASE}/v2/prices/latest`);
  url.searchParams.set("origin", originCity);
  url.searchParams.set("destination", destCity);
  if (opts.month) {
    url.searchParams.set("beginning_of_period", opts.month);
    url.searchParams.set("period_type", "month");
  }
  url.searchParams.set("one_way", "false");
  url.searchParams.set("limit", String(opts.limit ?? 30));
  url.searchParams.set("show_to_affiliates", "true");
  url.searchParams.set("sorting", "price");
  url.searchParams.set("trip_class", "0");
  url.searchParams.set("currency", "usd");
  url.searchParams.set("token", token);

  try {
    const res = await fetch(url.toString(), {
      headers: { "X-Access-Token": token, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as LatestPriceResponse;
    return json.data ?? [];
  } catch {
    return [];
  }
}

/**
 * Get best available real price for the trip.
 * Strategy:
 *   1. Try the departure month first
 *   2. If nothing, try any recent cached prices for this route
 *   3. Return the cheapest matching the nonstop filter
 */
export async function getCurrentPrice(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string,
  nonstopOnly: boolean
): Promise<{ flights: TPFlight[]; source: "travelpayouts" } | { error: string }> {
  const originCity = toCityCode(origin);
  const destCity = toCityCode(destination);
  const depMonth = departureDate.substring(0, 7) + "-01";

  // Try to get prices for the departure month first
  let items = await fetchLatest(originCity, destCity, { month: depMonth, limit: 30 });

  // If no data for that month, get ANY recent data for this route
  if (items.length === 0) {
    items = await fetchLatest(originCity, destCity, { limit: 30 });
  }

  if (items.length === 0) {
    return { error: `No cached prices for ${originCity}->${destCity} (route may be too niche or date too far out)` };
  }

  const filtered = nonstopOnly ? items.filter((i) => i.number_of_changes === 0) : items;
  if (filtered.length === 0) {
    return { error: `No nonstop prices cached for ${originCity}->${destCity}` };
  }

  filtered.sort((a, b) => a.value - b.value);

  const flights: TPFlight[] = filtered.slice(0, 8).map((i) => ({
    price: i.value,
    airline: i.gate,
    flightNumber: "",
    departureAt: i.depart_date + "T00:00:00",
    returnAt: i.return_date + "T00:00:00",
    numberOfChanges: i.number_of_changes,
    foundAt: i.found_at,
    duration: i.duration || 0,
  }));

  return { flights, source: "travelpayouts" };
}

/**
 * Get price history points for the trend chart.
 * Returns a list of (date, price) tuples from real user-observed prices.
 */
export async function getPriceHistory(
  origin: string,
  destination: string,
  departureMonth: string
): Promise<TPHistoryPoint[]> {
  const originCity = toCityCode(origin);
  const destCity = toCityCode(destination);

  let items = await fetchLatest(originCity, destCity, { month: departureMonth, limit: 50 });
  if (items.length === 0) {
    items = await fetchLatest(originCity, destCity, { limit: 50 });
  }

  return items
    .map((item) => ({
      date: item.found_at.substring(0, 10),
      price: item.value,
      airline: item.gate,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
