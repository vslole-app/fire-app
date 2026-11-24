// Optional analytics; off by default. Never send app account IDs or reading data.
export function createGlobeAnalytics({ app, sdk, measurementId }) {
  const key = "vslove-analytics-consent-v1";
  const available = /^G-[A-Z0-9]+$/.test(measurementId || "");
  let consent = false;
  try { consent = available && localStorage.getItem(key) === "yes"; } catch (_) {}
  let client = null;
  let initializing = null;
  const deniedAds = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
  const start = () => {
    if (!consent || !available) return Promise.resolve(null);
    if (client) return Promise.resolve(client);
    if (!initializing) initializing = (async () => {
      const api = await import(sdk + "firebase-analytics.js");
      if (!consent || !await api.isSupported() || !consent) return null;
      const analytics = api.initializeAnalytics(app, { config: {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: location.origin + location.pathname,
        page_referrer: "",
        page_title: "В Слове"
      } });
      api.setConsent({ ...deniedAds, analytics_storage: consent ? "granted" : "denied" });
      api.setAnalyticsCollectionEnabled(analytics, consent);
      client = { api, analytics };
      return client;
    })().catch(() => null).finally(() => { initializing = null; });
    return initializing;
  };
  function setConsent(value) {
    consent = available && value === true;
    try { localStorage.setItem(key, consent ? "yes" : "no"); } catch (_) {}
    if (client) {
      const { api, analytics } = client;
      api.setAnalyticsCollectionEnabled(analytics, consent);
      api.setConsent({ ...deniedAds, analytics_storage: consent ? "granted" : "denied" });
    } else if (consent) void start();
  }
  function recordOpen() {
    if (!consent) return;
    void start().then((c) => {
      if (!c || !consent) return;
      c.api.logEvent(c.analytics, "readers_globe_open");
    }).catch(() => {});
  }
  return { available, enabled: () => consent, setConsent, recordOpen };
}
