import type { DashboardTrendPoint } from "@/lib/db/dashboard";

type SparklineProps = {
  data: DashboardTrendPoint[];
  className?: string;
};

export function Sparkline({ data, className = "" }: SparklineProps) {
  const values = data.map((point) => point.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min;
  const points = data
    .map((point, index) => {
      const x = data.length <= 1 ? 50 : (index / (data.length - 1)) * 100;
      const y = range === 0 ? 15 : 28 - ((point.value - min) / range) * 26;

      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const latest = data.at(-1);

  return (
    <div className={`print:hidden ${className}`}>
      <svg aria-hidden="true" className="h-16 w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 30">
        <polyline fill="none" points={points} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
      {latest ? (
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>{data[0]?.label}</span>
          <span>{latest.label}</span>
        </div>
      ) : null}
    </div>
  );
}
