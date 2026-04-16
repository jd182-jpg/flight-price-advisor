"use client";

import { useState } from "react";
import { AIRPORTS, AIRLINES, CabinClass, RiskTolerance, Trip } from "@/lib/types";

interface Props {
  onSubmit: (trip: Omit<Trip, "id" | "createdAt" | "alerts" | "priceHistory">) => void;
  onCancel: () => void;
}

export default function TripForm({ onSubmit, onCancel }: Props) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [nonstopOnly, setNonstopOnly] = useState(false);
  const [cabinClass, setCabinClass] = useState<CabinClass>("economy");
  const [travelers, setTravelers] = useState(1);
  const [preferredAirlines, setPreferredAirlines] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState("");
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("balanced");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [originSearch, setOriginSearch] = useState("");
  const [destSearch, setDestSearch] = useState("");
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);

  const airportCodes = Object.keys(AIRPORTS);

  const filteredOrigins = airportCodes.filter(
    (code) =>
      code.toLowerCase().includes(originSearch.toLowerCase()) ||
      AIRPORTS[code].toLowerCase().includes(originSearch.toLowerCase())
  );

  const filteredDests = airportCodes.filter(
    (code) =>
      code.toLowerCase().includes(destSearch.toLowerCase()) ||
      AIRPORTS[code].toLowerCase().includes(destSearch.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination || !departureDate || !returnDate) return;

    onSubmit({
      origin,
      destination,
      departureDate,
      returnDate,
      nonstopOnly,
      cabinClass,
      travelers,
      preferredAirlines,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      riskTolerance,
    });
  };

  const AirportSelect = ({
    value,
    search,
    setSearch,
    setValue,
    show,
    setShow,
    filtered,
    label,
  }: {
    value: string;
    search: string;
    setSearch: (s: string) => void;
    setValue: (s: string) => void;
    show: boolean;
    setShow: (b: boolean) => void;
    filtered: string[];
    label: string;
  }) => (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <input
        type="text"
        value={value ? `${value} - ${AIRPORTS[value]}` : search}
        onChange={(e) => {
          setSearch(e.target.value);
          setValue("");
          setShow(true);
        }}
        onFocus={() => setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 200)}
        placeholder="Search airport..."
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
      {show && filtered.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.slice(0, 10).map((code) => (
            <button
              key={code}
              type="button"
              onMouseDown={() => {
                setValue(code);
                setSearch("");
                setShow(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
            >
              <span className="font-semibold">{code}</span>{" "}
              <span className="text-gray-500 dark:text-gray-400">- {AIRPORTS[code]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add a Trip to Track</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <AirportSelect
          value={origin}
          search={originSearch}
          setSearch={setOriginSearch}
          setValue={setOrigin}
          show={showOriginDropdown}
          setShow={setShowOriginDropdown}
          filtered={filteredOrigins}
          label="Origin Airport"
        />
        <AirportSelect
          value={destination}
          search={destSearch}
          setSearch={setDestSearch}
          setValue={setDestination}
          show={showDestDropdown}
          setShow={setShowDestDropdown}
          filtered={filteredDests}
          label="Destination Airport"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Departure Date</label>
          <input
            type="date"
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Return Date</label>
          <input
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            min={departureDate || new Date().toISOString().split("T")[0]}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cabin Class</label>
          <select
            value={cabinClass}
            onChange={(e) => setCabinClass(e.target.value as CabinClass)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="economy">Economy</option>
            <option value="premium_economy">Premium Economy</option>
            <option value="business">Business</option>
            <option value="first">First Class</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Travelers</label>
          <input
            type="number"
            min={1}
            max={9}
            value={travelers}
            onChange={(e) => setTravelers(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer pb-2">
            <input
              type="checkbox"
              checked={nonstopOnly}
              onChange={(e) => setNonstopOnly(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Nonstop flights only</span>
          </label>
        </div>
      </div>

      {/* Risk Tolerance */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Risk Tolerance</label>
        <div className="flex gap-2">
          {(["conservative", "balanced", "aggressive"] as RiskTolerance[]).map((rt) => (
            <button
              key={rt}
              type="button"
              onClick={() => setRiskTolerance(rt)}
              className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                riskTolerance === rt
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium"
                  : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400"
              }`}
            >
              <div className="capitalize">{rt}</div>
              <div className="text-xs mt-0.5 opacity-70">
                {rt === "conservative" ? "Buy earlier, safer" : rt === "balanced" ? "Optimize" : "Wait for best deal"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Options */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mb-4"
      >
        {showAdvanced ? "Hide" : "Show"} advanced options
      </button>

      {showAdvanced && (
        <div className="space-y-4 mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Max Acceptable Price (per person)
            </label>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="No limit"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Preferred Airlines
            </label>
            <div className="flex flex-wrap gap-2">
              {AIRLINES.map((airline) => (
                <label key={airline} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={preferredAirlines.includes(airline)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPreferredAirlines([...preferredAirlines, airline]);
                      } else {
                        setPreferredAirlines(preferredAirlines.filter((a) => a !== airline));
                      }
                    }}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-gray-600 dark:text-gray-400">{airline}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!origin || !destination || !departureDate || !returnDate}
          className="flex-1 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Track This Trip
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
