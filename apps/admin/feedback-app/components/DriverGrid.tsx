"use client";

import { useState } from "react";
import { FeedbackModal } from "./FeedbackModal";

export interface Driver {
  id: string;
  fullName: string;
  photoUrl: string | null;
}

export function DriverGrid({ drivers }: { drivers: Driver[] }) {
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  if (drivers.length === 0) {
    return <p className="text-muted">No drivers available right now.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {drivers.map((driver) => (
          <button
            key={driver.id}
            type="button"
            onClick={() => setSelectedDriver(driver)}
            className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <span className="p-3 pb-0">
              <span className="block aspect-square w-full overflow-hidden rounded-lg bg-default">
                {driver.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- S3-hosted, not a Next/Image-managed asset
                  <img src={driver.photoUrl} alt={driver.fullName} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-4xl font-medium text-muted">
                    {driver.fullName.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
            </span>
            <span className="px-3 py-3 text-center text-sm font-medium">{driver.fullName}</span>
          </button>
        ))}
      </div>

      <FeedbackModal driver={selectedDriver} onClose={() => setSelectedDriver(null)} />
    </>
  );
}
