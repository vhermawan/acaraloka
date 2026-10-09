import type { SeriesPoint } from "@/lib/admin-stats";

type BarChartProps = {
  title: string;
  description: string;
  unit: string;
  series: SeriesPoint[];
  formatLabel: (key: string) => string;
  tickEvery: number;
};

export function BarChart({ title, description, unit, series, formatLabel, tickEvery }: BarChartProps) {
  const total = series.reduce((sum, point) => sum + point.count, 0);
  const max = Math.max(1, ...series.map((point) => point.count));

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-balance text-base font-semibold">{title}</h2>
        <p className="text-pretty text-sm text-muted-foreground">{description}</p>
      </header>
      {total === 0 ? (
        <p className="rounded-md bg-muted px-3 py-8 text-center text-sm text-muted-foreground">
          Belum ada data pada periode ini.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto" tabIndex={0} role="group" aria-label={`Grafik ${title}`}>
            <div className="flex min-w-md flex-col gap-1" aria-hidden="true">
              <div className="flex items-center justify-between text-xs tabular-nums text-muted-foreground">
                <span>{max.toLocaleString("id-ID")}</span>
                <span>Total {total.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex h-32 items-end gap-0.5 border-b border-border">
                {series.map((point) => (
                  <div
                    key={point.key}
                    title={`${formatLabel(point.key)}: ${point.count.toLocaleString("id-ID")} ${unit}`}
                    className="flex h-full min-w-0 flex-1 items-end"
                  >
                    <div
                      className="w-full rounded-t-sm bg-primary"
                      style={{ height: point.count === 0 ? 0 : `max(2px, ${(point.count / max) * 100}%)` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-0.5 text-[11px] text-muted-foreground">
                {series.map((point, index) => (
                  <div key={point.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
                    {index % tickEvery === 0 ? formatLabel(point.key) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <table className="sr-only">
            <caption>{title}</caption>
            <thead>
              <tr>
                <th scope="col">Periode</th>
                <th scope="col">Jumlah {unit}</th>
              </tr>
            </thead>
            <tbody>
              {series.map((point) => (
                <tr key={point.key}>
                  <th scope="row">{formatLabel(point.key)}</th>
                  <td>{point.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
