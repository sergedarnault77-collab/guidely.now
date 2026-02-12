interface AreaChartProps {
  datasets: {
    data: number[];
    color: string;
    fillColor: string;
    label: string;
  }[];
  labels: string[];
  height?: number;
  className?: string;
}

export function AreaChart({ datasets, labels, height = 200, className = "" }: AreaChartProps) {
  if (labels.length === 0) return null;

  const allValues = datasets.flatMap((d) => d.data);
  const max = Math.max(...allValues, 100);
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const width = 600;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const getX = (i: number) => padding.left + (i / Math.max(labels.length - 1, 1)) * chartWidth;
  const getY = (val: number) => padding.top + chartHeight - (val / max) * chartHeight;

  // Grid lines
  const gridLines = [0, 25, 50, 75, 100].map((val) => ({
    y: getY(val),
    label: `${val}%`,
  }));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`w-full ${className}`} preserveAspectRatio="xMidYMid meet">
      {/* Grid */}
      {gridLines.map((line, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            y1={line.y}
            x2={width - padding.right}
            y2={line.y}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeDasharray="4 4"
          />
          <text
            x={padding.left - 8}
            y={line.y + 4}
            textAnchor="end"
            fill="currentColor"
            fillOpacity={0.4}
            fontSize="10"
          >
            {line.label}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {labels.map((label, i) => {
        const showLabel = labels.length <= 12 || i % Math.ceil(labels.length / 12) === 0;
        if (!showLabel) return null;
        return (
          <text
            key={i}
            x={getX(i)}
            y={height - 5}
            textAnchor="middle"
            fill="currentColor"
            fillOpacity={0.4}
            fontSize="10"
          >
            {label}
          </text>
        );
      })}

      {/* Datasets */}
      {datasets.map((dataset, di) => {
        const points = dataset.data.map((val, i) => `${getX(i)},${getY(val)}`);
        const fillPoints = [
          `${getX(0)},${getY(0)}`,
          ...points,
          `${getX(dataset.data.length - 1)},${getY(0)}`,
        ].join(" ");

        return (
          <g key={di}>
            <polygon points={fillPoints} fill={dataset.fillColor} />
            <polyline
              points={points.join(" ")}
              fill="none"
              stroke={dataset.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Dots */}
            {dataset.data.map((val, i) => (
              <circle
                key={i}
                cx={getX(i)}
                cy={getY(val)}
                r="3"
                fill={dataset.color}
                className="opacity-0 hover:opacity-100 transition-opacity"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
