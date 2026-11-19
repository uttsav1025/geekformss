/** Centred card for "nothing here yet" states. */
import type { ReactNode } from 'react';

export default function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card px-6 py-12 text-center">
      <h2 className="mb-2">{title}</h2>
      <p className="text-fg-2">{children}</p>
    </div>
  );
}
