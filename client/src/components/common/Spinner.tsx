/** Loading indicator. `page` centres it in the viewport for full-page loads. */
export default function Spinner({ page = false }) {
  const spinner = <div className="spinner" role="status" aria-label="Loading" />;
  return page ? <div className="grid min-h-screen place-items-center p-4">{spinner}</div> : spinner;
}
