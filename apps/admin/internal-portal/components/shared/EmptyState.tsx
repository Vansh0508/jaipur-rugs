export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-border px-4 py-8 text-center text-sm text-muted">
      {message}
    </div>
  );
}
