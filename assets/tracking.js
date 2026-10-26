// Public tracking IDs only. Third-party scripts are never requested before consent.
(async () => {
  if (location.pathname.startsWith('/admin/')) return;
  const patterns = {
    gtmId: /^GTM-[A-Z0-9]{4,20}$/,
    ga4Id: /^G-[A-Z0-9]{4,20}$/,
    metaPixelId: /^[0-9]{5,30}$/,
    tiktokPixelId: /^[A-Z0-9]{8,40}$/,
  };
  let config;
  try {
    const response = await fetch('/tracking-config.json', { cache: 'no-store' });
    if (!response.ok) return;
    const raw = await response.json();
    config = Object.fromEntries(Object.entries(patterns).map(([key, pattern]) => [key, pattern.test(raw[key]) ? raw[key] : '']));
    if (!Object.values(config).some(Boolean)) return;
  } catch { return; }

  const storageKey = 'hudna_tracking_consent_v1';
  let choice = null;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (typeof stored?.analytics === 'boolean' && typeof stored?.marketing === 'boolean') choice = stored;
  } catch { /* Private browsing may block storage. */ }

  window.dataLayer = window.dataLayer || [];
  const gtag = (...args) => window.dataLayer.push(args);
  gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  const updateGoogle = value => gtag('consent', 'update', {
    analytics_storage: value.analytics ? 'granted' : 'denied',
    ad_storage: value.marketing ? 'granted' : 'denied',
    ad_user_data: value.marketing ? 'granted' : 'denied',
    ad_personalization: value.marketing ? 'granted' : 'denied',
  });
  const addScript = src => {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    document.head.append(script);
  };
  const loaded = new Set();
  function loadTags(value) {
    updateGoogle(value);
    if (value.analytics && config.ga4Id && !loaded.has('ga4')) {
      loaded.add('ga4');
      gtag('js', new Date());
      gtag('config', config.ga4Id, { allow_google_signals: false, allow_ad_personalization_signals: false });
      addScript(`https://www.googletagmanager.com/gtag/js?id=${config.ga4Id}`);
    }
    // The marketing tags and GTM run only on the landing page. Article and legal URLs are excluded.
    if (location.pathname !== '/') return;
    if (value.analytics && value.marketing && config.gtmId && !loaded.has('gtm')) {
      loaded.add('gtm');
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      addScript(`https://www.googletagmanager.com/gtm.js?id=${config.gtmId}`);
    }
    if (value.marketing && config.metaPixelId && !loaded.has('meta')) {
      loaded.add('meta');
      const fbq = function (...args) { fbq.callMethod ? fbq.callMethod.apply(fbq, args) : fbq.queue.push(args); };
      fbq.queue = []; fbq.loaded = true; fbq.version = '2.0';
      window.fbq = fbq; window._fbq = fbq;
      fbq('init', config.metaPixelId);
      fbq('track', 'PageView');
      addScript('https://connect.facebook.net/en_US/fbevents.js');
    }
    if (value.marketing && config.tiktokPixelId && !loaded.has('tiktok')) {
      loaded.add('tiktok');
      const ttq = window.ttq = window.ttq || [];
      ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
      ttq.setAndDefer = (target, method) => { target[method] = (...args) => target.push([method, ...args]); };
      for (const method of ttq.methods) ttq.setAndDefer(ttq, method);
      ttq.instance = id => {
        const instance = ttq._i[id] || [];
        for (const method of ttq.methods) ttq.setAndDefer(instance, method);
        return instance;
      };
      ttq.load = (id, options) => {
        const url = 'https://analytics.tiktok.com/i18n/pixel/events.js';
        ttq._i = ttq._i || {}; ttq._i[id] = []; ttq._i[id]._u = url;
        ttq._t = ttq._t || {}; ttq._t[id] = Date.now();
        ttq._o = ttq._o || {}; ttq._o[id] = options || {};
        addScript(`${url}?sdkid=${id}&lib=ttq`);
      };
      ttq.load(config.tiktokPixelId);
      ttq.page();
    }
  }

  const style = document.createElement('style');
  style.textContent = '.hudna-consent-button{position:fixed;bottom:12px;left:12px;z-index:9998;border:1px solid #aecac1;border-radius:999px;background:#fff;color:#153b34;padding:7px 13px;font:600 13px Cairo,system-ui,sans-serif;cursor:pointer}.hudna-consent-panel{position:fixed;bottom:52px;left:12px;right:12px;z-index:9999;max-width:540px;margin-left:auto;background:#fff;color:#17352f;border:1px solid #bdd6ce;border-radius:16px;box-shadow:0 12px 40px #143d3040;padding:18px;direction:rtl;font:15px Cairo,system-ui,sans-serif}.hudna-consent-panel h2{font-size:18px;margin:0 0 8px}.hudna-consent-panel p{margin:0 0 12px;line-height:1.7}.hudna-consent-panel label{display:block;margin:8px 0}.hudna-consent-panel .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.hudna-consent-panel button{border:0;border-radius:9px;padding:8px 12px;background:#e8f2ef;color:#17352f;font:700 13px Cairo,system-ui,sans-serif;cursor:pointer}.hudna-consent-panel button.primary{background:#28776b;color:#fff}';
  style.textContent += '.hudna-consent-panel[hidden]{display:none}';
  document.head.append(style);
  const settings = document.createElement('button');
  settings.className = 'hudna-consent-button';
  settings.type = 'button';
  settings.textContent = 'إعدادات التتبع';
  document.body.append(settings);
  const panel = document.createElement('section');
  panel.className = 'hudna-consent-panel';
  panel.setAttribute('aria-label', 'خيارات التتبع');
  panel.innerHTML = '<h2>خصوصيتك في هُدنة</h2><p>يمكنك السماح بتحليلات الزيارة وأدوات التسويق. لن تعمل الأدوات قبل اختيارك، ويمكنك تغيير قرارك لاحقًا. <a href="/privacy-policy/">سياسة الخصوصية</a></p><label><input type="checkbox" id="hudna-analytics"> السماح بالتحليلات (GA4)</label><label><input type="checkbox" id="hudna-marketing"> السماح بالتسويق (Meta وTikTok)</label><div class="actions"><button type="button" data-choice="reject">رفض غير الضروري</button><button type="button" data-choice="save">حفظ اختياراتي</button><button type="button" class="primary" data-choice="all">الموافقة على الكل</button></div>';
  const analyticsInput = panel.querySelector('#hudna-analytics');
  const marketingInput = panel.querySelector('#hudna-marketing');
  analyticsInput.checked = choice?.analytics || false;
  marketingInput.checked = choice?.marketing || false;
  panel.hidden = Boolean(choice);
  document.body.append(panel);
  settings.addEventListener('click', () => { panel.hidden = !panel.hidden; });
  panel.addEventListener('click', event => {
    const action = event.target.closest('button[data-choice]')?.dataset.choice;
    if (!action) return;
    const next = action === 'all' ? { analytics: true, marketing: true } : action === 'reject' ? { analytics: false, marketing: false } : { analytics: analyticsInput.checked, marketing: marketingInput.checked };
    const revoked = choice && ((choice.analytics && !next.analytics) || (choice.marketing && !next.marketing));
    choice = next;
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Choice lasts for this page only. */ }
    updateGoogle(next);
    panel.hidden = true;
    if (revoked) location.reload();
    else loadTags(next);
  });
  if (choice) loadTags(choice);
})();
