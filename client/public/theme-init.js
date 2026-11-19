// Apply the saved theme before first paint so there is no light flash.
// A file (not an inline <script>) so the Content-Security-Policy can forbid inline scripts.
try {
  const t = localStorage.getItem('geekforms.theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch {
  /* storage blocked: fall back to the system theme */
}
