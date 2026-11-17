const shortDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
export const dateLabel = (day: string) => shortDate.format(new Date(`${day}T12:00:00`));
export const decimal = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
export const scoreLabel = (value: number | null | undefined) =>
  value == null ? "—" : `${decimal.format(value)}%`;

type Point = { day: string; value: number | null };

export function TrendChart({ points, kind }: { points: Point[]; kind: "approvals" | "score" }) {
  const line = kind === "score";
  const max = line ? 100 : Math.max(1, ...points.map((p) => p.value ?? 0));
  const width = 488,
    top = 12,
    height = 102,
    bottom = top + height;
  const step = width / points.length;
  const x = (i: number) => 24 + step * (i + 0.5);
  const y = (v: number) => bottom - (v / max) * height;
  const path = points
    .map((p, i) =>
      p.value === null
        ? ""
        : `${i === 0 || points[i - 1].value === null ? "M" : "L"} ${x(i)} ${y(p.value)}`,
    )
    .join(" ");
  return (
    <div className="mt-4">
      <svg viewBox="0 0 520 124" className="w-full" aria-hidden="true">
        {[top, bottom].map((at) => (
          <line key={at} x1="24" x2="512" y1={at} y2={at} stroke="#e5e5e5" />
        ))}
        <text x="1" y={top + 3} fontSize="10" fill="#666">
          {max}
        </text>
        <text x="1" y={bottom + 3} fontSize="10" fill="#666">
          0
        </text>
        {line && <path d={path} fill="none" stroke="#7024d4" strokeWidth="2" />}
        {points.map(({ day, value }, i) => {
          if (value === null) return null;
          const title = `${dateLabel(day)}: ${line ? scoreLabel(value) : value}`;
          return line ? (
            <circle
              key={day}
              cx={x(i)}
              cy={y(value)}
              r={points.length > 30 ? 1.8 : 3}
              fill="#7024d4"
            >
              <title>{title}</title>
            </circle>
          ) : (
            <rect
              key={day}
              x={x(i) - step * 0.34}
              y={value ? y(value) : bottom - 1.5}
              width={step * 0.68}
              height={value ? bottom - y(value) : 1.5}
              rx="1.5"
              fill={value ? "#76bfeb" : "#a3a3a3"}
            >
              <title>{title}</title>
            </rect>
          );
        })}
      </svg>
      <div className="flex justify-between pl-5 text-xs text-neutral-500">
        <span>{dateLabel(points[0].day)}</span>
        <span>{dateLabel(points[points.length - 1].day)}</span>
      </div>
    </div>
  );
}
