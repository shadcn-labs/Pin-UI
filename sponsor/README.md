# Sponsor

Everything for sponsoring Pin UI lives in this folder: the landing-page section, the `/sponsor` page with its plans and Dodo Payments checkout, the thank-you page, the webhook, the navbar link and the images.

## The switch

`config.ts` → `SPONSOR_ENABLED`

| Value | What happens |
| --- | --- |
| `false` | Parked. Nothing sponsor-related shows anywhere: no section on the landing page, no "Sponsor" link in any navbar, footer or phone menu, and `/sponsor`, `/sponsor/thanks`, `/api/sponsor/checkout` and `/api/webhooks/dodo` all answer 404. `/sponsor` is left out of the sitemap. |
| `true` (now) | Live everywhere, exactly as before. |

Turning it on is a one-line change. After that, `/sponsor` takes payments as soon as the Dodo variables in `.env.local` (and on Vercel) are set. See `.env.example`.

## What lives where

```
sponsor/
  config.ts              the switch
  SponsorNavLink.tsx     the "Sponsor" link every bar uses, plus the phone menu's entry
  plans.ts               the three plan keys (diamond, gold, supporter)
  landing/
    SponsorSection.tsx   the section under Testimonials on the landing page
    SponsorLogos.tsx     the Vercel and Talvess marks for the platform row
    sponsor-section.css
  page/
    SponsorRoute.tsx     /sponsor: metadata and the ?checkout= notice
    SponsorPage.tsx      the plan cards
    PlanCheckout.tsx     the checkout button on each card
    ThanksRoute.tsx      /sponsor/thanks, where Dodo sends people back
    sponsor-page.css
  server/                server-only
    dodo.ts              the Dodo Payments client and the plan ↔ product mapping
    checkout.ts          POST /api/sponsor/checkout
    webhook.ts           POST /api/webhooks/dodo
  assets/                diamond, gold, cherry and glow images (imported, not in /public)
```

Next.js only finds routes under `app/`, so four thin files stay there. Each one only checks the switch and hands over to this folder:

- `app/sponsor/page.tsx`
- `app/sponsor/thanks/page.tsx`
- `app/api/sponsor/checkout/route.ts`
- `app/api/webhooks/dodo/route.ts`

The navbars and the landing page only reference `SponsorNavLink` and `SponsorSection` behind the switch.
