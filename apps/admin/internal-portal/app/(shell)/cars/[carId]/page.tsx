import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs, Chip } from "@heroui/react";
import { getServerSupabaseClient } from "@/lib/supabaseClient.server";
import { getCarListItemById } from "@/lib/queries/cars";
import { listJourneysForCar } from "@/lib/queries/journeys";
import { CarActionsMenu } from "@/components/cars/CarActionsMenu";
import { CarRidesAccordion } from "@/components/cars/CarRidesAccordion";
import { CarStatusChip } from "@/components/cars/CarStatusChip";
import { FUEL_LABEL } from "@/components/cars/fuelLabels";
import { QrCodeSlot } from "@/components/cars/QrCodeSlot";

// Car detail ported from driver-app-new's cars/[id]/page.tsx: breadcrumb, make/model title
// with plate + status, a total/completed/active stats box, an "on an active journey"
// notice, and the ride history (CarRidesAccordion). The ⋮ menu replaces the old
// Mark vacant / Send for maintenance buttons and adds Edit / Deactivate, same as the list.

function Stat({ value, label, tone }: { value: number; label: string; tone?: "warning" }) {
  return (
    <div className="text-center">
      <p className={`text-xl font-semibold tabular-nums ${tone === "warning" ? "text-warning" : "text-foreground"}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

const Divider = () => <div className="h-8 w-px bg-border" />;

export default async function CarDetailPage({ params }: { params: Promise<{ carId: string }> }) {
  const { carId } = await params;
  const supabase = await getServerSupabaseClient();
  const car = await getCarListItemById(supabase, carId);
  if (!car) notFound();

  const journeys = await listJourneysForCar(supabase, carId);
  const rides = journeys.filter((j) => j.displayStatus !== "cancelled");
  const completed = rides.filter((j) => j.displayStatus === "completed").length;
  const upcoming = rides.filter((j) => j.displayStatus === "planned").length;
  const ongoing = rides.filter((j) => j.displayStatus === "ongoing");
  const makeModel = `${car.make} ${car.model}`;

  return (
    <div>
      <Breadcrumbs className="mb-1">
        <Breadcrumbs.Item href="/cars">Cars</Breadcrumbs.Item>
        <Breadcrumbs.Item>{car.registration_number}</Breadcrumbs.Item>
      </Breadcrumbs>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{car.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {makeModel !== car.name ? <span>{makeModel}</span> : null}
            {makeModel !== car.name ? <span>·</span> : null}
            <span className="tracking-widest tabular-nums">{car.registration_number}</span>
            <span>·</span>
            <Chip size="sm" variant="soft">
              <Chip.Label>{FUEL_LABEL[car.fuel_type]}</Chip.Label>
            </Chip>
            <CarStatusChip status={car.displayStatus} />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-6 rounded-xl border border-border bg-surface-secondary/40 px-5 py-3">
            <Stat value={rides.length} label="Total rides" />
            <Divider />
            <Stat value={completed} label="Completed" />
            {upcoming > 0 ? (
              <>
                <Divider />
                <Stat value={upcoming} label="Upcoming" />
              </>
            ) : null}
            {ongoing.length > 0 ? (
              <>
                <Divider />
                <Stat value={ongoing.length} label="Active" tone="warning" />
              </>
            ) : null}
          </div>
          <CarActionsMenu car={car} />
        </div>
      </div>

      {ongoing.length > 0 ? (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-warning/40 bg-warning/5 px-4 py-3">
          <p className="text-sm font-medium text-warning">This vehicle is currently on an active journey.</p>
          <Link href={`/journeys/${ongoing[0]!.id}`} className="text-xs font-semibold text-warning underline-offset-2 hover:underline">
            View active journey →
          </Link>
        </div>
      ) : null}

      <div className="mb-8">
        <QrCodeSlot qrCodeUrl={car.qr_code_url} />
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-secondary/40 p-6">
        <h2 className="text-lg font-bold text-foreground">
          Ride history
          {journeys.length > 0 ? <span className="ml-2 text-sm font-normal text-muted">({journeys.length})</span> : null}
        </h2>
        <CarRidesAccordion journeys={journeys} />
      </section>
    </div>
  );
}
