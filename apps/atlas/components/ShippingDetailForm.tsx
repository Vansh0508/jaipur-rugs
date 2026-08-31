"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField, Select } from "@jaipur-rugs/ui-kit";
import { setShippingDetail } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { ShippingDetailRow } from "@/lib/queries/orders";

const QUOTE_STATUS_OPTIONS = [
  { id: "not_requested", label: "Not requested" },
  { id: "requested", label: "Requested" },
  { id: "quoted", label: "Quoted" },
  { id: "booked", label: "Booked" },
];

// Production/shipping-only (the edge function re-checks this — see
// supabase/functions/orders-set-shipping-detail's own comment). Rendered regardless of
// role by the order detail page; a caller without access simply gets a 403 from the
// function, surfaced as the form's error message — no separate client-side role check
// duplicated here (RLS/the edge function is the real gate, not this component).
export function ShippingDetailForm({ orderId, existing }: { orderId: string; existing: ShippingDetailRow | null }) {
  const router = useRouter();
  const [weightKg, setWeightKg] = useState(existing?.weight_kg?.toString() ?? "");
  const [lengthCm, setLengthCm] = useState(existing?.length_cm?.toString() ?? "");
  const [widthCm, setWidthCm] = useState(existing?.width_cm?.toString() ?? "");
  const [heightCm, setHeightCm] = useState(existing?.height_cm?.toString() ?? "");
  const [carrier, setCarrier] = useState(existing?.carrier ?? "");
  const [quoteStatus, setQuoteStatus] = useState(existing?.quote_status ?? "not_requested");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      await setShippingDetail(supabase, {
        orderId,
        weightKg: weightKg ? Number(weightKg) : null,
        lengthCm: lengthCm ? Number(lengthCm) : null,
        widthCm: widthCm ? Number(widthCm) : null,
        heightCm: heightCm ? Number(heightCm) : null,
        carrier: carrier || null,
        quoteStatus: quoteStatus as "not_requested" | "requested" | "quoted" | "booked",
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save shipping details.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border-2 border-border p-5">
      <h3 className="text-sm font-semibold uppercase text-muted">Shipping details</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TextField label="Weight (kg)" type="number" value={weightKg} onChange={setWeightKg} />
        <TextField label="Length (cm)" type="number" value={lengthCm} onChange={setLengthCm} />
        <TextField label="Width (cm)" type="number" value={widthCm} onChange={setWidthCm} />
        <TextField label="Height (cm)" type="number" value={heightCm} onChange={setHeightCm} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Carrier" value={carrier} onChange={setCarrier} />
        <Select
          label="Quote status"
          value={quoteStatus}
          onChange={(key) => setQuoteStatus(key ?? "not_requested")}
          items={QUOTE_STATUS_OPTIONS}
        />
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div>
        <Button type="submit" isPending={submitting}>
          Save shipping details
        </Button>
      </div>
    </form>
  );
}
