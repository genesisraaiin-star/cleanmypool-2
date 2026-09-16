import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/assets/analytics.js', import.meta.url), 'utf8');

function fixture({ href = 'https://www.cleanmypool.pro/', referrer = '', storage = new Map(), storageBlocked = false } = {}) {
  const scripts = [];
  const listeners = {};
  const context = {
    URL, Date,
    location: { href },
    sessionStorage: {
      getItem(key) { if (storageBlocked) throw new Error('Blocked'); return storage.get(key) || null; },
      setItem(key, value) { if (storageBlocked) throw new Error('Blocked'); storage.set(key, value); }
    },
    document: {
      referrer,
      head: { appendChild(element) { scripts.push(element); } },
      createElement() { return {}; },
      addEventListener(type, callback) { listeners[type] = callback; }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, scripts, listeners, storage, commands: () => context.dataLayer.map(command => Array.from(command)) };
}

test('one tag installation; page views and form-page visits never emit leads', () => {
  const f = fixture({ href: 'https://www.cleanmypool.pro/contact.html' });
  vm.runInContext(source, f.context);
  assert.equal(f.scripts.length, 1);
  assert.equal(f.scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-HJ7NDM6PN9');
  assert.equal(f.commands().filter(c => c[0] === 'config').length, 1);
  assert.equal(f.commands().filter(c => c[0] === 'event').length, 0);
});

test('campaign identifiers survive while customer query fields and referrer queries are removed', () => {
  const f = fixture({ href: 'https://www.cleanmypool.pro/?utm_source=google&utm_medium=cpc&gclid=test-click&email=person%40example.com&name=Jane#private', referrer: 'https://example.com/article?email=private%40example.com#secret' });
  const config = f.commands().find(c => c[0] === 'config')[2];
  assert.equal(new URL(config.page_location).searchParams.get('gclid'), 'test-click');
  assert.equal(config.page_location.includes('email'), false);
  assert.equal(config.page_location.includes('Jane'), false);
  assert.equal(config.page_location.includes('#'), false);
  assert.equal(config.page_referrer, 'https://example.com/article');
  const text = f.context.CleanMyPoolAnalytics.attributionText();
  assert.match(text, /gclid: test-click/);
  assert.equal(text.includes('person'), false);
});

test('last campaign survives internal navigation and a new campaign replaces old click IDs', () => {
  const first = fixture({ href: 'https://www.cleanmypool.pro/areas/pool-cleaning-lutz.html?utm_source=google&gclid=old-click' });
  const second = fixture({ href: 'https://www.cleanmypool.pro/', storage: first.storage });
  assert.match(second.context.CleanMyPoolAnalytics.attributionText(), /gclid: old-click/);
  assert.match(second.context.CleanMyPoolAnalytics.attributionText(), /pool-cleaning-lutz.html/);
  const third = fixture({ href: 'https://www.cleanmypool.pro/?utm_source=newsletter', storage: first.storage });
  const text = third.context.CleanMyPoolAnalytics.attributionText();
  assert.match(text, /utm_source: newsletter/);
  assert.equal(text.includes('old-click'), false);
});

test('expired or unavailable session storage does not break tracking', () => {
  const expired = new Map([['cmp_attribution_v1', JSON.stringify({ savedAt: Date.now() - 86400001, taggedUrl: 'https://www.cleanmypool.pro/?gclid=stale', landing: 'https://www.cleanmypool.pro/', referrer: '' })]]);
  const f = fixture({ storage: expired });
  assert.match(f.context.CleanMyPoolAnalytics.attributionText(), /Unattributed/);
  const blocked = fixture({ storageBlocked: true, href: 'https://www.cleanmypool.pro/?utm_campaign=test' });
  assert.match(blocked.context.CleanMyPoolAnalytics.attributionText(), /utm_campaign: test/);
  assert.equal(blocked.scripts.length, 1);
});

test('event API accepts only known events and approved parameters', () => {
  const f = fixture();
  f.context.CleanMyPoolAnalytics.track('generate_lead', { form_id: 'signup-form', email: 'private@example.com', value: 165, currency: 'USD', name: 'Customer' });
  f.context.CleanMyPoolAnalytics.track('purchase', { value: 165 });
  const events = f.commands().filter(c => c[0] === 'event');
  assert.equal(events.length, 1);
  assert.equal(events[0][1], 'generate_lead');
  assert.equal(events[0][2].send_to, 'G-HJ7NDM6PN9');
  assert.equal(events[0][2].form_id, 'signup-form');
  for (const key of ['email', 'value', 'currency', 'name']) assert.equal(key in events[0][2], false);
});

test('a telephone click records intent, never a completed call or lead', () => {
  const f = fixture();
  f.listeners.click({ target: { closest: () => ({ getAttribute: () => 'tel:+18135753535' }) } });
  const events = f.commands().filter(c => c[0] === 'event');
  assert.equal(events.length, 1);
  assert.equal(events[0][1], 'phone_click');
  assert.equal('phone_number' in events[0][2], false);
});

test('public pages install the shared tag exactly once and form scripts load in order', () => {
  const publicDir = new URL('../public/', import.meta.url);
  const paths = readdirSync(publicDir, { recursive: true }).filter(path => path.endsWith('.html') && !['404.html', 'google6f244d6e319daece.html'].includes(path));
  assert.ok(paths.includes('index.html') && paths.includes('contact.html'));
  for (const path of paths) {
    const html = readFileSync(new URL(path, publicDir), 'utf8');
    assert.equal((html.match(/src="\/assets\/analytics.js"/g) || []).length, 1, path);
    assert.equal(html.includes('G-MPRKMWMEPG'), false, 'Do not send CleanMyPool to FixMyPool');
  }
  for (const path of ['index.html', 'contact.html']) {
    const html = readFileSync(new URL(path, publicDir), 'utf8');
    assert.equal((html.match(/@emailjs\/browser@4/g) || []).length, 1, 'Load EmailJS only once');
    assert.ok(html.indexOf('/assets/analytics.js') < html.indexOf('@emailjs/browser@4'));
    assert.ok(html.indexOf('@emailjs/browser@4') < html.indexOf('/assets/lead-forms.js'));
    assert.match(html, /<form[^>]+method="post"/);
    assert.equal(html.includes("fetch('/api/contact'"), false);
    assert.equal(html.includes('emailjs.send('), false, 'No old inline handler');
  }
});

test('deployment CSP permits the installed GA4 tag and collection endpoints', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)));
  const policy = config.headers[0].headers.find(h => h.key === 'Content-Security-Policy').value;
  const directives = Object.fromEntries(policy.split(';').map(part => part.trim().split(/\s+/)).filter(parts => parts[0]).map(([name, ...origins]) => [name, origins]));
  assert.ok(directives['script-src'].includes('https://www.googletagmanager.com'));
  assert.ok(directives['connect-src'].includes('https://*.google-analytics.com'));
  assert.ok(directives['connect-src'].includes('https://*.analytics.google.com'));
  assert.ok(directives['connect-src'].includes('https://api.emailjs.com'));
  assert.ok(directives['img-src'].includes('https://*.google-analytics.com'));
  assert.deepEqual(directives['form-action'], ["'self'"]);
});
