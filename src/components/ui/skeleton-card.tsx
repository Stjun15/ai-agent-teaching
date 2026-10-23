export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-muted/40 p-5 ${className ?? ""}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-muted/50 to-transparent" />
      <div className="mb-3 h-4 w-1/3 rounded bg-muted" />
      <div className="mb-2 h-3 w-2/3 rounded bg-muted/70" />
      <div className="h-3 w-1/2 rounded bg-muted/70" />
    </div>
  );
}

export function SkeletonGrid({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${className ?? ""}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
