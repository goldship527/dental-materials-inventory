import { getEan13Bars, isValidEan13 } from "@/lib/barcode/ean13";

type Ean13BarcodeProps = {
  value: string;
  height?: number;
  moduleWidth?: number;
  showText?: boolean;
};

export function Ean13Barcode({ value, height = 56, moduleWidth = 2, showText = true }: Ean13BarcodeProps) {
  const bars = getEan13Bars(value);
  const width = 95 * moduleWidth;

  if (!isValidEan13(value)) {
    return <span className="text-xs font-semibold text-danger">JANコードのチェックデジットが不正です</span>;
  }

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <svg
        role="img"
        aria-label={`JAN ${value}`}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="bg-white"
      >
        <rect width={width} height={height} fill="white" />
        {bars.map((bar) => (
          <rect
            key={`${bar.x}-${bar.width}`}
            x={bar.x * moduleWidth}
            y={0}
            width={bar.width * moduleWidth}
            height={bar.isGuard ? height : Math.max(1, height - 8)}
            fill="black"
          />
        ))}
      </svg>
      {showText ? <span className="font-mono text-xs tracking-normal text-ink">{value}</span> : null}
    </div>
  );
}
