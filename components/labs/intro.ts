/*
 * The /shadcn-labs arrival (LabsIntro.tsx): the page opens on its foot — the
 * shard ring with the lockup in its eye — holds there a moment, then glides
 * up to the top, the ring sinking away below as the announcement comes down
 * into view.
 *
 * On a full load this runs inline, while the page is still being parsed, so
 * the first paint is already at the foot — the top is never seen flashing
 * first. It marks <html> with data-labs-intro="hold" for LabsIntro to pick up.
 * No intro for a link to a #section, a return through back/forward (the
 * browser puts the reader back where they were), or reduced motion.
 */
export const INTRO_ATTR = "data-labs-intro";

export const INTRO_SCRIPT = `(function(){try{
var d=document.documentElement,n=performance.getEntriesByType("navigation")[0];
if(location.hash||matchMedia("(prefers-reduced-motion: reduce)").matches||(n&&n.type==="back_forward"))return;
d.setAttribute("${INTRO_ATTR}","hold");
if("scrollRestoration" in history)history.scrollRestoration="manual";
scrollTo({top:d.scrollHeight,behavior:"instant"});
}catch(e){}})();`;
