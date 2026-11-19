import { Children, type ReactNode, useLayoutEffect, useRef } from 'react';

const GAP = 16;

/**
 * Balanced masonry with flush column bottoms and no dead space.
 *
 * Layout (all imperative, so React never remounts the cards):
 *  1. Measure every card at its natural height (any previous fill removed).
 *  2. Walk the cards in question order, putting each in the shortest column,
 *     so reading order stays roughly left-to-right, top-to-bottom.
 *  3. Each shorter column gives its spare height to the card best able to use
 *     it: a text-answer card (it reveals more answers) if the column has one,
 *     otherwise its last card. That card gets a fixed height, so expanded
 *     content scrolls inside it and can never overlap the card below.
 *
 * DOM order is untouched, so screen readers and Tab still follow question order.
 */
interface MasonryProps {
  children: ReactNode;
  minColumn?: number;
  className?: string;
}

export default function Masonry({ children, minColumn = 464, className = '' }: MasonryProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid) return undefined;
    let frame = 0;

    const layout = () => {
      const items = [...grid.children] as HTMLElement[];
      const width = grid.clientWidth;
      const cols = Math.max(1, Math.floor((width + GAP) / (minColumn + GAP)));
      const colW = (width - GAP * (cols - 1)) / cols;

      // 1. natural heights
      for (const it of items) {
        it.classList.remove('fill');
        it.style.height = '';
        it.style.width = `${colW}px`;
      }
      const heights = items.map((it) => it.offsetHeight);

      // 2. shortest-column placement in order
      const tops: number[] = Array<number>(cols).fill(0);
      const byCol: number[][] = Array.from({ length: cols }, () => []);
      items.forEach((it, i) => {
        const c = tops.indexOf(Math.min(...tops));
        it.style.left = `${c * (colW + GAP)}px`;
        it.style.top = `${tops[c] ?? 0}px`;
        byCol[c]?.push(i);
        tops[c] = (tops[c] ?? 0) + (heights[i] ?? 0) + GAP;
      });
      const total = Math.max(...tops) - GAP;

      // 3. fill shorter columns
      if (cols > 1) {
        byCol.forEach((list, c) => {
          const spare = total - ((tops[c] ?? 0) - GAP);
          if (spare < 1 || !list.length) return;
          const grower = [...list].reverse().find((i) => items[i]?.querySelector('.text-result')) ?? list[list.length - 1]!;
          const g = items[grower]!;
          g.classList.add('fill');
          g.style.height = `${(heights[grower] ?? 0) + spare}px`;
          // shift the cards below the grower down by the spare height
          for (const i of list.slice(list.indexOf(grower) + 1)) {
            const el = items[i]!;
            el.style.top = `${parseFloat(el.style.top) + spare}px`;
          }
        });
      }
      grid.style.height = `${Math.max(total, 0)}px`;
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(grid);
    // Watch each card's content (not the stretched wrapper) for real size changes.
    for (const it of grid.children) if (it.firstElementChild) ro.observe(it.firstElementChild);
    layout();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  });

  return (
    <div ref={ref} className={`relative ${className}`}>
      {Children.map(children, (child) =>
        child ? (
          <div className="masonry-item absolute top-0 left-0 w-full min-w-0 [&.fill]:flex [&.fill]:flex-col [&.fill>.card]:flex [&.fill>.card]:flex-1 [&.fill>.card]:flex-col">
            {child}
          </div>
        ) : null,
      )}
    </div>
  );
}
