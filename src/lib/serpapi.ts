/**
 * SerpAPI Google Flights client - server-side only.
 * Docs: https://serpapi.com/google-flights-api
 *
 * Returns real scraped Google Flights data - same prices you see on
 * google.com/flights. Includes price_insights with a real historical
 * price series for the route+dates. Each call uses 1 search credit.
 *
 * Cache strategy: responses are cached in-memory for 1 hour keyed by
 * trip params, to avoid burning the free trial (100 searches) on
 * repeated page loads.
 */

import { CabinClass } from "./types";

const BASE = "https://serpapi.com/search.json";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface SerpFlightSegment {
  departure_airport: { id: string; name: string; time: string };
  arrival_airport: { id: string; name: string; time: string };
  duration: number;
  airline: string;
  airline_logo: string;
  flight_number: string;
  travel_class: string;
}

interface SerpFlightOffer {
  flights: SerpFlightSegment[];
  total_duration: number;
  price: number;
  type: string;
  airline_logo: string;
}

interface SerpGoogleFlightsResponse {
  search_metadata?: { status: string };
  error?: string;
  best_flights?: SerpFlightOffer[];
  other_flights?: SerpFlightOffer[];
  price_insights?: {
    lowest_price?: number;
    price_level?: string;
    typical_price_range?: [number, number];
    price_history?: [number, number][]; // [unix_seconds, price]
  };
}

export interface SerpFlight {
  price: number;
  airline: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  outboundDeparture: string;
  outboundArrival: string;
  flightNumber: string;
}

export interface SerpHistoryPoint {
  date: string;
  price: number;
}

export interface SerpResult {
  flights: SerpFlight[];
  priceHistory: SerpHistoryPoint[];
  typicalPriceRange: [number, number] | null;
  priceLevel: string | null;
  source: "serpapi";
  cached: boolean;
}

const cache = new Map<string, { data: SerpResult; expires: number }>();

function mapCabin(c: CabinClass): string {
  switch (c) {
    case "premium_economy": return "2";
    case "business": return "3";
    case "first": return "4";
    default: return "1";
  }
}

function mapDuration(mins: number): string {
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export interface SerpSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  cabinClass: CabinClass;
  travelers: number;
  nonstopOnly: boolean;
}

export async function searchFlightsSerpAPI(
  params: SerpSearchParams
): Promise<SerpResult | { error: string }> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return { error: "SERPAPI_KEY is not set" };

  const cacheKey = JSON.stringify(params);
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return { ...cached.data, cached: true };
  }

  const url = new URL(BASE);
  url.searchParams.set("engine", "google_flights");
  url.searchParams.set("api_key", key);
  url.searchParams.set("departure_id", params.origin);
  url.searchParams.set("arrival_id", params.destination);
  url.searchParams.set("outbound_date", params.departureDate);
  url.searchParams.set("return_date", params.returnDate);
  url.searchParams.set("type", "1"); // round trip
  url.searchParams.set("currency", "USD");
  url.searchParams.set("hl", "en");
  url.searchParams.set("adults", String(params.travelers));
  url.searchParams.set("travel_class", mapCabin(params.cabinClass));
  if (params.nonstopOnly) url.searchParams.set("stops", "1");

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      return { error: `SerpAPI HTTP ${res.status}` };
    }
    const json = (await res.json()) as SerpGoogleFlightsResponse;

    if (json.error) {
      return { error: json.error };
    }

    const offers = [...(json.best_flights || []), ...(json.other_flights || [])];
    if (offers.length === 0) {
      return { error: "No flights returned by Google Flights" };
    }

    const flights: SerpFlight[] = offers.slice(0, 10).map((offer) => {
      const first = offer.flights[0];
      const last = offer.flights[offer.flights.length - 1];
      const stops = offer.flights.length - 1;
      return {
        price: offer.price,
        airline: first.airline,
        departureTime: first.departure_airport.time.substring(11, 16),
        arrivalTime: last.arrival_airport.time.substring(11, 16),
        duration: mapDuration(offer.total_duration),
        stops,
        outboundDeparture: first.departure_airport.time,
        outboundArrival: last.arrival_airport.time,
        flightNumber: first.flight_number,
      };
    });

    const priceHistory: SerpHistoryPoint[] = (json.price_insights?.price_history || []).map(
      ([ts, price]) => ({
        date: new Date(ts * 1000).toISOString().substring(0, 10),
        price,
      })
    );

    const result: SerpResult = {
      flights,
      priceHistory,
      typicalPriceRange: json.price_insights?.typical_price_range || null,
      priceLevel: json.price_insights?.price_level || null,
      source: "serpapi",
      cached: false,
    };

    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "SerpAPI request failed" };
  }
}
