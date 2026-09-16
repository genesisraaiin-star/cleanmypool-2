/* Delivery is independent of Analytics; only accepted requests emit success events. */
(function () {
  'use strict';
  if (window.__cmpLeadFormsBound) return;
  window.__cmpLeadFormsBound = true;

  function value(id) { return document.getElementById(id).value.trim(); }

  function track(name, formId) {
    try { window.CleanMyPoolAnalytics?.track(name, { form_id: formId }); } catch (_) { /* Optional telemetry. */ }
  }

  function attributionText() {
    try { return window.CleanMyPoolAnalytics?.attributionText() || 'Campaign: Unattributed (tracking unavailable)'; }
    catch (_) { return 'Campaign: Unattributed (tracking unavailable)'; }
  }

  function bind(formId, statusId, buildParams, successEvent, startEvent) {
    const form = document.getElementById(formId);
    if (!form) return;
    const button = form.querySelector('.btn-submit');
    const status = document.getElementById(statusId);
    let pending = false;
    let completed = false;
    let started = false;
    button.disabled = false;

    form.addEventListener('focusin', function () {
      if (!started) { started = true; track(startEvent, formId); }
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (pending || completed || !form.reportValidity()) return;
      pending = true;
      button.disabled = true;
      button.textContent = 'Sending…';
      form.setAttribute('aria-busy', 'true');
      if (status) status.textContent = '';

      try {
        const params = buildParams();
        params.message += '\n\n' + attributionText();
        if (!window.emailjs || typeof window.emailjs.send !== 'function') throw new Error('Email service unavailable');
        await window.emailjs.send('service_jpg744s', 'template_kgq0lzo', params, { publicKey: '8AZcPyaE3LqYBe1o6' });
      } catch (_) {
        pending = false;
        form.removeAttribute('aria-busy');
        button.disabled = false;
        button.textContent = 'Try again →';
        if (status) status.textContent = 'We couldn’t send your request. Please try again or call (813) 575-3535.';
        return;
      }

      // Once EmailJS accepts a send, a tracking error must never invite a duplicate request.
      completed = true;
      pending = false;
      form.removeAttribute('aria-busy');
      button.textContent = '✓ Received — we’ll be in touch!';
      if (status) status.textContent = 'Thank you. We’ll contact you within one business day.';
      track(successEvent, formId);
      form.reset();
      if (formId === 'contact-form') {
        form.style.display = 'none';
        const success = document.getElementById('success-msg');
        if (success) success.style.display = 'block';
      }
    });
  }

  bind('signup-form', 'signup-status', function () {
    return {
      name: value('fn') + ' ' + value('ln'),
      email: value('em'),
      phone: value('ph'),
      address: value('addr'),
      plan: value('plan'),
      service: value('pt'),
      message: 'Plan: ' + value('plan') + ' | Pool Type: ' + value('pt') + ' | Address: ' + value('addr') + ' | Phone: ' + value('ph'),
      title: 'New CleanMyPool Signup'
    };
  }, 'generate_lead', 'signup_start');

  bind('contact-form', 'contact-status', function () {
    return {
      name: value('c-name'),
      email: value('c-email'),
      phone: value('c-phone'),
      address: '',
      plan: '',
      service: value('c-subject'),
      message: 'Subject: ' + value('c-subject') + '\n' + value('c-message') + '\nPhone: ' + value('c-phone'),
      title: 'CleanMyPool Contact Request'
    };
  }, 'contact_submit', 'contact_start');
})();
