import { FlightSearchParams, FlightResult, PricePoint } from "./types";

// Seasonal multipliers for common leisure routes
const SEASONAL_MULTIPLIERS: Record<number, number> = {
  0: 1.15, // January - post-holiday, still elevated for warm destinations
  1: 0.95, // February - shoulder
  2: 1.1, // March - spring break
  3: 1.0, // April
  4: 0.9, // May - sweet spot
  5: 1.15, // June - summer start
  6: 1.25, // July - peak summer
  7: 1.2, // August - still summer
  8: 0.85, // September - low season
  9: 0.9, // October
  10: 1.05, // November - Thanksgiving
  11: 1.3, // December - holidays
};

// Holiday dates that spike prices (month-day)
const HOLIDAY_WINDOWS = [
  { start: "12-18", end: "01-05", name: "Winter Holidays", multiplier: 1.4 },
  { start: "03-10", end: "03-25", name: "Spring Break", multiplier: 1.2 },
  { start: "05-22", end: "05-30", name: "Memorial Day", multiplier: 1.15 },
  { start: "06-28", end: "07-06", name: "Independence Day", multiplier: 1.2 },
  { start: "08-28", end: "09-05", name: "Labor Day", multiplier: 1.15 },
  { start: "11-20", end: "11-30", name: "Thanksgiving", multiplier: 1.25 },
];

// Base prices for common routes (round trip, economy)
const ROUTE_BASE_PRICES: Record<string, number> = {
  "ORD-SJD": 380,
  "ORD-CUN": 350,
  "ORD-LAX": 220,
  "ORD-MIA": 240,
  "ORD-JFK": 180,
  "JFK-LAX": 280,
  "JFK-MIA": 200,
  "JFK-CUN": 320,
  "JFK-SJD": 420,
  "LAX-HNL": 380,
  "LAX-SJD": 300,
  "SFO-HNL": 360,
  "DEN-CUN": 340,
  "ATL-CUN": 310,
  "DFW-SJD": 320,
  "SEA-LAX": 180,
  "BOS-MIA": 220,
};

function getBasePrice(origin: string, destination: string): number {
  const key1 = `${origin}-${destination}`;
  const key2 = `${destination}-${origin}`;
  return ROUTE_BASE_PRICES[key1] || ROUTE_BASE_PRICES[key2] || 350;
}

function isInHolidayWindow(date: string): { inWindow: boolean; multiplier: number; name: string } {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const mmdd = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  for (const hw of HOLIDAY_WINDOWS) {
    // Handle cross-year windows (like winter holidays)
    if (hw.start > hw.end) {
      if (mmdd >= hw.start || mmdd <= hw.end) {
        return { inWindow: true, multiplier: hw.multiplier, name: hw.name };
      }
    } else {
      if (mmdd >= hw.start && mmdd <= hw.end) {
        return { inWindow: true, multiplier: hw.multiplier, name: hw.name };
      }
    }
  }
  return { inWindow: false, multiplier: 1.0, name: "" };
}

