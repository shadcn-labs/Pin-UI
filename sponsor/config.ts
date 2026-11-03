/**
 * The sponsor switch — everything sponsor-related on Pin UI turns on and off
 * here, and only here.
 *
 *   false — parked. The landing page's sponsor section, every "Sponsor" link
 *           (every navbar, the footer, the phone menu), the /sponsor and
 *           /sponsor/thanks pages, the checkout and the Dodo webhook are all
 *           out of sight: the pages answer 404, the API routes answer 404,
 *           and /sponsor is left out of the sitemap. Nothing is deleted —
 *           the code all stays in this folder, ready.
 *
 *   true  — live everywhere, exactly as before.
 *
 * It is a plain constant rather than an environment variable so that a
 * parked build ships none of it switched on by accident, and the change is
 * one line in review. See README.md for what lives where.
 */
export const SPONSOR_ENABLED: boolean = true;
