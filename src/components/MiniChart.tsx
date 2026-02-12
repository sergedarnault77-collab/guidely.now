interface MiniChartProps {
  data: number[];
  height?: number;
  color?: string;
  fillColor?: string;
  className?: string;
}

export function MiniChart({
  data,
  height = 80,
  color = "#22c55e",
  fillColor = "rgba(34,197,94,0.15)",
  className = "",
}: MiniChartProps) {
  if (data.length === 0) return null;

  const max = Math.max(...data, 1);
  const width = 100;
  const padding = 2;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const points = data.map((val, i) => {
    const x = padding + (i / Math.max(data.length - 1, 1)) * usableWidth;
    const y = padding + usableHeight - (val / max) * usableHeight;
    return `${x},${y}`;
  });

  const fillPoints = [
    `${padding},${padding + usableHeight}`,
    ...points,
    `${padding + usableWidth},${padding + usableHeight}`,
  ].join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`w-full ${className}`}
      style={{ height }}
      preserveAspectRatio="none"
    >
      <polygon points={fillPoints} fill={fillColor} />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
