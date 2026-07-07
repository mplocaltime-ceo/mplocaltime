GTM Consent Initialization & Tag Configuration
=================================================

This guide shows how to wire the cookie-consent manager to Google Tag Manager (GTM) using Consent Mode v2.
It covers: default deny, Consent Initialization, updating consent on user choice, and configuring tags (GA4, Ads) to respect consent.

Files in this repo that integrate with GTM:
- `cookie-consent.js` — pushes a `cookie_consent_update` dataLayer event when preferences change.
- `cookie-banner.html` — example init for the consent manager.

1) Default-deny before GTM loads
---------------------------------
You must ensure Google Consent Mode default values are set to "denied" before any measurement scripts run. Do this by adding a small snippet before the GTM `<script>` in your site's `<head>`.

Example (place before GTM snippet):

```html
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  // Set Consent Mode defaults to denied until user makes a choice
  gtag('consent', 'default', {
    'analytics_storage': 'denied',
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied'
  });
</script>
<!-- GTM script goes here -->
```

2) Consent Initialization in GTM (recommended)
----------------------------------------------
GTM supports a "Consent Initialization" phase that runs before regular tags. Use it to set the default consent state if you prefer handling that inside GTM.

Steps:
- In GTM create a new Tag: Tag Type = Custom HTML. Put the `gtag('consent','default', {...})` snippet above.
- Under Tag configuration set Tag firing priority high and set the Trigger to "Consent Initialization" (All Pages) so it fires before other tags.

3) Listen for consent updates from the website
----------------------------------------------
The `cookie-consent.js` pushes a dataLayer event when consent changes:

```js
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  event: 'cookie_consent_update',
  cookie_consent: {
    analytics_storage: 'granted' | 'denied',
    ad_storage: 'granted' | 'denied',
    ad_user_data: 'granted' | 'denied',
    ad_personalization: 'granted' | 'denied'
  }
});
```

Create these GTM objects:
- Data Layer Variable: Name `DL - cookie_consent`, Data Layer Variable Name `cookie_consent`.
- Trigger: Custom Event -> Event name `cookie_consent_update`.

4) Create a Consent Update Tag in GTM
-------------------------------------
When the site updates consent, push the new consent into GTM/gtag via a small Custom HTML tag.

Tag: "Consent Update"
- Tag Type: Custom HTML
- HTML:

```html
<script>
  (function(){
    var consent = {{DL - cookie_consent}};
    try{
      if (typeof gtag === 'function'){
        gtag('consent', 'update', consent);
      } else {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'gtag_consent_update', cookie_consent_update: consent });
      }
    }catch(e){console.error(e)}
  })();
</script>
```

- Trigger: Custom Event `cookie_consent_update` (the event your site pushes).

This tag ensures GTM/gtag updates the Consent Mode state when users change preferences.

5) Configure GA4 and Ads tags to require consent
------------------------------------------------
For each tag that should respect consent (GA4, Google Ads, Floodlight, third-party trackers):

- Open the Tag (example: GA4 Configuration)
- In Tag settings find "Consent Settings" (or the Consent section in GTM)
- Require the appropriate consent types, for example:
  - GA4: require `analytics_storage`
  - Google Ads/Marketing tags: require `ad_storage` and `ad_personalization` as needed

When a tag requires a consent type, GTM will hold that tag until the consent is granted (via the Consent Update tag above).

6) Optional: Fire tags on consent update
----------------------------------------
If you need a tag to run immediately when consent is granted (for example, page view measurement right after consent), create a separate trigger for your tag:

- Trigger: Custom Event -> Event name `cookie_consent_update`
- Add a Tag exception so it does not fire when consent is denied

You can also create a rule that fires only when `{{DL - cookie_consent}}.analytics_storage` equals `granted`.

7) Test your setup
-------------------
- Use GTM Preview mode.
- Open the page with Developer Tools network throttling disabled.
- Verify the initial dataLayer contains the `consent default` object with `denied` values.
- Open Cookie Settings and accept analytics — watch GTM Preview: `cookie_consent_update` should fire, the Consent Update tag should run, and GA4 tag should run (or be allowed).

8) Notes on IAB TCF and CMP integration
---------------------------------------
This guide demonstrates Consent Mode v2 integration for GTM. If you require full IAB TCF v2.2 support (CMP + consent string), you will need a dedicated CMP that implements the TCF API and provides the `tcString`. Integrating TCF is more involved and out of scope for this quick guide, but can be added later.

9) Troubleshooting
------------------
- If GA4 still fires before consent, ensure the Consent Initialization tag runs before GA4. Increase priority or use built-in Consent Initialization trigger.
- Ensure your site does not include direct GA scripts (gtag.js) before consent defaults are set.
- Use `dataLayer` debug output and GTM Preview to inspect events.

If you want, I can:
- Create the GTM Custom HTML tags (snippet text) in files under `./gtm-snippets/` to copy-paste into GTM quickly.
- Add example Data Layer Variable and Trigger JSON for export/import.
