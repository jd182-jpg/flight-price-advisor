"use client";

import { Trip, Alert } from "./types";
import { v4 as uuidv4 } from "uuid";
import { generatePriceHistory } from "./price-simulator";

const STORAGE_KEY = "flight-advisor-trips";

export function loadTrips(): Trip[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveTrips(trips: Trip[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

export function addTrip(trip: Omit<Trip, "id" | "createdAt" | "alerts" | "priceHistory">): Trip {
  const priceHistory = generatePriceHistory(
    trip.origin,
    trip.destination,
    trip.departureDate,
    trip.cabinClass,
    trip.nonstopOnly,
    60
  );

  const newTrip: Trip = {
    ...trip,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    alerts: [],
    priceHistory,
  };

  const trips = loadTrips();
  trips.push(newTrip);
  saveTrips(trips);
  return newTrip;
}

export function deleteTrip(id: string): void {
  const trips = loadTrips().filter((t) => t.id !== id);
  saveTrips(trips);
}

export function addAlert(tripId: string, alert: Omit<Alert, "id" | "timestamp" | "read">): Alert {
  const trips = loadTrips();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) throw new Error("Trip not found");

  const newAlert: Alert = {
    ...alert,
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    read: false,
  };

  trip.alerts.push(newAlert);
  saveTrips(trips);
  return newAlert;
}

export function markAlertRead(tripId: string, alertId: string): void {
  const trips = loadTrips();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) return;
  const alert = trip.alerts.find((a) => a.id === alertId);
  if (alert) alert.read = true;
  saveTrips(trips);
}

export function getDefaultOrdSjdTrip(): Omit<Trip, "id" | "createdAt" | "alerts" | "priceHistory"> {
  return {
    origin: "ORD",
    destination: "SJD",
    departureDate: "2027-01-02",
    returnDate: "2027-01-09",
    nonstopOnly: true,
    cabinClass: "economy",
    travelers: 1,
    preferredAirlines: [],
    maxPrice: null,
    riskTolerance: "balanced",
  };
}
