interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
  height?: number;
  className?: string;
}

export function BarChart({ data, maxValue, height = 200, className = "" }: BarChartProps) {
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={`flex items-end gap-1.5 ${className}`} style={{ height }}>
      {data.map((item, i) => {
        const barHeight = (item.value / max) * 100;
        return (
          <div key={i} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end group">
            <div className="relative w-full flex justify-center mb-1">
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 whitespace-nowrap">
                {item.value}%
              </span>
            </div>
            <div
              className="w-full rounded-t-sm transition-all duration-500 ease-out min-h-[2px]"
              style={{
                height: `${barHeight}%`,
                backgroundColor: item.color || "#22c55e",
              }}
            />
            <span className="text-[9px] text-muted-foreground mt-1 truncate w-full text-center">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
