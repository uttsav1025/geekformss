import InkTick from './InkTick';

/** Wordmark: the ink tick plus the product name. No tile, no gradient. */
export default function Logo({ size = 20, withName = false, nameClassName = '' }) {
  return (
    <span className="inline-flex items-center gap-2">
      <InkTick size={size} strokeWidth={2.8} />
      {withName && <span className={`text-[17px] font-semibold tracking-[-0.005em] text-fg ${nameClassName}`}>GeekForms</span>}
    </span>
  );
}
