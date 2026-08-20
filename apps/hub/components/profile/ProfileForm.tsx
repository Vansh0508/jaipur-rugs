"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, DateField, ImageUploadField, Select, TextField } from "@jaipur-rugs/ui-kit";
import { updateOwnProfile, uploadEmployeeAvatar } from "@jaipur-rugs/db-management-client";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { resolveAvatarUrl } from "@/lib/env";
import type { OwnProfile } from "@/lib/queries/employees";
import type { Department } from "@/lib/queries/departments";

const EMPLOYMENT_TYPES = [
  { id: "full_time", label: "Full-time" },
  { id: "part_time", label: "Part-time" },
  { id: "contract", label: "Contract" },
  { id: "intern", label: "Intern" },
  { id: "consultant", label: "Consultant" },
] as const;

export function ProfileForm({
  profile,
  departments,
}: {
  profile: OwnProfile;
  departments: Pick<Department, "id" | "name">[];
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [employmentType, setEmploymentType] = useState<string>(profile.employmentType);
  const [departmentId, setDepartmentId] = useState<string | null>(profile.departmentId);
  const [joinedAt, setJoinedAt] = useState(profile.joinedAt ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPath, setAvatarPath] = useState(profile.avatarPath);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const previewUrl = avatarFile ? URL.createObjectURL(avatarFile) : resolveAvatarUrl(avatarPath);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const supabase = getBrowserSupabaseClient();
      let nextAvatarPath = avatarPath ?? undefined;
      if (avatarFile) {
        const uploaded = await uploadEmployeeAvatar(supabase, avatarFile);
        nextAvatarPath = uploaded.avatarPath;
      }

      await updateOwnProfile(supabase, {
        phone: phone || undefined,
        employmentType: employmentType as (typeof EMPLOYMENT_TYPES)[number]["id"],
        departmentId: departmentId ?? undefined,
        joinedAt: joinedAt || undefined,
        avatarPath: nextAvatarPath,
      });

      setAvatarPath(nextAvatarPath ?? null);
      setAvatarFile(null);
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-6">
      <div className="flex items-center gap-4">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL or a Supabase Storage public URL, not a static asset
          <img src={previewUrl} alt={profile.fullName} className="size-16 rounded-full object-cover" />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-full bg-surface-secondary text-sm font-medium text-muted">
            {profile.fullName
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </div>
        )}
        <div>
          <p className="text-base font-semibold text-foreground">{profile.fullName}</p>
          <p className="text-sm text-muted">
            {profile.employeeCode} · {profile.email}
          </p>
        </div>
      </div>

      <ImageUploadField label="Change photo" onFileSelect={setAvatarFile} />

      <div className="grid grid-cols-2 gap-4 rounded-xl border-2 border-border p-4 text-sm">
        <div>
          <p className="text-muted">Department</p>
          <p className="font-medium">{profile.departmentName ?? "Not set"}</p>
        </div>
        <div>
          <p className="text-muted">Manager</p>
          <p className="font-medium">{profile.managerName ?? "Not set"}</p>
        </div>
        <div>
          <p className="text-muted">Role</p>
          <p className="font-medium">{profile.roleName ?? "Not set"}</p>
        </div>
      </div>
      <p className="-mt-4 text-xs text-muted">
        Department shown above reflects the value below — manager and role are set by your admin from the Team page.
      </p>

      <TextField label="Phone" type="tel" value={phone} onChange={setPhone} fullWidth />
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

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {success ? <p className="text-sm text-success">Profile updated.</p> : null}

      <Button type="submit" isPending={submitting} className="self-start">
        Save changes
      </Button>
    </form>
  );
}
