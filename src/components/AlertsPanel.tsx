"use client";

import { Trip, Alert } from "@/lib/types";
import { markAlertRead } from "@/lib/store";

interface Props {
  trips: Trip[];
  onUpdate: () => void;
}

const ALERT_ICONS: Record<Alert["type"], string> = {
  price_drop: "\u2193",
  recommendation_change: "\u21C4",
  price_spike: "\u2191",
  great_deal: "\u2605",
};

const ALERT_COLORS: Record<Alert["type"], string> = {
  price_drop: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400",
  recommendation_change: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400",
  price_spike: "text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400",
  great_deal: "text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function AlertsPanel({ trips, onUpdate }: Props) {
  const allAlerts: (Alert & { tripOrigin: string; tripDest: string })[] = [];

  for (const trip of trips) {
    for (const alert of trip.alerts) {
      allAlerts.push({
        ...alert,
        tripOrigin: trip.origin,
        tripDest: trip.destination,
      });
    }
  }

  allAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const unread = allAlerts.filter((a) => !a.read);

  if (allAlerts.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No alerts yet. We&apos;ll notify you when prices change or a great deal appears.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Alerts {unread.length > 0 && <span className="text-indigo-600">({unread.length} new)</span>}
        </h3>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-80 overflow-y-auto">
        {allAlerts.slice(0, 20).map((alert) => (
          <div
            key={alert.id}
            className={`px-4 py-3 flex items-start gap-3 ${!alert.read ? "bg-indigo-50/50 dark:bg-indigo-900/10" : ""}`}
            onClick={() => {
              if (!alert.read) {
                markAlertRead(alert.tripId, alert.id);
                onUpdate();
              }
            }}
          >
            <span className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${ALERT_COLORS[alert.type]}`}>
              {ALERT_ICONS[alert.type]}
            </span>
            <div className="min-w-0">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">{alert.tripOrigin} → {alert.tripDest}:</span>{" "}
                {alert.message}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(alert.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
