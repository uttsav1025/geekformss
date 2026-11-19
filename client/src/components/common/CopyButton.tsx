import { type ReactNode, useState } from 'react';
import { Check, Copy } from 'lucide-react';

/**
 * Copies text to the clipboard. With `icon`, renders as a square icon button
 * (label becomes the accessible name); otherwise a small text button.
 */
export default function CopyButton({ text, label = 'Copy', icon }: { text: string; label?: string; icon?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = Object.assign(document.createElement('textarea'), { value: text });
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  if (icon) {
    return (
      <button
        type="button"
        className={`icon-btn ${copied ? 'text-accent' : ''}`}
        onClick={copy}
        aria-label={copied ? 'Copied' : label}
        title={copied ? 'Copied' : 'Copy link'}
      >
        {copied ? <Check size={16} strokeWidth={1.5} /> : icon}
      </button>
    );
  }
  return (
    <button type="button" className="btn btn-sm" onClick={copy}>
      {copied ? (
        <Check size={16} strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <Copy size={16} strokeWidth={1.5} aria-hidden="true" />
      )}
      {copied ? 'Copied' : label}
    </button>
  );
}
