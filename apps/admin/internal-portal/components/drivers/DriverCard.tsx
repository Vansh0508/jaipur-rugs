import Link from "next/link";
import { Card } from "@heroui/react";
import type { Driver } from "@/lib/queries/drivers";
import { resolvePhotoUrl } from "@/lib/env";

export function DriverCard({ driver }: { driver: Driver }) {
  const photoUrl = resolvePhotoUrl(driver.photo_path);
  return (
    <Link href={`/drivers/${driver.id}`}>
      <Card className="h-full items-center text-center">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL, not a static asset
          <img src={photoUrl} alt={driver.full_name} className="size-16 rounded-full object-cover" />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-full bg-surface-secondary text-sm font-medium text-muted">
            {driver.full_name
              .split(" ")
              .map((p: string) => p[0])
              .slice(0, 2)
              .join("")}
          </div>
        )}
        <Card.Header>
          <Card.Title className="text-base">{driver.full_name}</Card.Title>
          <Card.Description>{driver.driver_code}</Card.Description>
        </Card.Header>
      </Card>
    </Link>
  );
}
