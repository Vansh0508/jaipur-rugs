"use client";

import { useId, useState } from "react";

export interface ImageUploadFieldProps {
  label?: string;
  onFileSelect: (file: File | null) => void;
  isRequired?: boolean;
  className?: string;
}

/**
 * A plain native `<input type="file" accept="image/*">`, styled to match Hero UI's
 * bordered inputs — same treatment `DateField` gives a native `<input type="date">`.
 * Hero UI v3 has no dedicated upload/file-field component (checked its full component
 * list). Shows a small local preview via `URL.createObjectURL` so an admin can confirm
 * the right photo was picked before submitting; the actual upload destination (S3 or a
 * Storage bucket) is decided by whatever calls `onFileSelect`, not this component.
 */
export function ImageUploadField({ label, onFileSelect, isRequired, className }: ImageUploadFieldProps) {
  const inputId = useId();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    onFileSelect(file);
  }

  return (
    <div className={"flex flex-col gap-1.5 " + (className ?? "")}>
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      ) : null}
      <div className="flex items-center gap-3">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL, not a remote asset
          <img src={previewUrl} alt="Selected preview" className="size-11 rounded-lg object-cover" />
        ) : null}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          required={isRequired}
          onChange={handleChange}
          className={
            "h-11 flex-1 rounded-lg border-2 border-border bg-transparent px-3 text-sm outline-none " +
            "transition-colors file:mr-3 file:h-full file:cursor-pointer file:border-0 " +
            "file:bg-transparent file:text-sm file:font-medium file:text-accent focus:border-accent"
          }
        />
      </div>
    </div>
  );
}
