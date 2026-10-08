export default function ParticipantsLoading() {
  return (
    <div role="status" className="flex flex-col gap-6">
      <span className="sr-only">Memuat daftar peserta</span>
      <div className="flex gap-5">
        {[0, 1, 2].map((item) => (
          <div key={item} className="flex flex-col gap-2">
            <div className="h-3.5 w-16 rounded bg-muted" />
            <div className="h-7 w-10 rounded bg-muted motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
      <div className="h-10 max-w-md rounded-lg bg-muted" />
      <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="flex items-center gap-4 px-4 py-3.5">
            <div className="h-4 w-1/4 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-4 w-1/3 rounded bg-muted motion-safe:animate-pulse" />
            <div className="ml-auto h-5 w-16 rounded-full bg-muted motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
