"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, DateField, ImageUploadField, Select, TextField } from "@jaipur-rugs/ui-kit";
import { updateOwnProfile, uploadEmployeeAvatar } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import type { Department } from "@/lib/queries/departments";

const EMPLOYMENT_TYPES = [
  { id: "full_time", label: "Full-time" },
  { id: "part_time", label: "Part-time" },
  { id: "contract", label: "Contract" },
  { id: "intern", label: "Intern" },
  { id: "consultant", label: "Consultant" },
] as const;

const STEP_LABELS = ["Contact", "Work details", "Photo", "Review"];

export function OnboardingWizard({ departments }: { departments: Pick<Department, "id" | "name">[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState("");
  const [employmentType, setEmploymentType] = useState<string>("full_time");
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [joinedAt, setJoinedAt] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const departmentName = departments.find((d) => d.id === departmentId)?.name ?? "Not set";
  const employmentLabel = EMPLOYMENT_TYPES.find((t) => t.id === employmentType)?.label ?? employmentType;

  function goNext() {
    setError(null);
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }
  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleFinish() {
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getBrowserSupabaseClient();
      let avatarPath: string | undefined;
      if (avatarFile) {
        const uploaded = await uploadEmployeeAvatar(supabase, avatarFile);
        avatarPath = uploaded.avatarPath;
      }

      await updateOwnProfile(supabase, {
        phone: phone || undefined,
        employmentType: employmentType as (typeof EMPLOYMENT_TYPES)[number]["id"],
        departmentId: departmentId ?? undefined,
        joinedAt: joinedAt || undefined,
        avatarPath,
      });

      router.push("/profile");
      router.refresh();
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Could not save your details. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex items-center justify-between gap-2">
        {STEP_LABELS.map((label, index) => (
          <li key={label} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={
                "flex size-7 items-center justify-center rounded-full text-xs font-medium " +
                (index === step
                  ? "bg-accent text-white"
                  : index < step
                    ? "bg-accent/20 text-accent"
                    : "bg-surface-secondary text-muted")
              }
            >
              {index + 1}
            </div>
            <span className={"text-xs " + (index === step ? "font-medium text-foreground" : "text-muted")}>{label}</span>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="flex flex-col gap-4">
          <TextField label="Phone" type="tel" value={phone} onChange={setPhone} placeholder="10-digit phone number" fullWidth />
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <Select
            label="Employment type"
            items={EMPLOYMENT_TYPES.map((t) => ({ id: t.id, label: t.label }))}
            value={employmentType}
            onChange={(value) => value && setEmploymentType(value)}
            isRequired
            fullWidth
          />
          <Select
            label="Department"
            items={departments.map((d) => ({ id: d.id, label: d.name }))}
            value={departmentId}
            onChange={setDepartmentId}
            placeholder="Select a department"
            fullWidth
          />
          <DateField label="Joined on" value={joinedAt} onChange={setJoinedAt} max={new Date().toISOString().slice(0, 10)} />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <ImageUploadField label="Profile photo (optional)" onFileSelect={setAvatarFile} />
          <p className="text-sm text-muted">You can skip this and add a photo later from your profile.</p>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-3 rounded-xl border-2 border-border p-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted">Phone</span>
            <span className="font-medium">{phone || "Not set"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted">Employment type</span>
            <span className="font-medium">{employmentLabel}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted">Department</span>
            <span className="font-medium">{departmentName}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted">Joined on</span>
            <span className="font-medium">{joinedAt || "Not set"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted">Photo</span>
            <span className="font-medium">{avatarFile ? avatarFile.name : "Not set"}</span>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex justify-between gap-3">
        <Button variant="tertiary" onPress={goBack} isDisabled={step === 0 || submitting}>
          Back
        </Button>
        {step < STEP_LABELS.length - 1 ? (
          <Button onPress={goNext}>Continue</Button>
        ) : (
          <Button onPress={handleFinish} isPending={submitting}>
            Complete setup
          </Button>
        )}
      </div>
    </div>
  );
}
