import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = () => readFileSync(new URL('../public/assets/lead-forms.js', import.meta.url), 'utf8');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function fixture({ formId = 'signup-form', valid = true, send, analytics = 'normal', missingSDK = false } = {}) {
  const calls = [];
  const events = [];
  const listeners = new Map();
  const button = { disabled: false, textContent: 'Send', innerHTML: 'Send', style: {} };
  const status = { textContent: '', style: {}, setAttribute() {}, removeAttribute() {} };
  const values = {
    fn: 'TestFirst', ln: 'TestLast', em: 'test-customer@example.com', ph: '8135550100',
    addr: '123 Test Street', plan: 'Screened + Salt ($165/mo)', pt: 'Pool Only',
    'c-name': 'TestFirst TestLast', 'c-email': 'test-customer@example.com',
    'c-phone': '8135550100', 'c-subject': 'New Service Inquiry',
    'c-message': 'Please contact me about service.',
  };
  const fields = Object.fromEntries(Object.entries(values).map(([id, value]) => [id, { id, value }]));
  const attributes = new Map();
  const form = {
    id: formId, style: {}, dataset: {}, resetCount: 0,
    reportValidity() { return valid; },
    checkValidity() { return valid; },
    querySelector(selector) {
      if (selector.startsWith('#')) return fields[selector.slice(1)] || null;
      return /button|btn-submit/.test(selector) ? button : null;
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    setAttribute(name, value) { attributes.set(name, value); },
    removeAttribute(name) { attributes.delete(name); },
    reset() { this.resetCount += 1; },
  };
  const success = { style: { display: 'none' } };
  const document = {
    readyState: 'complete',
    getElementById(id) {
      if (id === formId) return form;
      if (id === 'signup-status' || id === 'contact-status') return status;
      if (id === 'success-msg') return success;
      return fields[id] || null;
    },
    querySelector(selector) {
      if (selector === '#' + formId) return form;
      return selector.startsWith('#') ? this.getElementById(selector.slice(1)) : null;
    },
    querySelectorAll(selector) {
      return selector.includes('form') ? [form] : [];
    },
    addEventListener(type, callback) {
      if (type === 'DOMContentLoaded') callback();
    },
  };
  const context = {
    document,
    console: { error() {}, warn() {}, log() {} },
    setTimeout, clearTimeout,
    location: { origin: 'https://www.cleanmypool.pro', pathname: '/', search: '', href: 'https://www.cleanmypool.pro/' },
  };
  if (!missingSDK) {
    context.emailjs = {
      send(...args) {
        calls.push(args);
        return send ? send(...args) : Promise.resolve({ status: 200, text: 'OK' });
      },
    };
  }
  if (analytics !== 'absent') {
    context.CleanMyPoolAnalytics = {
      track(name, params) {
        if (analytics === 'throw-track') throw new Error('Analytics blocked');
        events.push({ name, params });
      },
      attributionText() {
        if (analytics === 'throw-attribution') throw new Error('Storage unavailable');
        return 'Source: test';
      },
    };
  }
  context.window = context;
  vm.runInNewContext(source(), context, { filename: 'lead-forms.js' });

  function submit() {
    let prevented = false;
    const event = { preventDefault() { prevented = true; }, target: form, currentTarget: form };
    const handlers = listeners.get('submit') || [];
    assert.ok(handlers.length, 'The public form must have a submission handler');
    const work = handlers.map(handler => handler.call(form, event));
    assert.equal(prevented, true, 'The custom form must prevent native submission');
    return Promise.all(work);
  }
  return { submit, calls, events, form, button, status, context, values };
}

test('invalid signup sends neither notification nor conversion', async () => {
  const f = fixture({ valid: false });
  await f.submit();
  assert.equal(f.calls.length, 0);
  assert.equal(f.events.length, 0);
  assert.equal(f.button.disabled, false);
});

test('a pending signup ignores repeat submits and emits one accepted lead', async () => {
  const request = deferred();
  const f = fixture({ send: () => request.promise });
  const first = f.submit();
  await f.submit();
  assert.equal(f.calls.length, 1);
  assert.equal(f.events.length, 0, 'A pending send is not yet a lead');
  request.resolve({ status: 200, text: 'OK' });
  await first;
  assert.equal(f.events.filter(event => event.name === 'generate_lead').length, 1);
  await f.submit();
  assert.equal(f.calls.length, 1, 'A completed form does not resend');
});

test('a rejected send is retryable and only the successful retry is a lead', async () => {
  let attempt = 0;
  const f = fixture({ send: () => ++attempt === 1 ? Promise.reject(new Error('Temporary error')) : Promise.resolve({ status: 200 }) });
  await f.submit();
  assert.equal(f.events.length, 0);
  assert.equal(f.button.disabled, false);
  await f.submit();
  assert.equal(f.calls.length, 2);
  assert.equal(f.events.filter(event => event.name === 'generate_lead').length, 1);
});

test('a synchronous SDK error restores a retryable form', async () => {
  const f = fixture({ send() { throw new Error('SDK error'); } });
  await f.submit();
  assert.equal(f.events.length, 0);
  assert.equal(f.button.disabled, false);
});

test('a missing SDK fails without recording a lead and can recover', async () => {
  const f = fixture({ missingSDK: true });
  await f.submit();
  assert.equal(f.events.length, 0);
  assert.equal(f.button.disabled, false);
  let recoveredSends = 0;
  f.context.emailjs = { send: async () => { recoveredSends += 1; return { status: 200 }; } };
  await f.submit();
  assert.equal(recoveredSends, 1);
  assert.equal(f.events.filter(event => event.name === 'generate_lead').length, 1);
});

for (const analytics of ['absent', 'throw-track', 'throw-attribution']) {
  test(`${analytics} analytics cannot turn an accepted signup into a resend`, async () => {
    const f = fixture({ analytics });
    await f.submit();
    assert.equal(f.calls.length, 1, 'Notification delivery still runs');
    assert.equal(f.form.resetCount, 1, 'Successful signup still completes');
    await f.submit();
    assert.equal(f.calls.length, 1, 'A tracking problem cannot enable a duplicate send');
  });
}

test('accepted contact messages have their own event, not the signup lead goal', async () => {
  const f = fixture({ formId: 'contact-form' });
  await f.submit();
  assert.equal(f.calls.length, 1);
  assert.equal(f.events.filter(event => event.name === 'contact_submit').length, 1);
  assert.equal(f.events.filter(event => event.name === 'generate_lead').length, 0);
});

test('analytics parameters omit customer details supplied to signup', async () => {
  const f = fixture();
  await f.submit();
  const analyticsPayload = JSON.stringify(f.events);
  for (const id of ['fn', 'ln', 'em', 'ph', 'addr']) {
    assert.equal(analyticsPayload.includes(f.values[id]), false, `${id} must remain out of Analytics`);
  }
  assert.equal(f.events.filter(event => event.name === 'generate_lead').length, 1);
});
