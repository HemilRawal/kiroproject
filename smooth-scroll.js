/**
 * Bharat Modules — Premium Smooth Scroll
 * Powered by Lenis (Studio Freight)
 * Gives a buttery, physics-based momentum scroll on all pages.
 */
(function () {
  // Wait for the Lenis script to be loaded then initialise
  function initLenis() {
    if (typeof Lenis === "undefined") return;

    const lenis = new Lenis({
      duration: 1.35,
      easing: function (t) {
        // Expo ease-out — fast start, ultra-smooth settle
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      },
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 0.85,
      smoothTouch: true,
      touchMultiplier: 1.4,
      infinite: false,
    });

    // Expose globally so other scripts can scroll programmatically
    window.__lenis = lenis;

    // Make anchor links work with Lenis
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener("click", function (e) {
        var href = this.getAttribute("href");
        if (href === "#") return;
        var target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          lenis.scrollTo(target, { offset: -80, duration: 1.4 });
        }
      });
    });

    // RAF loop
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  // If Lenis already loaded, initialise immediately
  if (typeof Lenis !== "undefined") {
    initLenis();
  } else {
    // Otherwise wait for the script to finish loading
    var script = document.querySelector('script[src*="lenis"]');
    if (script) {
      script.addEventListener("load", initLenis);
    }
  }
})();
