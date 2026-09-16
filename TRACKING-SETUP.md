# CleanMyPool tracking handoff — September 16, 2026

This package is ready to deploy and verify. It has not been deployed or tested against the live EmailJS inbox, Google Analytics, or Google Ads from this workspace. Keep the **Swimming Pool Cleaning Near You** campaign paused until the checks below pass. Its pause is separate from Local Services Ads and from the FixMyPool repair campaign.

## Installed in this project

| Item | Behavior |
| --- | --- |
| GA4 property | CleanMyPool property named `www.cleanmypool.pro`; measurement ID `G-HJ7NDM6PN9` |
| Base tag | `public/assets/analytics.js`, loaded once on the 12 public content pages, including signup, contact, service areas, and agreement page |
| `generate_lead` | One event after EmailJS accepts a homepage service signup; includes `form_id: signup-form` |
| `signup_start` | First focus inside the signup form per page load; useful for measuring drop-off |
| `phone_click` | A tap/click on a telephone link; indicates intent, not a connected or qualified call |
| `contact_submit` | A successfully accepted general contact message; includes `form_id: contact-form`; separate from new-service signup leads because contact subjects include billing and existing customers |
| `contact_start` | First focus inside the contact form per page load |
| Attribution in email | Available UTM and Google click parameters appended to the existing EmailJS `message` field |
| Delivery safeguards | Native required-field validation, pending/completed submission guards, recoverable failures, and success independent of Analytics availability |
| Contact repair | The original contact form called an API that always returned 404. It now uses the same existing EmailJS service/template as the signup form. |
| Security headers | Existing CSP retained with the GA4 script, collection, and image destinations added |

No purchase or revenue events were added. The homepage request form does not take a payment, and the monthly plan price is not collected revenue. Agreement signing does not produce a second `generate_lead` event. No routine marketing email notifications were added.

Customer-entered names, emails, phone numbers, addresses and messages go to the existing EmailJS template, not our custom GA4 events. Analytics URLs omit arbitrary query parameters and fragments, retaining only supported campaign/click parameters. Never put customer information in UTM labels. The privacy page now describes the added measurement and request delivery.

## Deploy this package

1. Unzip it. Copy the **contents** of `cleanmypool-2-main` into the root of the existing CleanMyPool repository, replacing the matching files. Do not nest that folder inside the repository or upload only the ZIP to GitHub.
2. Commit and deploy through the existing Vercel project for `www.cleanmypool.pro`. Include `vercel.json`, the new `public/assets` scripts and the edited HTML files. The existing API/reviews files and images are included.
3. Do not paste another GA4 snippet or add this property through another tag plugin. This project already installs `G-HJ7NDM6PN9`. Do not use FixMyPool's measurement ID on this site.

No new dependencies or environment variables are needed for this update. EmailJS continues to use the original public browser key, service and signup template. Its remote recipient/template configuration has not been changed or verified. The public key is intended for browser use; private API keys must not be added to these files.

## Verify after deployment

1. On the Google Analytics tag screen, click **Test installation** for `www.cleanmypool.pro`.
2. Open the live website directly, without clicking your own paid ad. Accept any applicable Analytics consent and use a browser without tracking blockers for this test. Check the **CleanMyPool** property's Realtime report or Tag Assistant / DebugView for the page visit.
3. Submit one clearly labeled test signup, using contact details you control. Check the success message and receipt in the business inbox. Confirm that the message contains the correct request details and attribution paragraph. An EmailJS success response alone does not prove inbox delivery.
4. Confirm a single `generate_lead` event in GA4. Opening the form, focusing it or attempting an invalid form must not count as a lead. Do not treat automatic `form_submit` events as proof of successful delivery.
5. Tap the call button and verify the destination is **(813) 575-3535**. GA4 should show `phone_click`. This check does not test connected-call conversion reporting in Google Ads.
6. Test the contact form once with a labeled message. Confirm inbox receipt and `contact_submit`, with no additional `generate_lead`. It reuses the original signup template, so inspect its formatting and recipient.

There is no need to make a payment for this form test. Record the test time and exclude test requests from business performance reviews. You can use a URL such as `https://www.cleanmypool.pro/?utm_source=manual_test&utm_medium=qa&utm_campaign=tracking_check` to check campaign capture; do not invent Google ad click IDs.

If installation passes but the lead event or email does not arrive, resolve that before resuming the cleaning campaign. Full reports can lag; use Realtime/DebugView for the immediate implementation check.

## Finish the Google account settings

These are account changes outside the uploaded project and remain to be verified:

1. Confirm the CleanMyPool GA4 property is linked to the correct Google Ads account, and Google Ads auto-tagging is enabled.
2. Mark **`generate_lead`** as a key event and create/import the matching CleanMyPool Google Ads conversion. Use it as the primary website signup action for the cleaning campaign, with **Count: One**. Ensure this action applies to the intended campaign; do not silently change FixMyPool's goals.
3. Keep `phone_click`, `signup_start`, `contact_start` and general `contact_submit` as observation events. If you import them into Ads, use secondary actions and do not include them in a custom bidding goal. Connected/qualified calls need the appropriate separate call conversion measurement.
4. Review any action the Smart-campaign wizard may have created for `/contact.html` or a homepage view. Visiting a page is not a submitted lead. Do not make such page-view actions the primary signup goal. Do not create a second GA4 rule duplicating the `generate_lead` already sent by this code.
5. Once the live signup, inbox receipt and Analytics event are verified and the correct Ads goal is configured, resume the cleaning campaign at its existing budget. Review early traffic and lead quality before increasing spend.

A direct test can verify the website and GA4 without appearing as an attributed Google Ads conversion. The test had no genuine ad click; do not click your own ad to force a conversion.

## How to interpret attribution

The email includes the latest visit with campaign parameters captured in the same browser tab, retained for up to 24 hours. A new tagged visit replaces older campaign parameters. This helps match requests to campaigns across internal navigation, but does not cover every browser, device, tab or visit.

“Unattributed” means no usable campaign parameters were captured by this helper. It does not prove that the person never interacted with an ad. GA4 and Google Ads use their own attribution, eligibility, consent and reporting rules. A signup accepted after a page reload can be another request; the duplicate guard is per loaded form, not a unique-customer database.

## Verification performed before packaging

Run `npm test` with Node.js 20 or newer. Tests use the actual client scripts with simulated browser elements, storage and EmailJS responses; no emails, payments, ad clicks or live Analytics requests are made. Coverage includes:

- Required-field failure, sending failures and a successful retry.
- Duplicate submits while sending and after acceptance.
- Missing EmailJS, missing/throwing Analytics, and unavailable storage.
- Successful signup versus general contact event separation.
- Exclusion of form contents from Analytics and sanitization of query strings.
- Campaign capture, persistence across navigation, replacement and expiration.
- One tag/SDK installation, script ordering, and required CSP destinations.

These checks verify the code paths, not live inbox delivery, Google collection or Google Ads attribution.

## Official implementation references

- [Google Analytics event reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/events#generate_lead)
- [Google tag Content Security Policy requirements](https://developers.google.com/tag-platform/security/guides/csp)
- [EmailJS send API](https://www.emailjs.com/docs/sdk/send/)
- [Google Ads primary and secondary actions](https://support.google.com/google-ads/answer/11461796?hl=en)
