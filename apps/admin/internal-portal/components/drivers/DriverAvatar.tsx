import { resolvePhotoUrl } from "@/lib/env";

const SIZE_CLASS = { sm: "size-8 text-[10px]", md: "size-11 text-sm" } as const;

/** Driver photo from the driver-photos bucket, or up-to-two-letter initials without one. */
export function DriverAvatar({
  fullName,
  photoPath,
  size = "md",
}: {
  fullName: string;
  photoPath: string | null;
  size?: keyof typeof SIZE_CLASS;
}) {
  const photoUrl = resolvePhotoUrl(photoPath);
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL, not a static asset
      <img src={photoUrl} alt={fullName} className={`${SIZE_CLASS[size]} shrink-0 rounded-full border border-border object-cover`} />
    );
  }
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      aria-hidden
      className={`${SIZE_CLASS[size]} flex shrink-0 items-center justify-center rounded-full bg-surface-secondary font-semibold text-muted`}
    >
      {initials}
    </div>
  );
}
