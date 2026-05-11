(function () {
  'use strict';

  // ── Smooth scroll all anchor links ──
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var href = this.getAttribute('href');
      if (href === '#') return;
      var target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ── Inject hamburger button into navbar ──
  var nav = document.querySelector('nav, [class*="navbar"], [class*="nav-bar"], header');
  if (nav && window.innerWidth <= 768) {
    var hamburger = document.createElement('button');
    hamburger.className = 'mobile-hamburger';
    hamburger.setAttribute('aria-label', 'Toggle menu');
    hamburger.innerHTML = '<span></span><span></span><span></span>';
    nav.appendChild(hamburger);

    var navMenu = nav.querySelector('[class*="nav-links"], [class*="nav-menu"], ul');
    hamburger.addEventListener('click', function () {
      if (navMenu) navMenu.classList.toggle('mobile-open');
    });
  }

  // ── Sidebar toggle for dashboard/portal pages ──
  var sidebar = document.querySelector('[class*="sidebar"]');
  if (sidebar && window.innerWidth <= 768) {
    // Overlay
    var overlay = document.createElement('div');
    overlay.className = 'mobile-sidebar-overlay';
    document.body.appendChild(overlay);

    // Toggle button
    var sidebarToggle = document.createElement('button');
    sidebarToggle.className = 'mobile-hamburger';
    sidebarToggle.setAttribute('aria-label', 'Toggle sidebar');
    sidebarToggle.innerHTML = '<span></span><span></span><span></span>';
    sidebarToggle.style.cssText = 'position:fixed;top:12px;left:12px;z-index:10001;';
    document.body.appendChild(sidebarToggle);

    sidebarToggle.addEventListener('click', function () {
      sidebar.classList.toggle('mobile-open');
      overlay.classList.toggle('mobile-open');
    });
    overlay.addEventListener('click', function () {
      sidebar.classList.remove('mobile-open');
      overlay.classList.remove('mobile-open');
    });
  }

  // ── iOS touch momentum for scroll containers ──
  document.querySelectorAll('[class*="scroll"], [class*="table-wrap"], table')
    .forEach(function (el) {
      el.style.webkitOverflowScrolling = 'touch';
    });

})();
