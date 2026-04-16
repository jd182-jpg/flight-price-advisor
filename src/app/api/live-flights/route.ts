import { NextRequest, NextResponse } from "next/server";
import { searchFlightsDuffel, DuffelSearchParams } from "@/lib/duffel";
import { getCurrentPrice, getPriceHistory } from "@/lib/travelpayouts";
import { searchFlightsSerpAPI } from "@/lib/serpapi";
import { FlightResult } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const params = (await req.json()) as DuffelSearchParams;

    // 1) SerpAPI (real Google Flights data + historical price series)
    const serp = await searchFlightsSerpAPI(params);
    if ("flights" in serp && serp.flights.length > 0) {
      const flights: FlightResult[] = serp.flights.map((f) => ({
        price: f.price,
        airline: f.airline,
        departureTime: f.departureTime,
        arrivalTime: f.arrivalTime,
        duration: f.duration,
        stops: f.stops,
        outbound: {
          departure: params.origin,
          arrival: params.destination,
          departureTime: f.outboundDeparture,
          arrivalTime: f.outboundArrival,
          airline: f.airline,
          flightNumber: f.flightNumber,
          duration: f.duration,
        },
        returnLeg: {
          departure: params.destination,
          arrival: params.origin,
          departureTime: "",
          arrivalTime: "",
          airline: f.airline,
          flightNumber: "",
          duration: "",
        },
      }));

      return NextResponse.json({
        flights,
        source: "serpapi",
        priceHistory: serp.priceHistory,
        typicalPriceRange: serp.typicalPriceRange,
        priceLevel: serp.priceLevel,
        cached: serp.cached,
      });
    }

    const serpError = "error" in serp ? serp.error : undefined;

    // 2) Travelpayouts (real aggregated price data)
    const tp = await getCurrentPrice(
      params.origin,
      params.destination,
      params.departureDate,
      params.returnDate,
      params.nonstopOnly
    );

    if ("flights" in tp && tp.flights.length > 0) {
      const flights: FlightResult[] = tp.flights.map((f) => ({
        price: f.price * params.travelers,
        airline: f.airline,
        departureTime: f.departureAt.substring(11, 16),
        arrivalTime: f.returnAt.substring(11, 16),
        duration: f.duration ? `${Math.floor(f.duration / 60)}h ${f.duration % 60}m` : "",
        stops: f.numberOfChanges,
        outbound: {
          departure: params.origin,
          arrival: params.destination,
          departureTime: f.departureAt,
          arrivalTime: "",
          airline: f.airline,
          flightNumber: `${f.airline}${f.flightNumber}`,
          duration: "",
        },
        returnLeg: {
          departure: params.destination,
          arrival: params.origin,
          departureTime: f.returnAt,
          arrivalTime: "",
          airline: f.airline,
          flightNumber: "",
          duration: "",
        },
      }));

      const depMonth = params.departureDate.substring(0, 7) + "-01";
      const history = await getPriceHistory(params.origin, params.destination, depMonth);

      return NextResponse.json({
        flights,
        source: "travelpayouts",
        priceHistory: history,
        serpError,
      });
    }

    const tpError = "error" in tp ? tp.error : undefined;

    // 3) Duffel (sandbox fallback)
    const duffel = await searchFlightsDuffel(params);
    if ("flights" in duffel) {
      return NextResponse.json({
        ...duffel,
        serpError,
        tpError,
      });
    }

    return NextResponse.json(
      {
        error: "All price sources failed",
        serpError,
        tpError,
        duffelError: duffel.error,
        source: "error",
      },
      { status: 502 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
