import { NextRequest, NextResponse } from "next/server";
import { Trip } from "@/lib/types";
import { generateRecommendation } from "@/lib/recommendation-engine";
import { generatePriceHistory } from "@/lib/price-simulator";

export async function POST(req: NextRequest) {
  try {
    const trip: Trip = await req.json();

    // Ensure price history exists
    if (!trip.priceHistory || trip.priceHistory.length === 0) {
      trip.priceHistory = generatePriceHistory(
        trip.origin,
        trip.destination,
        trip.departureDate,
        trip.cabinClass,
        trip.nonstopOnly,
        60
      );
    }

    const result = generateRecommendation(trip);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate recommendation" },
      { status: 500 }
    );
  }
}
