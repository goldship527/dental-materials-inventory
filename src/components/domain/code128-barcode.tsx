import { getCode128Bars, isValidCode128BValue } from "@/lib/barcode/code128";

type Code128BarcodeProps = {
  value: string;
  height?: number;
  moduleWidth?: number;
  showText?: boolean;
};

export function Code128Barcode({ value, height = 64, moduleWidth = 2, showText = true }: Code128BarcodeProps) {
  const bars = getCode128Bars(value);
  const width = bars.reduce((max, bar) => Math.max(max, bar.x + bar.width), 0) * moduleWidth;

  if (!isValidCode128BValue(value)) {
    return <span className="text-xs font-semibold text-danger">Code 128で表示できない文字が含まれています。</span>;
  }

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <svg
        role="img"
        aria-label={`Code 128 ${value}`}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="bg-white"
      >
        <rect width={width} height={height} fill="white" />
        {bars.map((bar) => (
          <rect key={`${bar.x}-${bar.width}`} x={bar.x * moduleWidth} y={0} width={bar.width * moduleWidth} height={height} fill="black" />
        ))}
      </svg>
      {showText ? <span className="font-mono text-xs tracking-normal text-ink">{value}</span> : null}
    </div>
  );
}
