import { NextRequest, NextResponse } from "next/server";
import { Trip } from "@/lib/types";
import { generateRecommendation } from "@/lib/recommendation-engine";
import { generatePriceHistory } from "@/lib/price-simulator";

/**
 * Check for alert conditions on tracked trips.
 * In production, this would be called by a cron job or background worker.
 * It compares current prices/recommendations against previous state
 * and returns any new alerts that should be created.
 */
export async function POST(req: NextRequest) {
  try {
    const { trips }: { trips: Trip[] } = await req.json();
    const newAlerts: Array<{
      tripId: string;
      type: "price_drop" | "recommendation_change" | "price_spike" | "great_deal";
      message: string;
    }> = [];

    for (const trip of trips) {
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

      // Check for price drop below max price threshold
      if (trip.maxPrice && result.currentBestPrice < trip.maxPrice) {
        const existingAlert = trip.alerts.find(
          (a) => a.type === "great_deal" && new Date(a.timestamp) > new Date(Date.now() - 86400000)
        );
        if (!existingAlert) {
          newAlerts.push({
            tripId: trip.id,
            type: "great_deal",
            message: `Price dropped to $${result.currentBestPrice}, below your $${trip.maxPrice} target!`,
          });
        }
      }

      // Check for significant price movement
      if (trip.priceHistory.length >= 2) {
        const latest = trip.priceHistory[trip.priceHistory.length - 1].price;
        const previous = trip.priceHistory[trip.priceHistory.length - 2].price;
        const pctChange = (latest - previous) / previous;

        if (pctChange < -0.08) {
          newAlerts.push({
            tripId: trip.id,
            type: "price_drop",
            message: `Price dropped ${Math.round(Math.abs(pctChange) * 100)}% to $${latest}`,
          });
        } else if (pctChange > 0.1) {
          newAlerts.push({
            tripId: trip.id,
            type: "price_spike",
            message: `Price jumped ${Math.round(pctChange * 100)}% to $${latest}`,
          });
        }
      }
    }

    return NextResponse.json({ alerts: newAlerts });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check alerts" },
      { status: 500 }
    );
  }
}
