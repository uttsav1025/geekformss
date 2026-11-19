import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { fmtDate } from '../../lib/format';
import type { DayCount } from '../../types/api';

type Point = [number, number];

/** Pad a sparse [{day:'YYYY-MM-DD', count}] list to one entry per UTC day, ending today. */
export function fillDays(points: DayCount[], days = 30): DayCount[] {
  const byDay = new Map(points.map((p) => [p.day, p.count]));
  const out: DayCount[] = [];
  const today = new Date();
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(end - i * 86400000).toISOString().slice(0, 10);
    out.push({ day: key, count: byDay.get(key) ?? 0 });
  }
  return out;
}

/** Smooth path through points (Catmull-Rom converted to cubic Béziers), clamped to the baseline. */
function smoothPath(pts: Point[], floor: number): string {
  const first = pts[0];
  if (pts.length < 2 || !first) return '';
  let d = `M${first[0]},${first[1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p0 = pts[i - 1] ?? p1;
    const p3 = pts[i + 2] ?? p2;
    const t = 0.18;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, Math.min(floor, p1[1] + (p2[1] - p0[1]) * t)];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, Math.min(floor, p2[1] - (p3[1] - p1[1]) * t)];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

const niceMax = (n: number): number => {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  return [1, 2, 2.5, 5, 10].map((s) => s * pow).find((v) => v >= n) ?? n;
};

/**
 * Single-series daily line chart: muted grid, mono labels, crosshair tooltip.
 * One accent, because there is one series.
 */
interface LineChartProps {
  data: DayCount[];
  height?: number;
  label?: string;
}

export default function LineChart({ data, height = 200, label = 'Responses per day' }: LineChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(entry.contentRect.width, 240));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { top: 12, right: 8, bottom: 28, left: 32 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.map((d) => d.count), 0));
  const ticks = [0, max / 2, max];

  const pts = useMemo(
    () =>
      data.map((d, i): Point => [
        pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
        pad.top + innerH - (d.count / max) * innerH,
      ]),
    [data, innerW, innerH, max, pad.left, pad.top],
  );
  const baseline = pad.top + innerH;
  const line = smoothPath(pts, baseline);
  const lastPt = pts[pts.length - 1];
  const firstPt = pts[0];
  const area = line && lastPt && firstPt ? `${line} L${lastPt[0]},${baseline} L${firstPt[0]},${baseline} Z` : '';

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const i = Math.round(((x - pad.left) / innerW) * (data.length - 1));
    setHover(Math.min(Math.max(i, 0), data.length - 1));
  };

  const xLabels = [0, Math.floor((data.length - 1) / 2), data.length - 1];
  const hp = hover != null ? pts[hover] : undefined;
  const hd = hover != null ? data[hover] : undefined;
  const h = hp && hd ? { p: hp, d: hd } : null;

  return (
    <div className="relative w-full" ref={wrapRef}>
      <svg
        className="block overflow-visible"
        width={width}
        height={height}
        role="img"
        aria-label={label}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => {
          const y = pad.top + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="stroke-line" strokeWidth={1} />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" className="fill-muted font-mono text-[11px]">
                {t}
              </text>
            </g>
          );
        })}
        {xLabels.map((i) => (
          <text
            key={i}
            x={pts[i]?.[0] ?? 0}
            y={height - 8}
            textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
            className="fill-muted font-mono text-[11px]"
          >
            {i === data.length - 1 ? 'Today' : fmtDate(`${data[i]?.day ?? ''}T12:00:00Z`).replace(/, \d{4}$/, '')}
          </text>
        ))}
        <path d={area} className="fill-series opacity-[0.08]" />
        <path d={line} className="fill-none stroke-series" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {h && (
          <g>
            <line x1={h.p[0]} x2={h.p[0]} y1={pad.top} y2={baseline} className="stroke-line-strong" strokeWidth={1} />
            <circle cx={h.p[0]} cy={h.p[1]} r={4.5} className="fill-series stroke-surface" strokeWidth={2} />
          </g>
        )}
        <rect x={pad.left} y={pad.top} width={innerW} height={innerH} fill="transparent" />
      </svg>
      {h && (
        <div
          className="chart-tip absolute"
          style={{ left: Math.min(Math.max(h.p[0], 64), width - 64), top: h.p[1] }}
          role="tooltip"
        >
          <strong>{h.d.count}</strong> {h.d.count === 1 ? 'response' : 'responses'}
          <span className="block font-mono text-xs text-muted">{fmtDate(`${h.d.day}T12:00:00Z`)}</span>
        </div>
      )}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.day}>
                <td>{d.day}</td>
                <td>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
