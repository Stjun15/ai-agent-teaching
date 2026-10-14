export default function ModuleLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-0">
      {/* 左栏骨架 */}
      <div className="hidden w-64 shrink-0 border-r px-4 py-6 lg:block">
        <div className="mb-4 h-4 w-20 animate-pulse rounded bg-muted" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-6 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
      {/* 中栏骨架 */}
      <div className="flex-1 p-6">
        <div className="mb-4 h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="flex flex-col gap-3">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
          <div className="h-4 w-4/6 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-6 h-40 animate-pulse rounded-lg bg-muted" />
      </div>
      {/* 右栏骨架 */}
      <div className="hidden w-72 shrink-0 border-l px-4 py-6 xl:block">
        <div className="mb-4 h-4 w-16 animate-pulse rounded bg-muted" />
        <div className="flex flex-col gap-2">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}