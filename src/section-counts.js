// Aggregate daily opens only. No visitor ID, cookies, reading data or external analytics.
export function createSectionCounts({ write, now = () => new Date(), online = () => navigator.onLine !== false }) {
  let signedIn = false, currentPage = null, pathSeen = false;
  const sections = ["home","globe","library","path","schedule","friends"];
  function count(section) {
    if (!signedIn || !online() || !sections.includes(section)) return;
    const day = now().toISOString().slice(0,10);
    try { Promise.resolve(write(day,section)).catch(() => {}); } catch (_) {}
  }
  function page(value) {
    if (currentPage === value) return;
    currentPage = value;
    pathSeen = false;
    const section = {home:"home",awards:"library",plan:"schedule",friends:"friends"}[value];
    if (section) count(section);
  }
  function pathVisible(value) {
    if (!value) { pathSeen = false; return; }
    if (!signedIn || currentPage !== "home" || pathSeen) return;
    pathSeen = true;
    count("path");
  }
  function setSignedIn(value, visiblePage) {
    if (!value) { signedIn = false; currentPage = null; pathSeen = false; return; }
    if (!signedIn) { signedIn = true; currentPage = null; pathSeen = false; page(visiblePage); }
  }
  return { page, setSignedIn, pathVisible, globe: () => count("globe") };
}

// "Путь" is an inline card, not a tab. Count a view when it has occupied
// at least 35% of the smaller of its height and the usable viewport for 1 second.
export function watchPathCard({ counts, card, isSignedIn, isGlobeOpen }) {
  if (!card) return () => {};
  let timer = null, viewed = false;
  const isVisible = () => {
    if (!isSignedIn() || document.hidden || document.body.dataset.page !== "home"
      || isGlobeOpen() || document.querySelector(".fmodal:not([hidden])")) return false;
    if (!card.getClientRects().length) return false;
    const r = card.getBoundingClientRect();
    const nav = document.getElementById("botNav");
    const bottom = Math.min(window.innerHeight, nav && nav.getClientRects().length ? nav.getBoundingClientRect().top : window.innerHeight);
    const height = Math.min(r.bottom, bottom) - Math.max(r.top, 0);
    return r.height > 0 && bottom > 0 && height >= 0.35 * Math.min(r.height, bottom);
  };
  const refresh = () => {
    if (!isVisible()) {
      if (timer !== null) clearTimeout(timer);
      timer = null; viewed = false; counts.pathVisible(false); return;
    }
    if (timer !== null || viewed) return;
    timer = setTimeout(() => {
      timer = null;
      if (!isVisible()) { counts.pathVisible(false); return; }
      viewed = true; counts.pathVisible(true);
    }, 1000);
  };
  window.addEventListener("scroll", refresh, { passive: true });
  window.addEventListener("resize", refresh);
  document.addEventListener("visibilitychange", refresh);
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(refresh, { threshold: [0, .1, .25, .35, .5, .75, 1] });
    observer.observe(card);
  }
  // Overlay and layout changes can occur without a page scroll.
  const observer = new MutationObserver(refresh);
  observer.observe(document.body, { childList: true, attributes: true, attributeFilter: ["data-page"] });
  observer.observe(card, { attributes: true, attributeFilter: ["hidden","class"] });
  return refresh;
}
