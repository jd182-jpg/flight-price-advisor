import {
  Trip,
  RecommendationResult,
  RecommendationFactor,
  Recommendation,
  PricePoint,
} from "./types";
import { simulatePrice, generatePriceHistory, searchFlights } from "./price-simulator";

const LEISURE_ROUTES = new Set([
  "SJD", "CUN", "PVR", "HNL", "MBJ", "NAS", "AUA", "MIA", "LAS", "MCO", "TPA", "SAN",
]);

function isLeisureRoute(origin: string, destination: string): boolean {
  return LEISURE_ROUTES.has(destination) || LEISURE_ROUTES.has(origin);
}

function isHolidayAdjacent(dateStr: string): { isHoliday: boolean; holidayName: string } {
  const date = new Date(dateStr);
  const month = date.getMonth();
  const day = date.getDate();

  if ((month === 11 && day >= 18) || (month === 0 && day <= 5)) {
    return { isHoliday: true, holidayName: "Winter Holidays" };
  }
  if (month === 2 && day >= 10 && day <= 25) {
    return { isHoliday: true, holidayName: "Spring Break" };
  }
  if (month === 10 && day >= 20 && day <= 30) {
    return { isHoliday: true, holidayName: "Thanksgiving" };
  }
  if (month === 6 && day >= 1 && day <= 6) {
    return { isHoliday: true, holidayName: "Independence Day" };
  }
  return { isHoliday: false, holidayName: "" };
}

function analyzePriceTrend(priceHistory: PricePoint[]): {
  trend: "rising" | "falling" | "stable";
  recentAvg: number;
  overallAvg: number;
  low: number;
  high: number;
  volatility: number;
} {
  if (priceHistory.length < 2) {
    const price = priceHistory[0]?.price ?? 0;
    return { trend: "stable", recentAvg: price, overallAvg: price, low: price, high: price, volatility: 0 };
  }

  const prices = priceHistory.map((p) => p.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const overallAvg = prices.reduce((a, b) => a + b, 0) / prices.length;

  const recentWindow = Math.min(14, Math.floor(prices.length / 3));
  const recentPrices = prices.slice(-recentWindow);
  const recentAvg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;

  const olderPrices = prices.slice(0, -recentWindow);
  const olderAvg = olderPrices.length > 0
    ? olderPrices.reduce((a, b) => a + b, 0) / olderPrices.length
    : overallAvg;

  const pctChange = (recentAvg - olderAvg) / olderAvg;

  let trend: "rising" | "falling" | "stable";
  if (pctChange > 0.05) trend = "rising";
  else if (pctChange < -0.05) trend = "falling";
  else trend = "stable";

  // Volatility: standard deviation as % of mean
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - overallAvg, 2), 0) / prices.length;
  const volatility = Math.sqrt(variance) / overallAvg;

  return { trend, recentAvg, overallAvg, low, high, volatility };
}

export interface RecommendationOverrides {
  /** Real current price to use instead of the simulated one (already per-person) */
  currentPrice?: number;
  /** Real price history points for trend analysis */
  priceHistory?: Array<{ date: string; price: number }>;
  /** Google Flights' typical price range [low, high] — used as a more authoritative reference when available */
  typicalPriceRange?: [number, number] | null;
  /** Data source label so the engine knows whether it's using real data */
  source?: "serpapi" | "travelpayouts" | "duffel" | "simulated";
}

