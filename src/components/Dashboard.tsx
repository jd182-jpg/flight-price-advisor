"use client";

import { useState, useEffect, useCallback } from "react";
import { Trip } from "@/lib/types";
import { loadTrips, saveTrips, addTrip, deleteTrip, getDefaultOrdSjdTrip } from "@/lib/store";
import { generateRecommendation } from "@/lib/recommendation-engine";
import TripCard from "./TripCard";
import TripForm from "./TripForm";
import AlertsPanel from "./AlertsPanel";

export default function Dashboard() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    setTrips(loadTrips());
  }, []);

  useEffect(() => {
    const existing = loadTrips();
    if (existing.length === 0) {
      // Seed with the default ORD → SJD trip
      const defaultTrip = getDefaultOrdSjdTrip();
      addTrip(defaultTrip);
    }
    refresh();
    setLoaded(true);
  }, [refresh]);

  const handleAddTrip = (trip: Omit<Trip, "id" | "createdAt" | "alerts" | "priceHistory">) => {
    addTrip(trip);
    refresh();
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    deleteTrip(id);
    refresh();
  };

  // Summary stats
  const stats = trips.reduce(
    (acc, trip) => {
      const rec = generateRecommendation(trip);
      if (rec.recommendation === "buy_now") acc.buyNow++;
      else if (rec.recommendation === "wait") acc.wait++;
      else acc.monitor++;
      acc.totalAlerts += trip.alerts.filter((a) => !a.read).length;
      return acc;
    },
    { buyNow: 0, wait: 0, monitor: 0, totalAlerts: 0 }
  );

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Flight Price Advisor
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Track flights. Get smart buy-or-wait recommendations. Never overpay.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{trips.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Trips Tracked</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-emerald-600">{stats.buyNow}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Buy Now</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.wait}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Wait</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-amber-600">{stats.monitor}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Monitor</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Trips</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Trip
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-6">
          <TripForm onSubmit={handleAddTrip} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Trip Cards */}
      <div className="space-y-4 mb-8">
        {trips.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No trips tracked yet.</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              Add Your First Trip
            </button>
          </div>
        ) : (
          trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} onDelete={handleDelete} />
          ))
        )}
      </div>

      {/* Alerts */}
      {trips.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Alerts</h2>
          <AlertsPanel trips={trips} onUpdate={refresh} />
        </div>
      )}

      {/* Footer info */}
      <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-8 border-t border-gray-100 dark:border-gray-800">
        <p className="mb-1">
          Prices are currently simulated for development. Connect a flight API (Amadeus, Skyscanner, Google Flights) for live data.
        </p>
        <p>
          The recommendation engine considers booking window, seasonality, price trends, route type, and your risk tolerance.
        </p>
      </div>
    </div>
  );
}
