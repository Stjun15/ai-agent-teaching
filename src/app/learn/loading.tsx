export default function LearnLoading() {
  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-xl border bg-card p-5"
            >
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="mt-2 h-8 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}