export function generateRecommendation(
  trip: Trip,
  overrides?: RecommendationOverrides
): RecommendationResult {
  const today = new Date();
  const depDate = new Date(trip.departureDate);
  const daysUntilDeparture = Math.floor((depDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Build priceHistory from overrides if available, otherwise fall back to trip history or simulated
  const rawHistory = overrides?.priceHistory && overrides.priceHistory.length > 0
    ? overrides.priceHistory.map((h) => ({ date: h.date, price: h.price, airline: "", source: overrides.source ?? "live" }))
    : trip.priceHistory.length > 0
      ? trip.priceHistory
      : generatePriceHistory(trip.origin, trip.destination, trip.departureDate, trip.cabinClass, trip.nonstopOnly);

  // Determine current best price: overrides win, then simulated search
  let currentBestPrice: number;
  if (overrides?.currentPrice !== undefined) {
    currentBestPrice = overrides.currentPrice;
  } else {
    const flights = searchFlights({
      origin: trip.origin,
      destination: trip.destination,
      departureDate: trip.departureDate,
      returnDate: trip.returnDate,
      nonstopOnly: trip.nonstopOnly,
      cabinClass: trip.cabinClass,
      travelers: trip.travelers,
      preferredAirlines: trip.preferredAirlines,
    });
    currentBestPrice = flights.length > 0
      ? flights[0].price / trip.travelers
      : simulatePrice(trip.origin, trip.destination, trip.departureDate, trip.cabinClass, trip.nonstopOnly, daysUntilDeparture);
  }
  currentBestPrice = Math.round(currentBestPrice);

  // Use Google's typical range as the authoritative reference when available
  const priceAnalysisBase = analyzePriceTrend(rawHistory);
  const priceAnalysis = overrides?.typicalPriceRange
    ? {
        ...priceAnalysisBase,
        low: overrides.typicalPriceRange[0],
        high: overrides.typicalPriceRange[1],
        overallAvg: Math.round((overrides.typicalPriceRange[0] + overrides.typicalPriceRange[1]) / 2),
      }
    : priceAnalysisBase;

  const holiday = isHolidayAdjacent(trip.departureDate);
  const leisure = isLeisureRoute(trip.origin, trip.destination);

  // Build factors
  const factors: RecommendationFactor[] = [];
  let score = 50; // Start neutral. Higher = more "buy now", lower = more "wait"

  // Factor 1: Time until departure
  if (daysUntilDeparture > 270) {
    factors.push({
      name: "Booking Window",
      impact: "positive",
      weight: 0.25,
      description: `Trip is ${Math.floor(daysUntilDeparture / 30)} months away. There is plenty of time to monitor prices. The sweet spot for booking is typically 2-4 months before departure.`,
    });
    score -= 20;
  } else if (daysUntilDeparture > 180) {
    factors.push({
      name: "Booking Window",
      impact: "positive",
      weight: 0.2,
      description: `Trip is about ${Math.floor(daysUntilDeparture / 30)} months away. You have good time to wait for better prices, but should start monitoring more closely.`,
    });
    score -= 12;
  } else if (daysUntilDeparture > 90) {
    factors.push({
      name: "Booking Window",
      impact: "neutral",
      weight: 0.2,
      description: `Trip is ${Math.floor(daysUntilDeparture / 30)} months away. You're entering the optimal booking window. Prices may start to climb soon.`,
    });
    score += 5;
  } else if (daysUntilDeparture > 30) {
    factors.push({
      name: "Booking Window",
      impact: "negative",
      weight: 0.3,
      description: `Trip is only ${daysUntilDeparture} days away. Prices typically increase as departure approaches. Waiting carries more risk.`,
    });
    score += 20;
  } else {
    factors.push({
      name: "Booking Window",
      impact: "negative",
      weight: 0.35,
      description: `Trip is ${daysUntilDeparture} days away. Prices almost always go up from here. Book as soon as possible.`,
    });
    score += 35;
  }

  // Factor 2: Holiday / peak travel
  if (holiday.isHoliday) {
    factors.push({
      name: "Peak Travel Period",
      impact: "negative",
      weight: 0.2,
      description: `Your trip falls during ${holiday.holidayName}. This is a high-demand period when prices tend to be elevated and seats fill up faster. Waiting too long risks higher prices or sold-out nonstop flights.`,
    });
    score += 12;
  } else {
    factors.push({
      name: "Travel Period",
      impact: "positive",
      weight: 0.1,
      description: "Your travel dates don't overlap with major holidays, which gives you more flexibility to wait.",
    });
    score -= 5;
  }

  // Factor 3: Nonstop restriction
  if (trip.nonstopOnly) {
    factors.push({
      name: "Nonstop Flights Only",
      impact: "negative",
      weight: 0.15,
      description: "Restricting to nonstop flights limits available options. Nonstop routes can sell out or see sharper price increases, especially on leisure routes.",
    });
    score += 8;
  }

  // Factor 4: Route type
  if (leisure) {
    factors.push({
      name: "Leisure Route",
      impact: "neutral",
      weight: 0.1,
      description: "This is a popular leisure route. Prices are more seasonal and can be volatile around peak travel times, but deals can also appear during shoulder seasons.",
    });
    score += 3;
  }

  // Factor 5: Price trend
  if (priceAnalysis.trend === "rising") {
    factors.push({
      name: "Price Trend",
      impact: "negative",
      weight: 0.2,
      description: `Prices have been trending upward recently. The current price ($${currentBestPrice}) is above the recent average ($${Math.round(priceAnalysis.overallAvg)}). Waiting may mean paying more.`,
    });
    score += 15;
  } else if (priceAnalysis.trend === "falling") {
    factors.push({
      name: "Price Trend",
      impact: "positive",
      weight: 0.2,
      description: `Prices have been trending downward recently. The current price ($${currentBestPrice}) may continue to drop. There could be room for a better deal.`,
    });
    score -= 15;
  } else {
    factors.push({
      name: "Price Trend",
      impact: "neutral",
      weight: 0.1,
      description: `Prices have been relatively stable. The current price ($${currentBestPrice}) is close to the recent average ($${Math.round(priceAnalysis.overallAvg)}).`,
    });
  }

  // Factor 6: Current price vs history
  const priceVsAvg = currentBestPrice / priceAnalysis.overallAvg;
  if (priceVsAvg < 0.9) {
    factors.push({
      name: "Price vs Average",
      impact: "positive",
      weight: 0.15,
      description: `Current price is ${Math.round((1 - priceVsAvg) * 100)}% below the historical average. This is a relatively good deal.`,
    });
    score += 10; // Good deal = lean toward buying even if far out
  } else if (priceVsAvg > 1.1) {
    factors.push({
      name: "Price vs Average",
      impact: "negative",
      weight: 0.15,
      description: `Current price is ${Math.round((priceVsAvg - 1) * 100)}% above the historical average. You might find a better price by waiting.`,
    });
    score -= 10;
  }

  // Factor 7: Volatility
  if (priceAnalysis.volatility > 0.15) {
    factors.push({
      name: "Price Volatility",
      impact: "neutral",
      weight: 0.1,
      description: "Prices on this route have been volatile, swinging significantly. This means both risks and opportunities if you wait.",
    });
  }

  // Apply risk tolerance
  const toleranceAdjust = trip.riskTolerance === "conservative" ? 15
    : trip.riskTolerance === "aggressive" ? -15
    : 0;
  score += toleranceAdjust;

  if (trip.riskTolerance !== "balanced") {
    factors.push({
      name: "Risk Tolerance",
      impact: trip.riskTolerance === "conservative" ? "negative" : "positive",
      weight: 0.1,
      description: trip.riskTolerance === "conservative"
        ? "Your conservative risk preference means we lean toward booking earlier to avoid potential price increases."
        : "Your aggressive risk preference means we lean toward waiting longer for the best possible deal, accepting more risk.",
    });
  }

  // Determine recommendation
  let recommendation: Recommendation;
  let confidence: number;

  if (score >= 65) {
    recommendation = "buy_now";
    confidence = Math.min(95, 50 + (score - 65) * 2);
  } else if (score >= 40) {
    recommendation = "monitor";
    confidence = Math.min(80, 40 + Math.abs(score - 52) * 2);
  } else {
    recommendation = "wait";
    confidence = Math.min(90, 50 + (40 - score) * 2);
  }

  // Generate explanation
  const explanation = generateExplanation(
    recommendation,
    confidence,
    currentBestPrice,
    daysUntilDeparture,
    priceAnalysis,
    holiday,
    trip,
    factors
  );

  // Predict optimal window
  let optimalWindow: string;
  if (daysUntilDeparture > 180) {
    const optimalDays = holiday.isHoliday ? "3-4 months" : "2-3 months";
    optimalWindow = `Best prices typically appear ${optimalDays} before departure for this type of route.`;
  } else if (daysUntilDeparture > 60) {
    optimalWindow = "You're in or near the optimal booking window. Monitor daily for price drops.";
  } else {
    optimalWindow = "The optimal booking window has passed. Book as soon as you see an acceptable price.";
  }

  // Estimated savings
  const estimatedSavings = recommendation === "wait"
    ? Math.round(currentBestPrice * 0.08 * (trip.riskTolerance === "aggressive" ? 1.5 : 1))
    : recommendation === "monitor"
    ? Math.round(currentBestPrice * 0.04)
    : 0;

  return {
    recommendation,
    confidence,
    currentBestPrice,
    priceRange: {
      low: priceAnalysis.low,
      high: priceAnalysis.high,
      average: Math.round(priceAnalysis.overallAvg),
    },
    explanation,
    factors,
    predictedOptimalWindow: optimalWindow,
    estimatedSavings,
  };
}

function generateExplanation(
  recommendation: Recommendation,
  confidence: number,
  currentPrice: number,
  daysUntil: number,
  priceAnalysis: ReturnType<typeof analyzePriceTrend>,
  holiday: { isHoliday: boolean; holidayName: string },
  trip: Trip,
  factors: RecommendationFactor[]
): string {
  const months = Math.floor(daysUntil / 30);
  const routeDesc = `${trip.origin} to ${trip.destination}`;
  const nonstopNote = trip.nonstopOnly ? " (nonstop only)" : "";

  if (recommendation === "buy_now") {
    if (daysUntil < 30) {
      return `Your ${routeDesc}${nonstopNote} trip is only ${daysUntil} days away. At this point, prices almost always increase as departure approaches. The current best price of $${currentPrice} per person is likely as good as it will get. We recommend booking now.`;
    }
    let reason = `Based on our analysis, we recommend booking your ${routeDesc}${nonstopNote} trip now at $${currentPrice} per person.`;
    if (holiday.isHoliday) {
      reason += ` Your travel falls during ${holiday.holidayName}, a peak period where prices tend to climb and nonstop seats fill up quickly.`;
    }
    if (priceAnalysis.trend === "rising") {
      reason += " Prices have been trending upward recently, and waiting could mean paying more.";
    }
    return reason;
  }

  if (recommendation === "wait") {
    let reason = `Your ${routeDesc}${nonstopNote} trip is still ${months} months away. `;
    reason += `The current best price is $${currentPrice} per person. `;

    if (daysUntil > 180) {
      reason += "Historical data suggests prices on this route tend to improve as you get closer to the 2-4 month booking window. ";
    }
    if (priceAnalysis.trend === "falling") {
      reason += "Prices have been trending downward, which is a positive sign. ";
    }
    if (currentPrice > priceAnalysis.overallAvg) {
      reason += `The current price is above the historical average of $${Math.round(priceAnalysis.overallAvg)}, suggesting there may be better deals ahead. `;
    }

    reason += "We recommend waiting and monitoring, but keep an eye on price alerts.";

    if (holiday.isHoliday || trip.nonstopOnly) {
      reason += " However, note that ";
      const caveats = [];
      if (holiday.isHoliday) caveats.push(`your dates overlap with ${holiday.holidayName}`);
      if (trip.nonstopOnly) caveats.push("nonstop flights are more limited");
      reason += caveats.join(" and ") + ", so don't wait too long.";
    }

    return reason;
  }

  // Monitor
  let reason = `Your ${routeDesc}${nonstopNote} trip is ${months > 0 ? `${months} months` : `${daysUntil} days`} away at $${currentPrice} per person. `;
  reason += "The situation is balanced \u2014 there are reasons to wait and reasons to act. ";

  if (priceAnalysis.trend === "stable") {
    reason += "Prices have been stable, so you have some breathing room. ";
  }

  reason += "We recommend monitoring prices closely and setting a price alert. If the price drops below $" +
    Math.round(priceAnalysis.low * 1.05) + ", that would be a strong signal to buy.";

  return reason;
}
