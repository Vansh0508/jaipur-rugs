"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@jaipur-rugs/ui-kit";
import { UploadIcon } from "@/components/shared/icons";

// Matches upload-driver-photo's server-side allowlist — the server re-checks both, this
// is only so a wrong file is rejected before a network round-trip.
const ACCEPTED_TYPES = ["image/jpeg", "image/png"];
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png"];
const MAX_BYTES = 5 * 1024 * 1024;

function validate(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!ACCEPTED_TYPES.includes(file.type) || !ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return "Only JPG, JPEG or PNG images are supported.";
  }
  if (file.size > MAX_BYTES) return "The photo must be 5 MB or smaller.";
  return null;
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Driver photo picker: drag & drop or click/keyboard to browse, JPG/JPEG/PNG only, ≤ 5 MB.
 * App-local rather than a change to ui-kit's ImageUploadField — that one also backs Hub's
 * onboarding/profile avatar fields, which asked for none of this (AGENTS.md Section 4).
 * Hero UI v3 has no file/drop component, so it's a native hidden <input type="file"> plus
 * native drag events.
 *
 * `file` is the newly picked file (controlled by the parent); `currentPhotoUrl` is the
 * saved photo shown until it's replaced or removed. `onRemove` clears whichever is shown.
 */
export function PhotoDropzone({
  label,
  file,
  onFileChange,
  currentPhotoUrl,
  onRemove,
}: {
  label: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  currentPhotoUrl?: string | null;
  onRemove: () => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Object URL for the picked file's preview, revoked when the file changes/unmounts.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function accept(candidate: File | undefined) {
    if (!candidate) return;
    const problem = validate(candidate);
    setError(problem);
    if (!problem) onFileChange(candidate);
  }

  function browse() {
    inputRef.current?.click();
  }

  const shownUrl = previewUrl ?? currentPhotoUrl ?? null;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>

      {shownUrl ? (
        <div className="flex items-center gap-3 rounded-xl border-2 border-border p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL / Storage public URL */}
          <img src={shownUrl} alt="Driver photo preview" className="size-14 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-foreground">{file ? file.name : "Current photo"}</p>
            {file ? <p className="text-xs text-muted">{formatSize(file.size)}</p> : null}
          </div>
          <Button variant="tertiary" size="sm" onPress={browse}>
            Replace
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            onPress={() => {
              setError(null);
              onRemove();
            }}
          >
            Remove
          </Button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload photo — drag and drop, or press to browse"
          aria-describedby={`${inputId}-hint`}
          onClick={browse}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              browse();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={(e) => {
            // Only when leaving the zone itself, not when crossing into a child element.
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            accept(e.dataTransfer.files?.[0]);
          }}
          className={
            "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center outline-none transition-colors focus-visible:border-accent " +
            (isDragging ? "border-accent bg-accent/5" : "border-border hover:bg-surface-secondary/60")
          }
        >
          <UploadIcon className={isDragging ? "text-accent" : "text-muted"} />
          <p className="text-sm text-foreground">
            {isDragging ? "Drop the photo here" : (
              <>
                Drag &amp; drop a photo here, or <span className="font-medium text-accent">browse</span>
              </>
            )}
          </p>
          <p id={`${inputId}-hint`} className="text-xs text-muted">
            JPG, JPEG or PNG · up to 5 MB
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = ""; // so re-picking the same file after Remove still fires onChange
        }}
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
