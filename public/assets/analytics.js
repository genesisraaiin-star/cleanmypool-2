/* CleanMyPool GA4. Keep customer form contents out of Analytics. */
(function () {
  'use strict';
  if (window.CleanMyPoolAnalytics) return;

  const measurementId = 'G-HJ7NDM6PN9';
  const storageKey = 'cmp_attribution_v1';
  const campaignKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid'];
  const allowedEvents = new Set(['signup_start', 'contact_start', 'generate_lead', 'contact_submit', 'phone_click']);

  function campaignParams(url) {
    const result = {};
    campaignKeys.forEach(function (key) {
      const value = url.searchParams.get(key);
      // Campaign labels must never contain customer information.
      if (value && value.length <= 300 && !/[@\r\n<>]/.test(value)) result[key] = value;
    });
    return result;
  }

  function cleanUrl(value, keepCampaign) {
    try {
      const url = new URL(value);
      if (!['https:', 'http:'].includes(url.protocol)) return '';
      const clean = new URL(url.origin + url.pathname);
      if (keepCampaign) {
        Object.entries(campaignParams(url)).forEach(function ([key, val]) { clean.searchParams.set(key, val); });
      }
      return clean.href;
    } catch (_) { return ''; }
  }

  const pageLocation = cleanUrl(window.location.href, true);
  const pageReferrer = cleanUrl(document.referrer, false);
  const currentCampaign = campaignParams(new URL(window.location.href));
  let attribution;
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(storageKey));
    // Do not carry attribution indefinitely in a tab left open for days.
    if (saved && Date.now() - saved.savedAt >= 0 && Date.now() - saved.savedAt < 86400000) {
      attribution = {
        savedAt: saved.savedAt,
        landing: cleanUrl(saved.landing, false),
        referrer: cleanUrl(saved.referrer, false),
        campaign: campaignParams(new URL(saved.taggedUrl))
      };
    }
  } catch (_) { /* Storage may be unavailable; the current visit still works. */ }

  if (Object.keys(currentCampaign).length || !attribution) {
    attribution = { savedAt: Date.now(), landing: cleanUrl(window.location.href, false), referrer: pageReferrer, campaign: currentCampaign };
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify({ ...attribution, taggedUrl: pageLocation }));
    } catch (_) { /* Never block a request because storage is unavailable. */ }
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  function track(name, params) {
    if (!allowedEvents.has(name)) return;
    const safeParams = { send_to: measurementId, page_location: pageLocation, page_referrer: pageReferrer };
    if (params && ['signup-form', 'contact-form'].includes(params.form_id)) safeParams.form_id = params.form_id;
    try { window.gtag('event', name, safeParams); } catch (_) { /* Analytics cannot interrupt delivery or calls. */ }
  }

  window.CleanMyPoolAnalytics = {
    track: track,
    attributionText: function () {
      const campaign = Object.entries(attribution.campaign).map(function ([key, value]) { return key + ': ' + value; });
      return [
        'Visit details (latest tagged visit in this tab; retained up to 24 hours):',
        'Captured: ' + new Date(attribution.savedAt).toISOString(),
        'Landing page: ' + attribution.landing,
        'Referrer: ' + (attribution.referrer || 'Unavailable / direct'),
        ...(campaign.length ? campaign : ['Campaign: Unattributed (no campaign parameters captured)'])
      ].join('\n');
    }
  };

  // One config call sends one initial page_view; do not add a second inline tag.
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { page_location: pageLocation, page_referrer: pageReferrer });
  const tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
  document.head.appendChild(tag);

  document.addEventListener('click', function (event) {
    const link = event.target.closest ? event.target.closest('a[href]') : null;
    if (link && /^tel:/i.test(link.getAttribute('href') || '')) track('phone_click');
  });
})();
