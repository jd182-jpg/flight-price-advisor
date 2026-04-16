"use client";

import { Trip, RecommendationResult, FlightResult } from "@/lib/types";
import { generateRecommendation } from "@/lib/recommendation-engine";
import { useEffect, useMemo, useState } from "react";
import PriceChart from "./PriceChart";
import RecommendationBadge from "./RecommendationBadge";

interface Props {
  trip: Trip;
  onDelete: (id: string) => void;
}

interface LivePriceState {
  loading: boolean;
  price: number | null;
  source: "serpapi" | "travelpayouts" | "duffel" | "simulated" | "error";
  error?: string;
  flights?: FlightResult[];
  realHistory?: { date: string; price: number }[];
  typicalPriceRange?: [number, number] | null;
  priceLevel?: string | null;
}

export default function TripCard({ trip, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [live, setLive] = useState<LivePriceState>({ loading: true, price: null, source: "simulated" });

  useEffect(() => {
    let cancelled = false;
    setLive({ loading: true, price: null, source: "simulated" });

    fetch("/api/live-flights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: trip.origin,
        destination: trip.destination,
        departureDate: trip.departureDate,
        returnDate: trip.returnDate,
        cabinClass: trip.cabinClass,
        travelers: trip.travelers,
        nonstopOnly: trip.nonstopOnly,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || data.error) {
          setLive({ loading: false, price: null, source: "error", error: data.error });
          return;
        }
        const cheapest = data.flights?.[0];
        if (cheapest) {
          const perPersonPrice =
            data.source === "serpapi"
              ? Math.round(cheapest.price / trip.travelers)
              : Math.round(cheapest.price / trip.travelers);
          setLive({
            loading: false,
            price: perPersonPrice,
            source: data.source || "duffel",
            flights: data.flights,
            realHistory: data.priceHistory,
            typicalPriceRange: data.typicalPriceRange,
            priceLevel: data.priceLevel,
          });
        } else {
          setLive({ loading: false, price: null, source: "error", error: "No offers returned" });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLive({ loading: false, price: null, source: "error", error: String(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [trip.id, trip.origin, trip.destination, trip.departureDate, trip.returnDate, trip.cabinClass, trip.travelers, trip.nonstopOnly]);

  const result: RecommendationResult = useMemo(() => {
    if (live.price !== null) {
      return generateRecommendation(trip, {
        currentPrice: live.price,
        priceHistory: live.realHistory,
        typicalPriceRange: live.typicalPriceRange,
        source: live.source === "serpapi" || live.source === "travelpayouts" || live.source === "duffel"
          ? live.source
          : "simulated",
      });
    }
    return generateRecommendation(trip);
  }, [trip, live.price, live.realHistory, live.typicalPriceRange, live.source]);

  const depDate = new Date(trip.departureDate);
  const retDate = new Date(trip.returnDate);
  const today = new Date();
  const daysUntil = Math.floor((depDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const tripDays = Math.floor((retDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24));

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  const unreadAlerts = trip.alerts.filter((a) => !a.read).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div
        className="p-5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900 dark:text-white">{trip.origin}</span>
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              <span className="text-lg font-bold text-gray-900 dark:text-white">{trip.destination}</span>
            </div>
            {trip.nonstopOnly && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                Nonstop
              </span>
            )}
            {live.source === "serpapi" && (
              <span
                className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-medium"
                title="Real Google Flights data via SerpAPI"
              >
                Live (Google Flights)
              </span>
            )}
            {live.source === "travelpayouts" && (
              <span
                className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-medium"
                title="Real aggregated price data from Travelpayouts / Aviasales"
              >
                Live (Aggregated)
              </span>
            )}
            {live.source === "duffel" && (
              <span
                className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium"
                title="Duffel test sandbox data (not real prices)"
              >
                Sandbox
              </span>
            )}
            {live.source === "error" && (
              <span
                className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                title={live.error}
              >
                Simulated
              </span>
            )}
            {live.loading && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">
                Loading live prices…
              </span>
            )}
            {unreadAlerts > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {unreadAlerts} alert{unreadAlerts > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(trip.id);
              }}
              className="text-gray-400 hover:text-red-500 transition-colors p-1"
              title="Remove trip"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-gray-400 mb-3">
          <span>{formatDate(trip.departureDate)} - {formatDate(trip.returnDate)}</span>
          <span>{tripDays} nights</span>
          <span className="capitalize">{trip.cabinClass.replace("_", " ")}</span>
          <span>{trip.travelers} traveler{trip.travelers > 1 ? "s" : ""}</span>
          {daysUntil > 0 && <span className="font-medium text-indigo-600 dark:text-indigo-400">{daysUntil} days away</span>}
        </div>

        <div className="flex items-center justify-between">
          <RecommendationBadge
            recommendation={result.recommendation}
            confidence={result.confidence}
          />
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ${result.currentBestPrice}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/person</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Range: ${result.priceRange.low} - ${result.priceRange.high}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          {/* Price Chart */}
          <div className="p-5 pb-2">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Price Trend</h4>
              {live.realHistory && live.realHistory.length > 0 && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  Real historical data
                </span>
              )}
            </div>
            <PriceChart
              priceHistory={
                live.realHistory && live.realHistory.length > 0
                  ? live.realHistory.map((h) => ({ date: h.date, price: h.price, airline: "", source: "live" }))
                  : trip.priceHistory
              }
              currentPrice={result.currentBestPrice}
              averagePrice={
                live.typicalPriceRange
                  ? Math.round((live.typicalPriceRange[0] + live.typicalPriceRange[1]) / 2)
                  : result.priceRange.average
              }
            />
            {live.typicalPriceRange && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Typical range: ${live.typicalPriceRange[0]} - ${live.typicalPriceRange[1]}
                {live.priceLevel && (
                  <span className={`ml-2 font-medium ${
                    live.priceLevel === "low" ? "text-emerald-600" :
                    live.priceLevel === "high" ? "text-red-600" :
                    "text-amber-600"
                  }`}>
                    • Currently {live.priceLevel}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Explanation */}
          <div className="px-5 py-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Analysis</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {result.explanation}
            </p>
          </div>

          {/* Factors */}
          <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Key Factors</h4>
            <div className="space-y-2">
              {result.factors.map((factor, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      factor.impact === "positive"
                        ? "bg-emerald-500"
                        : factor.impact === "negative"
                        ? "bg-red-500"
                        : "bg-amber-500"
                    }`}
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {factor.name}:
                    </span>{" "}
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {factor.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optimal Window & Savings */}
          <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Optimal Booking Window
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">{result.predictedOptimalWindow}</p>
              </div>
              {result.estimatedSavings > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Potential Savings by Waiting
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    ~${result.estimatedSavings}/person estimated
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Alerts */}
          {trip.alerts.length > 0 && (
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Recent Alerts</h4>
              <div className="space-y-1.5">
                {trip.alerts.slice(-5).reverse().map((alert) => (
                  <div
                    key={alert.id}
                    className={`text-xs px-3 py-2 rounded-lg ${
                      alert.read
                        ? "bg-gray-50 dark:bg-gray-700/50 text-gray-500"
                        : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                    }`}
                  >
                    {alert.message}
                    <span className="ml-2 text-gray-400">
                      {new Date(alert.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
