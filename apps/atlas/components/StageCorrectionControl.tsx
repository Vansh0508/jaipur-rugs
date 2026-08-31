"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Select } from "@jaipur-rugs/ui-kit";
import { updateOrderStage } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { StageRow } from "@/lib/queries/orders";

// Manual override for the rare case status_stage_map hasn't caught up yet (see
// supabase/functions/orders-update-stage's own comment). Production department access
// or orders.write.all (admin) — enforced by the edge function, not duplicated here.
export function StageCorrectionControl({ orderId, stages, currentStageId }: { orderId: string; stages: StageRow[]; currentStageId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stageId, setStageId] = useState(currentStageId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const stage = stages.find((s) => s.id === stageId);
    if (!stage) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      await updateOrderStage(supabase, { orderId, stageCode: stage.code });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update stage. You may not have access to correct this order.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button variant="tertiary" size="sm" onPress={() => setOpen(true)}>
        Correct stage
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <Select
        label="Correct to"
        value={stageId}
        onChange={(key) => setStageId(key ?? "")}
        items={stages.map((s) => ({ id: s.id, label: s.display_name }))}
      />
      <Button type="submit" size="sm" isPending={submitting}>
        Save
      </Button>
      <Button type="button" variant="tertiary" size="sm" onPress={() => setOpen(false)}>
        Cancel
      </Button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </form>
  );
}
