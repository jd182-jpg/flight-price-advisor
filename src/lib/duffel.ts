/**
 * Duffel API client - server-side only.
 * Docs: https://duffel.com/docs/api
 */

import { CabinClass, FlightResult } from "./types";

const DUFFEL_API_URL = "https://api.duffel.com/air/offer_requests";
const DUFFEL_VERSION = "v2";

interface DuffelOffer {
  id: string;
  total_amount: string;
  total_currency: string;
  owner: { name: string; iata_code: string };
  slices: DuffelSlice[];
}

interface DuffelSlice {
  origin: { iata_code: string };
  destination: { iata_code: string };
  duration: string;
  segments: DuffelSegment[];
}

interface DuffelSegment {
  origin: { iata_code: string };
  destination: { iata_code: string };
  departing_at: string;
  arriving_at: string;
  duration: string;
  marketing_carrier: { name: string; iata_code: string };
  marketing_carrier_flight_number: string;
}

interface DuffelOfferRequestResponse {
  data: {
    id: string;
    offers: DuffelOffer[];
  };
}

interface DuffelError {
  errors: Array<{
    title: string;
    message: string;
    code: string;
  }>;
}

function mapCabin(cabin: CabinClass): string {
  switch (cabin) {
    case "premium_economy":
      return "premium_economy";
    case "business":
      return "business";
    case "first":
      return "first";
    default:
      return "economy";
  }
}

function parseIsoDuration(duration: string): string {
  // Duffel returns ISO 8601 like "PT5H30M"
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return duration;
  const hours = match[1] || "0";
  const minutes = match[2] || "0";
  return `${hours}h ${minutes}m`;
}

export interface DuffelSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  cabinClass: CabinClass;
  travelers: number;
  nonstopOnly: boolean;
}

export async function searchFlightsDuffel(
  params: DuffelSearchParams
): Promise<{ flights: FlightResult[]; source: "duffel" } | { error: string }> {
  const token = process.env.DUFFEL_API_TOKEN;
  if (!token) {
    return { error: "DUFFEL_API_TOKEN is not set" };
  }

  const body = {
    data: {
      slices: [
        {
          origin: params.origin,
          destination: params.destination,
          departure_date: params.departureDate,
        },
        {
          origin: params.destination,
          destination: params.origin,
          departure_date: params.returnDate,
        },
      ],
      passengers: Array.from({ length: params.travelers }, () => ({ type: "adult" })),
      cabin_class: mapCabin(params.cabinClass),
      ...(params.nonstopOnly ? { max_connections: 0 } : {}),
    },
  };

  try {
    const res = await fetch(`${DUFFEL_API_URL}?return_offers=true`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Duffel-Version": DUFFEL_VERSION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as DuffelError;
      const msg =
        errBody.errors?.[0]?.message ||
        errBody.errors?.[0]?.title ||
        `Duffel API error ${res.status}`;
      return { error: msg };
    }

    const json = (await res.json()) as DuffelOfferRequestResponse;
    const offers = json.data.offers || [];

    // Sort by price ascending and take top 8
    offers.sort((a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount));
    const top = offers.slice(0, 8);

    const flights: FlightResult[] = top.map((o) => {
      const outSlice = o.slices[0];
      const retSlice = o.slices[1];
      const outFirst = outSlice.segments[0];
      const outLast = outSlice.segments[outSlice.segments.length - 1];
      const retFirst = retSlice?.segments[0];
      const retLast = retSlice?.segments[retSlice.segments.length - 1];
      const stops = outSlice.segments.length - 1;

      return {
        price: parseFloat(o.total_amount),
        airline: o.owner.name,
        departureTime: new Date(outFirst.departing_at).toISOString().substring(11, 16),
        arrivalTime: new Date(outLast.arriving_at).toISOString().substring(11, 16),
        duration: parseIsoDuration(outSlice.duration),
        stops,
        outbound: {
          departure: outFirst.origin.iata_code,
          arrival: outLast.destination.iata_code,
          departureTime: outFirst.departing_at,
          arrivalTime: outLast.arriving_at,
          airline: outFirst.marketing_carrier.name,
          flightNumber: `${outFirst.marketing_carrier.iata_code}${outFirst.marketing_carrier_flight_number}`,
          duration: parseIsoDuration(outSlice.duration),
        },
        returnLeg: retFirst
          ? {
              departure: retFirst.origin.iata_code,
              arrival: retLast.destination.iata_code,
              departureTime: retFirst.departing_at,
              arrivalTime: retLast.arriving_at,
              airline: retFirst.marketing_carrier.name,
              flightNumber: `${retFirst.marketing_carrier.iata_code}${retFirst.marketing_carrier_flight_number}`,
              duration: parseIsoDuration(retSlice.duration),
            }
          : {
              departure: params.destination,
              arrival: params.origin,
              departureTime: "",
              arrivalTime: "",
              airline: o.owner.name,
              flightNumber: "",
              duration: "",
            },
      };
    });

    return { flights, source: "duffel" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Duffel request failed" };
  }
}
