// Aggregate daily opens only. No visitor ID, cookies, reading data or external analytics.
export function createSectionCounts({ write, now = () => new Date(), online = () => navigator.onLine !== false }) {
  let signedIn = false, currentPage = null;
  function count(section) {
    if (!signedIn || !online() || !["home","globe","library"].includes(section)) return;
    const day = now().toISOString().slice(0,10);
    try { Promise.resolve(write(day,section)).catch(() => {}); } catch (_) {}
  }
  function page(value) {
    if (currentPage === value) return;
    currentPage = value;
    if (value === "home") count("home");
    if (value === "awards") count("library");
  }
  function setSignedIn(value, visiblePage) {
    if (!value) { signedIn = false; currentPage = null; return; }
    if (!signedIn) { signedIn = true; currentPage = null; page(visiblePage); }
  }
  return { page, setSignedIn, globe: () => count("globe") };
}
