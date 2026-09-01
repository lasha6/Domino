/* =====================================================================
   Advertising — and, for now, mostly the not doing of it.

   Nothing here shows an ad yet: H5 Games Ads has to be switched on by
   Google before any of it is allowed to run, and `LIVE` below is the one
   place that says so. What exists now is the part that is easy to get wrong
   later and expensive to get wrong at all — deciding WHERE an ad may load.

   Why that is the piece worth building first:

   The account this would earn on is not a new one. It is years old and it
   pays out. An ad tag that loads while we are testing — a phone on the desk
   reloading the lobby forty times an afternoon, a headless browser taking
   screenshots — is invalid traffic on that account, and invalid traffic is
   answered by limiting or closing it. Not the game's earnings: all of them.

   So this is a rule and not a habit. Nobody has to remember to switch ads
   off before testing, because they were never on anywhere a test can reach.
   ===================================================================== */
(function (global) {
  "use strict";

  const PUBLISHER = "pub-7087199697693403";   // must match public/ads.txt

  /* Off until Google says otherwise. When H5 Games Ads is approved this
     becomes true and nothing else in the app has to change. */
  const LIVE = false;

  const doc = global.document;
  const loc = global.location || {};

  /* Somewhere a test can reach. Deliberately generous — a false "no" costs
     a missed impression, a false "yes" costs the account. */
  function ourOwnMachine() {
    const h = String(loc.hostname || "");
    if (!h) return true;                                   // opened from a file
    if (loc.protocol === "file:") return true;
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1") return true;
    if (h.endsWith(".local") || h.endsWith(".localhost")) return true;
    // the machine serving to a phone on the same Wi-Fi, which is how this is tested
    if (/^192\.168\./.test(h)) return true;
    if (/^10\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
    if (loc.port && (loc.port === "3099" || loc.port === "3000")) return true;
    return false;
  }

  /* Inside the Android app the pages come from the APK and the WebView calls
     itself localhost, so the check above already refuses — but say it out
     loud anyway, because the reason is different and it will matter: a game
     inside an app is AdMob's job, and Google's own guidance is that putting
     the web tag there is neither high-performing nor policy compliant. */
  const insideTheApp = () =>
    !!(global.Capacitor && global.Capacitor.isNativePlatform &&
       global.Capacitor.isNativePlatform());

  function allowed() {
    if (!LIVE) return false;
    if (insideTheApp()) return false;
    if (ourOwnMachine()) return false;
    return true;
  }

  /* The tag is fetched only where an ad may actually be shown. A page that
     is not allowed to advertise does not load Google's script at all —
     which is also why nothing is requested on a machine of ours. */
  let started = false;
  function start() {
    if (started || !allowed()) return started;
    const s = doc.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-" + PUBLISHER;
    doc.head.appendChild(s);
    global.adsbygoogle = global.adsbygoogle || [];
    started = true;
    return true;
  }

  const push = (o) => { (global.adsbygoogle = global.adsbygoogle || []).push(o); };

  /* Offer a reward for watching. Resolves TRUE only if the ad was actually
     watched through — never on a dismissal, never on an error, and never
     when ads are not running, so a caller can always fall back to whatever
     the player could do before.

       Ads.rewarded({ name: "coins-rescue" }).then((earned) => ...)
   */
  function rewarded(opts) {
    const o = opts || {};
    if (!start()) return Promise.resolve(false);
    return new Promise((done) => {
      let paid = false;
      push({
        type: "reward",
        name: o.name || "reward",
        beforeReward: (showAdFn) => { if (o.offer) o.offer(showAdFn); else showAdFn(); },
        beforeAd: () => { if (o.before) o.before(); },
        adViewed: () => { paid = true; },
        adDismissed: () => { paid = false; },
        afterAd: () => { if (o.after) o.after(); },
        // the last word in every case, including the ones that never showed
        adBreakDone: () => done(paid),
      });
    });
  }

  global.Ads = { available: allowed, start, rewarded, PUBLISHER, LIVE };
})(typeof window !== "undefined" ? window : this);
