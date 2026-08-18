// Explicitly not a client-side QR generator — the QR endpoint doesn't exist yet (per the
// Internal Portal spec, "endpoint will be provided later"). This is only the display
// slot: pending (no URL yet), or loaded (renders whatever URL `vehicles.qr_code_url`
// eventually holds). Trivial to wire once the endpoint exists — no rework needed here.
export function QrCodeSlot({ qrCodeUrl }: { qrCodeUrl: string | null }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-6">
      {qrCodeUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- external QR image URL, not a static asset
        <img src={qrCodeUrl} alt="Car QR code" className="size-32 rounded-lg object-contain" />
      ) : (
        <div className="flex size-32 items-center justify-center rounded-lg bg-surface-secondary text-xs text-muted">
          QR code coming soon
        </div>
      )}
      <p className="text-xs text-muted">Scan to identify this car</p>
    </div>
  );
}
