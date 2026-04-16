export type RiskTolerance = "conservative" | "balanced" | "aggressive";
export type CabinClass = "economy" | "premium_economy" | "business" | "first";
export type Recommendation = "buy_now" | "wait" | "monitor";

export interface Trip {
  id: string;
  origin: string;
  destination: string;
  departureDate: string; // ISO date
  returnDate: string;
  nonstopOnly: boolean;
  cabinClass: CabinClass;
  travelers: number;
  preferredAirlines: string[];
  maxPrice: number | null;
  riskTolerance: RiskTolerance;
  createdAt: string;
  alerts: Alert[];
  priceHistory: PricePoint[];
}

export interface PricePoint {
  date: string; // ISO date
  price: number;
  airline: string;
  source: string;
}

export interface Alert {
  id: string;
  tripId: string;
  type: "price_drop" | "recommendation_change" | "price_spike" | "great_deal";
  message: string;
  timestamp: string;
  read: boolean;
  previousValue?: string;
  newValue?: string;
}

export interface RecommendationResult {
  recommendation: Recommendation;
  confidence: number; // 0-100
  currentBestPrice: number;
  priceRange: { low: number; high: number; average: number };
  explanation: string;
  factors: RecommendationFactor[];
  predictedOptimalWindow: string;
  estimatedSavings: number;
}

export interface RecommendationFactor {
  name: string;
  impact: "positive" | "negative" | "neutral";
  weight: number; // 0-1
  description: string;
}

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  nonstopOnly: boolean;
  cabinClass: CabinClass;
  travelers: number;
  preferredAirlines: string[];
}

export interface FlightResult {
  price: number;
  airline: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  outbound: FlightLeg;
  returnLeg: FlightLeg;
}

export interface FlightLeg {
  departure: string;
  arrival: string;
  departureTime: string;
  arrivalTime: string;
  airline: string;
  flightNumber: string;
  duration: string;
}

export const AIRPORTS: Record<string, string> = {
  ORD: "Chicago O'Hare",
  SJD: "San Jose del Cabo",
  LAX: "Los Angeles",
  JFK: "New York JFK",
  SFO: "San Francisco",
  MIA: "Miami",
  CUN: "Cancun",
  DEN: "Denver",
  ATL: "Atlanta",
  SEA: "Seattle",
  DFW: "Dallas/Fort Worth",
  LAS: "Las Vegas",
  MCO: "Orlando",
  HNL: "Honolulu",
  BOS: "Boston",
  PHL: "Philadelphia",
  PHX: "Phoenix",
  IAH: "Houston",
  MSP: "Minneapolis",
  DTW: "Detroit",
  SAN: "San Diego",
  TPA: "Tampa",
  PVR: "Puerto Vallarta",
  AUA: "Aruba",
  NAS: "Nassau",
  MBJ: "Montego Bay",
};

export const AIRLINES = [
  "American Airlines",
  "United Airlines",
  "Delta Air Lines",
  "Southwest Airlines",
  "Alaska Airlines",
  "JetBlue Airways",
  "Spirit Airlines",
  "Frontier Airlines",
];
