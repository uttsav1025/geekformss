import { type MouseEvent, type ReactNode, useCallback, useState } from 'react';

export interface Tooltip {
  show: (e: MouseEvent<HTMLElement>, content: ReactNode) => void;
  hide: () => void;
  node: ReactNode;
}

/**
 * One floating tooltip shared by every chart on a page.
 * show(event, content) anchors it above the hovered element; render `node` once.
 */
export function useTooltip(): Tooltip {
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null);
  const show = useCallback((e: MouseEvent<HTMLElement>, content: ReactNode) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.top, content });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  const node = tip && (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
      {tip.content}
    </div>
  );
  return { show, hide, node };
}
