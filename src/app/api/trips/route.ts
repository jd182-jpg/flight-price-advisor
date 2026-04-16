import { NextRequest, NextResponse } from "next/server";
import { searchFlights } from "@/lib/price-simulator";
import { FlightSearchParams } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const params: FlightSearchParams = await req.json();

    // In production, replace this with a real flight API call
    // e.g., Amadeus, Skyscanner, Google Flights ITA Matrix, Kiwi
    const results = searchFlights(params);

    return NextResponse.json({ flights: results, source: "simulated" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to search flights" },
      { status: 500 }
    );
  }
}
