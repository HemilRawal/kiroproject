/**
 * Bharat Modules — Session & Auth Sync
 * Ensures the navbar correctly reflects the login state across all public pages.
 */
(function () {
  function updateNavbar() {
    const token = localStorage.getItem("bm_token");
    const userStr = localStorage.getItem("bm_user");

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        const loginBtn = document.querySelector(".nav-btn-login");

        if (loginBtn) {
          // Determine Dashboard URL based on role
          let dashboardUrl = "index.html";
          if (user.role === "manufacturer") {
            dashboardUrl =
              user.application_status === "approved"
                ? "manufacturer_portal.html"
                : "onboarding2.html";
          } else if (user.role === "buyer") {
            dashboardUrl = "customer_dashboard_3.html";
          } else if (user.role === "admin") {
            dashboardUrl = "admin_portal.html";
          }

          // Replace Login button with Dashboard & Logout
          const authContainer = document.createElement("div");
          authContainer.className = "nav-auth-container";
          authContainer.style.display = "flex";
          authContainer.style.alignItems = "center";
          authContainer.style.gap = "12px";

          // Dashboard Link
          const dashBtn = document.createElement("a");
          dashBtn.href = dashboardUrl;
          dashBtn.innerText = "Dashboard";
          dashBtn.style.cssText = `
            background: rgba(255, 107, 0, 0.1);
            color: #FF6B00 !important;
            padding: 8px 16px;
            border: 1px solid rgba(255, 107, 0, 0.3);
            border-radius: 6px;
            text-decoration: none;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            transition: all 0.2s;
            display: flex;
            align-items: center;
          `;
          dashBtn.onmouseover = () => {
            dashBtn.style.background = "rgba(255, 107, 0, 0.2)";
            dashBtn.style.borderColor = "rgba(255, 107, 0, 0.5)";
          };
          dashBtn.onmouseout = () => {
            dashBtn.style.background = "rgba(255, 107, 0, 0.1)";
            dashBtn.style.borderColor = "rgba(255, 107, 0, 0.3)";
          };

          // Logout Button
          const logoutBtn = document.createElement("button");
          logoutBtn.innerText = "Logout";
          logoutBtn.style.cssText = `
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: rgba(255, 255, 255, 0.5) !important;
            padding: 7px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.02em;
            transition: all 0.2s;
          `;
          logoutBtn.onclick = handleLogout;
          logoutBtn.onmouseover = () => {
            logoutBtn.style.color = "#fff";
            logoutBtn.style.borderColor = "rgba(255, 255, 255, 0.3)";
            logoutBtn.style.background = "rgba(255, 255, 255, 0.05)";
          };
          logoutBtn.onmouseout = () => {
            logoutBtn.style.color = "rgba(255, 255, 255, 0.5)";
            logoutBtn.style.borderColor = "rgba(255, 255, 255, 0.15)";
            logoutBtn.style.background = "transparent";
          };

          authContainer.appendChild(dashBtn);
          authContainer.appendChild(logoutBtn);
          loginBtn.parentNode.replaceChild(authContainer, loginBtn);
        }
      } catch (e) {
        console.error("Auth Sync Error:", e);
      }
    }
  }

  function handleLogout() {
    localStorage.removeItem("bm_token");
    localStorage.removeItem("bm_user");
    localStorage.removeItem("userRole");
    localStorage.removeItem("bharat_modules_registration");
    localStorage.removeItem("pendingVerification");
    window.location.href = "index.html";
  }

  // Initial Check
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateNavbar);
  } else {
    updateNavbar();
  }

  // Handle cross-tab logout
  window.addEventListener("storage", (e) => {
    if (e.key === "bm_token" && !e.newValue) {
      window.location.reload();
    }
  });
})();