function getCabinMultiplier(cabin: string): number {
  switch (cabin) {
    case "premium_economy": return 1.6;
    case "business": return 3.2;
    case "first": return 5.5;
    default: return 1.0;
  }
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Simulate price for a given date based on route, seasonality, and booking window.
 * In production, replace this with a real flight API call.
 */
export function simulatePrice(
  origin: string,
  destination: string,
  departureDate: string,
  cabinClass: string,
  nonstopOnly: boolean,
  daysUntilDeparture: number,
  seed?: number
): number {
  const base = getBasePrice(origin, destination);
  const depDate = new Date(departureDate);
  const monthMultiplier = SEASONAL_MULTIPLIERS[depDate.getMonth()] || 1.0;
  const holiday = isInHolidayWindow(departureDate);
  const cabinMult = getCabinMultiplier(cabinClass);
  const nonstopMult = nonstopOnly ? 1.15 : 1.0;

  // Booking window curve: prices tend to be higher very far out,
  // drop to a sweet spot 2-4 months before, then climb sharply close to departure
  let bookingWindowMult: number;
  if (daysUntilDeparture > 300) {
    bookingWindowMult = 1.1;
  } else if (daysUntilDeparture > 180) {
    bookingWindowMult = 1.0;
  } else if (daysUntilDeparture > 90) {
    bookingWindowMult = 0.92;
  } else if (daysUntilDeparture > 60) {
    bookingWindowMult = 0.88;
  } else if (daysUntilDeparture > 30) {
    bookingWindowMult = 0.95;
  } else if (daysUntilDeparture > 14) {
    bookingWindowMult = 1.15;
  } else if (daysUntilDeparture > 7) {
    bookingWindowMult = 1.35;
  } else {
    bookingWindowMult = 1.6;
  }

  const rng = seededRandom(seed ?? Math.floor(Math.random() * 100000));
  const noise = 0.9 + rng() * 0.2; // +/- 10% random noise

  let price = base * monthMultiplier * holiday.multiplier * cabinMult * nonstopMult * bookingWindowMult * noise;
  return Math.round(price);
}

/**
 * Generate a simulated price history for a trip.
 * Shows how prices have changed over the past weeks/months.
 */
export function generatePriceHistory(
  origin: string,
  destination: string,
  departureDate: string,
  cabinClass: string,
  nonstopOnly: boolean,
  numDays: number = 90
): PricePoint[] {
  const points: PricePoint[] = [];
  const depDate = new Date(departureDate);
  const today = new Date();
  const airlines = ["American Airlines", "United Airlines", "Delta Air Lines", "Alaska Airlines"];

  for (let i = numDays; i >= 0; i--) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);

    if (checkDate > today) continue;

    const daysUntil = Math.floor((depDate.getTime() - checkDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) continue;

    const seed = hashCode(`${origin}${destination}${departureDate}${i}`);
    const price = simulatePrice(origin, destination, departureDate, cabinClass, nonstopOnly, daysUntil, seed);
    const airlineIndex = Math.abs(seed) % airlines.length;

    points.push({
      date: checkDate.toISOString().split("T")[0],
      price,
      airline: airlines[airlineIndex],
      source: "simulated",
    });
  }

  return points;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

/**
 * Simulate current flight search results.
 * Replace this function with a real API integration (Amadeus, Skyscanner, Google Flights, etc.)
 */
export function searchFlights(params: FlightSearchParams): FlightResult[] {
  const { origin, destination, departureDate, returnDate, nonstopOnly, cabinClass, travelers } = params;
  const depDate = new Date(departureDate);
  const today = new Date();
  const daysUntil = Math.floor((depDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const results: FlightResult[] = [];
  const airlines = params.preferredAirlines.length > 0
    ? params.preferredAirlines
    : ["American Airlines", "United Airlines", "Delta Air Lines", "Alaska Airlines"];

  for (let i = 0; i < airlines.length; i++) {
    const seed = hashCode(`${origin}${destination}${departureDate}${airlines[i]}`);
    const basePrice = simulatePrice(origin, destination, departureDate, cabinClass, nonstopOnly, daysUntil, seed);
    const pricePerPerson = basePrice;

    const departHour = 6 + (Math.abs(seed) % 14);
    const flightHours = 3 + (Math.abs(seed) % 3);
    const arriveHour = departHour + flightHours;

    results.push({
      price: pricePerPerson * travelers,
      airline: airlines[i],
      departureTime: `${String(departHour).padStart(2, "0")}:${seed % 2 === 0 ? "00" : "30"}`,
      arrivalTime: `${String(arriveHour % 24).padStart(2, "0")}:${seed % 3 === 0 ? "15" : "45"}`,
      duration: `${flightHours}h ${seed % 2 === 0 ? "0" : "30"}m`,
      stops: nonstopOnly ? 0 : Math.abs(seed) % 2,
      outbound: {
        departure: origin,
        arrival: destination,
        departureTime: `${departureDate}T${String(departHour).padStart(2, "0")}:00`,
        arrivalTime: `${departureDate}T${String(arriveHour % 24).padStart(2, "0")}:00`,
        airline: airlines[i],
        flightNumber: `${airlines[i].substring(0, 2).toUpperCase()}${1000 + Math.abs(seed) % 900}`,
        duration: `${flightHours}h ${seed % 2 === 0 ? "0" : "30"}m`,
      },
      returnLeg: {
        departure: destination,
        arrival: origin,
        departureTime: `${returnDate}T${String((departHour + 2) % 24).padStart(2, "0")}:00`,
        arrivalTime: `${returnDate}T${String((arriveHour + 2) % 24).padStart(2, "0")}:00`,
        airline: airlines[i],
        flightNumber: `${airlines[i].substring(0, 2).toUpperCase()}${1000 + (Math.abs(seed) + 1) % 900}`,
        duration: `${flightHours}h ${seed % 2 === 0 ? "30" : "0"}m`,
      },
    });
  }

  return results.sort((a, b) => a.price - b.price);
}
