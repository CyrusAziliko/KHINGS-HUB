import { supabase } from "../supabaseClient.js";

export async function loadSettingsModule() {
  console.log("Loading Settings module");

  const panel = document.querySelector('[data-view-panel="settings"]');
  if (!panel) {
    console.error("Settings panel missing");
    return;
  }

  const settings = [
    {
      key: "administrator-profile",
      icon: "🧑‍💼",
      title: "Administrator Profile",
      description:
        "Keep your admin profile accurate—identity, role details, and enterprise account readiness.",
      badgeText: "Active",
      badgeTone: "active",
    },

    {
      key: "appearance",
      icon: "🎨",
      title: "Appearance",
      description:
        "Configure enterprise look & feel—theme, density, and motion for a consistent admin experience.",
      badgeText: "Configured",
      badgeTone: "configured",
    },

    {
      key: "notifications",
      icon: "🔔",
      title: "Notifications",
      description:
        "Enable enterprise alerts—channel preferences and critical update routing across your organization.",
      badgeText: "Enabled",
      badgeTone: "enabled",
    },
  ];

  function renderLanding() {
    panel.innerHTML = `
      <section class="settings-wrap">
        <div class="settings-overview-header">
          <div class="settings-overview-header-left">
            <div class="settings-overview-title-row">
              <div class="settings-overview-hero-icon" aria-hidden="true">⚙</div>
              <div>
                <h2 class="settings-title settings-overview-title">Enterprise Settings</h2>
                <p class="muted settings-subtitle settings-overview-subtitle">Polished admin configuration: profile identity, appearance, and enterprise notification routing.</p>
              </div>
            </div>

            <div class="settings-overview-summary">
              <span class="settings-overview-summary-item" aria-hidden="true">🧩</span>
              <span class="settings-overview-summary-text">Keep your enterprise experience consistent across teams.</span>
            </div>
          </div>

          <div class="settings-toolbar settings-overview-toolbar">
            <div class="settings-search">
              <input
                type="text"
                id="settings-search-input"
                class="settings-search-input"
                placeholder="Search settings (UI only)"
                aria-label="Search settings"
              />
            </div>

            <div class="settings-actions">
              <button id="settings-refresh-btn" class="settings-btn settings-refresh-btn" type="button" aria-label="Refresh settings">
                <span class="settings-btn-icon">⟳</span>
                Refresh
              </button>

              <button id="settings-export-btn" class="settings-btn settings-export-btn" type="button" aria-label="Export settings">
                <span class="settings-btn-icon">⤓</span>
                Export Settings
              </button>
            </div>
          </div>
        </div>

        <div class="settings-overview-cards" id="settings-cards">
          ${settings
            .map(
              (s) => `
                <article class="settings-card settings-overview-card" tabindex="0" role="group" aria-label="${s.title}">
                  <div class="settings-card-inner">
                    <div class="settings-card-icon" aria-hidden="true">${s.icon}</div>

                    <div class="settings-card-body">
                      <h3 class="settings-card-title settings-overview-card-title">${s.title}</h3>
                      <p class="settings-card-desc settings-overview-card-desc">${s.description}</p>

                      <div class="settings-card-meta settings-overview-card-meta">
                        <span
                          class="settings-overview-status-badge settings-overview-status-badge--${s.badgeTone}"
                          aria-label="${s.title} status"
                        >
                          ${s.badgeText}
                        </span>
                      </div>
                    </div>

                    <div class="settings-card-actions">
                      <button class="settings-open-btn" type="button" data-open-settings-key="${s.key}">
                        Open
                      </button>
                    </div>
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>
    `;

    // Search is UI-only (no filtering logic)
    const refreshBtn = document.getElementById("settings-refresh-btn");
    const exportBtn = document.getElementById("settings-export-btn");

    refreshBtn?.addEventListener("click", () => {
      console.log("[Settings] Refresh UI clicked");
    });

    exportBtn?.addEventListener("click", () => {
      console.log("[Settings] Export UI clicked");
      // UI-only: placeholder action
    });

    panel.querySelectorAll(".settings-open-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const key = e.currentTarget.getAttribute("data-open-settings-key");
        const selected = settings.find((x) => x.key === key);
        if (!selected) return;
        renderPlaceholderView(selected);
      });
    });
  }

  function renderPlaceholderView(selected) {
    let originalCompany = null;
    let companyId = null;

    // -------------------------------
    // Phase 3.6.x: Appearance Settings
    // -------------------------------
    if (selected.key === "appearance") {
      const STORAGE_KEY = "khingsHubAppearance";

      function safeParse(json) {
        try {
          return JSON.parse(json);
        } catch {
          return null;
        }
      }

      const defaultAppearance = {
        theme: "dark", // dark enterprise
        density: "comfortable",
        animations: "on",
      };

      function readAppearanceFromStorage() {
        const raw = window.localStorage?.getItem(STORAGE_KEY);
        if (!raw) return { ...defaultAppearance };
        const parsed = safeParse(raw);
        if (!parsed || typeof parsed !== "object")
          return { ...defaultAppearance };

        return {
          theme:
            parsed.theme === "light" || parsed.theme === "dark"
              ? parsed.theme
              : defaultAppearance.theme,
          density:
            parsed.density === "compact" || parsed.density === "comfortable"
              ? parsed.density
              : defaultAppearance.density,
          animations:
            parsed.animations === "off" || parsed.animations === "on"
              ? parsed.animations
              : defaultAppearance.animations,
        };
      }

      function persistAppearance(next) {
        window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
      }

      function applyAppearanceToDocument(next) {
        // Normalize to ensure CSS selectors always match expected values.
        // (Prevents cases where radio lookup fails and theme becomes undefined.)
        const normalized = {
          theme: next?.theme === "light" ? "light" : "dark",
          density: next?.density === "compact" ? "compact" : "comfortable",
          animations: next?.animations === "off" ? "off" : "on",
        };

        const root = document.documentElement;
        root.dataset.khingsHubTheme = normalized.theme;
        root.dataset.khingsHubDensity = normalized.density;
        root.dataset.khingsHubAnimations = normalized.animations;

        // Synchronize legacy/convenience attribute expected by CSS theme system
        // (styles.css listens to [data-theme="light"]).
        if (normalized.theme === "light") {
          root.dataset.theme = "light";
        } else {
          root.removeAttribute("data-theme");
        }


        // Also set a convenience class on body
        document.body.dataset.khingsHubTheme = normalized.theme;
        document.body.dataset.khingsHubDensity = normalized.density;
        document.body.dataset.khingsHubAnimations = normalized.animations;

        console.log("[Appearance] Applied:", normalized);
      }

      function setControlChecked(group, value) {
        panel.querySelectorAll(`input[name="${group}"]`).forEach((el) => {
          el.checked = el.value === value;
        });
      }

      function getControlsValue() {
        const theme = panel.querySelector(
          'input[name="khTheme"]:checked',
        )?.value;
        const density = panel.querySelector(
          'input[name="khDensity"]:checked',
        )?.value;
        const animations = panel.querySelector(
          'input[name="khAnimations"]:checked',
        )?.value;

        return {
          theme: theme || defaultAppearance.theme,
          density: density || defaultAppearance.density,
          animations: animations || defaultAppearance.animations,
        };
      }

      const saved = readAppearanceFromStorage();
      applyAppearanceToDocument(saved);

      panel.innerHTML = `
        <section class="settings-wrap">
          <div class="settings-header">
            <div>
              <h2 class="settings-title">🎨 Appearance</h2>
              <p class="muted settings-subtitle">Preview and apply enterprise appearance settings.</p>
            </div>

            <div class="settings-actions">
              <button
                id="settings-appearance-apply-btn"
                class="settings-btn settings-export-btn"
                type="button"
                aria-label="Apply appearance changes"
              >
                Apply
              </button>

              <button
                id="settings-back-btn"
                class="settings-btn settings-back-btn"
                type="button"
                aria-label="Back to enterprise settings"
              >
                ← Back
              </button>
            </div>
          </div>

          <div class="settings-appearance-grid">
            <div class="settings-appearance-card glass">
              <h3 class="settings-appearance-card-title">Global Theme</h3>
              <div class="settings-appearance-toggle-row">
                <label class="settings-appearance-toggle">
                  <input type="checkbox" id="khThemeToggle" />
                  <span class="toggle-ui" aria-hidden="true"></span>
                  <span class="toggle-label">Light Theme</span>
                </label>
              </div>
              <p class="settings-appearance-helper muted">Switch overall enterprise look.</p>
            </div>

            <div class="settings-appearance-card glass">
              <h3 class="settings-appearance-card-title">Density</h3>
              <div class="settings-appearance-toggle-row">
                <label class="settings-appearance-toggle">
                  <input type="checkbox" id="khDensityToggle" />
                  <span class="toggle-ui" aria-hidden="true"></span>
                  <span class="toggle-label">Compact</span>
                </label>
              </div>
              <p class="settings-appearance-helper muted">Tighter spacing for more information.</p>
            </div>

            <div class="settings-appearance-card glass">
              <h3 class="settings-appearance-card-title">Animations</h3>
              <div class="settings-appearance-toggle-row">
                <label class="settings-appearance-toggle">
                  <input type="checkbox" id="khAnimationsToggle" />
                  <span class="toggle-ui" aria-hidden="true"></span>
                  <span class="toggle-label">Animations On</span>
                </label>
              </div>
              <p class="settings-appearance-helper muted">Disable transitions/animations globally.</p>
            </div>
          </div>

          <style>
            .settings-appearance-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;}
            @media(max-width:900px){.settings-appearance-grid{grid-template-columns:1fr;}}
            .settings-appearance-card{padding:18px;}

            .settings-appearance-toggle{display:flex;align-items:center;gap:12px;cursor:pointer;user-select:none;}
            .settings-appearance-toggle input{display:none;}

            .toggle-ui{width:52px;height:30px;border-radius:999px;background:rgba(15,23,42,.55);border:1px solid rgba(255,255,255,.12);position:relative;flex:0 0 auto;transition:.2s;}
            .toggle-ui::after{content:"";position:absolute;top:50%;left:4px;transform:translateY(-50%);width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.9);transition:.2s;}

            .settings-appearance-toggle input:checked + .toggle-ui{background:rgba(124,58,237,.25);border-color:rgba(124,58,237,.45);}
            .settings-appearance-toggle input:checked + .toggle-ui::after{left:26px;background:#fff;}

            .toggle-label{font-size:13px;font-weight:900;color:white;}
            html[data-khingsHub-theme="light"] .toggle-label{color: #0f172a !important;}
          </style>
        </section>
      `;

      // Initialize control states (toggles)
      const themeToggle = document.getElementById("khThemeToggle");
      const densityToggle = document.getElementById("khDensityToggle");
      const animationsToggle = document.getElementById("khAnimationsToggle");

      const initialThemeIsLight = saved.theme === "light";
      const initialDensityIsCompact = saved.density === "compact";
      const initialAnimationsAreOff = saved.animations === "off";

      if (themeToggle) themeToggle.checked = initialThemeIsLight;
      if (densityToggle) densityToggle.checked = initialDensityIsCompact;
      // toggle UI label says “Animations On” (checked => on)
      if (animationsToggle) animationsToggle.checked = !initialAnimationsAreOff;

      function getToggleValues() {
        return {
          theme: themeToggle?.checked ? "light" : "dark",
          density: densityToggle?.checked ? "compact" : "comfortable",
          animations: animationsToggle?.checked ? "on" : "off",
        };
      }

      const applyFromToggles = () => {
        const next = getToggleValues();
        applyAppearanceToDocument(next);
        persistAppearance(next);
      };

      themeToggle?.addEventListener("change", applyFromToggles);
      densityToggle?.addEventListener("change", applyFromToggles);
      animationsToggle?.addEventListener("change", applyFromToggles);

      // Back button
      document
        .getElementById("settings-back-btn")
        ?.addEventListener("click", () => {
          renderLanding();
        });

      document
        .getElementById("settings-back-btn")
        ?.addEventListener("click", () => {
          renderLanding();
        });

      return;
    }

    // Phase 3.7: Notification Center (Enterprise Notification & Alert Preferences)
    if(selected.key === "notifications") {
      const STORAGE_KEY = "khingsHubNotifications";

      function safeParse(json) {
        try {
          return JSON.parse(json);
        } catch {
          return null;
        }
      }

      const defaultNotifications = {
        system: true,
        email: true,
        safetyAlerts: true,
        ticketUpdates: true,
        equipmentAlerts: true,
        aiIntelligenceAlerts: true,
      };

      function readNotificationsFromStorage() {
        const raw = window.localStorage?.getItem(STORAGE_KEY);
        if (!raw) return { ...defaultNotifications };
        const parsed = safeParse(raw);
        if (!parsed || typeof parsed !== "object") return { ...defaultNotifications };

        const pickBool = (v, fallback) => (typeof v === "boolean" ? v : fallback);

        return {
          system: pickBool(parsed.system, defaultNotifications.system),
          email: pickBool(parsed.email, defaultNotifications.email),
          safetyAlerts: pickBool(
            parsed.safetyAlerts,
            defaultNotifications.safetyAlerts,
          ),
          ticketUpdates: pickBool(
            parsed.ticketUpdates,
            defaultNotifications.ticketUpdates,
          ),
          equipmentAlerts: pickBool(
            parsed.equipmentAlerts,
            defaultNotifications.equipmentAlerts,
          ),
          aiIntelligenceAlerts: pickBool(
            parsed.aiIntelligenceAlerts,
            defaultNotifications.aiIntelligenceAlerts,
          ),
        };
      }

      function persistNotifications(next) {
        window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
      }

      function setToggleChecked(inputId, checked) {
        const el = panel.querySelector(`#${inputId}`);
        if (!el) return;
        el.checked = !!checked;
      }

      function getTogglesFromUI() {
        return {
          system: !!panel.querySelector("#khNotifSystem")?.checked,
          email: !!panel.querySelector("#khNotifEmail")?.checked,
          safetyAlerts: !!panel.querySelector("#khNotifSafetyAlerts")?.checked,
          ticketUpdates: !!panel.querySelector("#khNotifTicketUpdates")?.checked,
          equipmentAlerts: !!panel.querySelector(
            "#khNotifEquipmentAlerts",
          )?.checked,
          aiIntelligenceAlerts: !!panel.querySelector(
            "#khNotifAIIntelligenceAlerts",
          )?.checked,
        };
      }

      function renderUI(saved) {
        panel.innerHTML = `
          <section class="settings-wrap">
            <div class="settings-header">
              <div>
                <h2 class="settings-title">🔔 Notification Center</h2>
                <p class="muted settings-subtitle">Manage enterprise notification channels and alert preferences.</p>
              </div>

              <div class="settings-actions">
                <button id="settings-back-btn" class="settings-btn settings-back-btn" type="button" aria-label="Back to enterprise settings">
                  ← Back
                </button>
              </div>
            </div>

            <div class="settings-notification-container">
              <div class="settings-notification-main">
                <div class="settings-notification-card settings-notification-card--toggles">
                  <h3 class="settings-notification-heading">Alert Preferences</h3>

                  <div class="settings-notification-toggle-list">
                    <label class="settings-notification-toggle" for="khNotifSystem">
                      <input id="khNotifSystem" type="checkbox" />
                      <span class="settings-notification-toggle-ui" aria-hidden="true"></span>
                      <span class="settings-notification-toggle-label">System Notifications</span>
                      <span class="settings-notification-toggle-badge" data-badge-for="khNotifSystem"></span>
                    </label>

                    <label class="settings-notification-toggle" for="khNotifEmail">
                      <input id="khNotifEmail" type="checkbox" />
                      <span class="settings-notification-toggle-ui" aria-hidden="true"></span>
                      <span class="settings-notification-toggle-label">Email Notifications</span>
                      <span class="settings-notification-toggle-badge" data-badge-for="khNotifEmail"></span>
                    </label>

                    <label class="settings-notification-toggle" for="khNotifSafetyAlerts">
                      <input id="khNotifSafetyAlerts" type="checkbox" />
                      <span class="settings-notification-toggle-ui" aria-hidden="true"></span>
                      <span class="settings-notification-toggle-label">Safety Alerts</span>
                      <span class="settings-notification-toggle-badge" data-badge-for="khNotifSafetyAlerts"></span>
                    </label>

                    <label class="settings-notification-toggle" for="khNotifTicketUpdates">
                      <input id="khNotifTicketUpdates" type="checkbox" />
                      <span class="settings-notification-toggle-ui" aria-hidden="true"></span>
                      <span class="settings-notification-toggle-label">Ticket Updates</span>
                      <span class="settings-notification-toggle-badge" data-badge-for="khNotifTicketUpdates"></span>
                    </label>

                    <label class="settings-notification-toggle" for="khNotifEquipmentAlerts">
                      <input id="khNotifEquipmentAlerts" type="checkbox" />
                      <span class="settings-notification-toggle-ui" aria-hidden="true"></span>
                      <span class="settings-notification-toggle-label">Equipment Alerts</span>
                      <span class="settings-notification-toggle-badge" data-badge-for="khNotifEquipmentAlerts"></span>
                    </label>

                    <label class="settings-notification-toggle" for="khNotifAIIntelligenceAlerts">
                      <input id="khNotifAIIntelligenceAlerts" type="checkbox" />
                      <span class="settings-notification-toggle-ui" aria-hidden="true"></span>
                      <span class="settings-notification-toggle-label">AI Intelligence Alerts</span>
                      <span class="settings-notification-toggle-badge" data-badge-for="khNotifAIIntelligenceAlerts"></span>
                    </label>
                  </div>

                  <p class="settings-notification-helper muted">Changes apply immediately and are saved to this device.</p>
                </div>
              </div>

              <div class="settings-notification-side">
                <div class="settings-notification-card settings-notification-card--info">
                  <h3 class="settings-notification-heading">Notification Channels</h3>
                  <div class="settings-notification-channel-cards">
                    <div class="settings-notification-channel-card">
                      <div class="settings-notification-channel-title">Dashboard Alerts</div>
                      <div class="settings-notification-channel-subtitle">In-app updates for selected alert types.</div>
                      <span class="settings-notification-pill" aria-hidden="true">In-App</span>
                    </div>

                    <div class="settings-notification-channel-card">
                      <div class="settings-notification-channel-title">Email Alerts</div>
                      <div class="settings-notification-channel-subtitle">Email delivery for enterprise alert categories.</div>
                      <span class="settings-notification-pill" aria-hidden="true">Email</span>
                    </div>

                    <div class="settings-notification-channel-card">
                      <div class="settings-notification-channel-title">Emergency Alerts</div>
                      <div class="settings-notification-channel-subtitle">High-signal notifications for critical safety events.</div>
                      <span class="settings-notification-pill settings-notification-pill--emergency" aria-hidden="true">Critical</span>
                    </div>
                  </div>
                </div>

                <div class="settings-notification-card settings-notification-card--info">
                  <h3 class="settings-notification-heading">Priority Levels</h3>

                  <div class="settings-notification-priority-grid" aria-label="Notification priority legend">
                    <div class="settings-notification-priority-item">
                      <span class="settings-notification-priority-badge settings-notification-priority-badge--critical">Critical</span>
                      <span class="settings-notification-priority-text">Action required immediately.</span>
                    </div>

                    <div class="settings-notification-priority-item">
                      <span class="settings-notification-priority-badge settings-notification-priority-badge--high">High</span>
                      <span class="settings-notification-priority-text">Important and time-sensitive.</span>
                    </div>

                    <div class="settings-notification-priority-item">
                      <span class="settings-notification-priority-badge settings-notification-priority-badge--normal">Normal</span>
                      <span class="settings-notification-priority-text">Informational updates.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        `;

        // Initialize toggle checked states + badges
        setToggleChecked("khNotifSystem", saved.system);
        setToggleChecked("khNotifEmail", saved.email);
        setToggleChecked("khNotifSafetyAlerts", saved.safetyAlerts);
        setToggleChecked("khNotifTicketUpdates", saved.ticketUpdates);
        setToggleChecked("khNotifEquipmentAlerts", saved.equipmentAlerts);
        setToggleChecked(
          "khNotifAIIntelligenceAlerts",
          saved.aiIntelligenceAlerts,
        );

        const updateBadges = () => {
          const pairs = [
            ["khNotifSystem", saved.system],
            ["khNotifEmail", saved.email],
            ["khNotifSafetyAlerts", saved.safetyAlerts],
            ["khNotifTicketUpdates", saved.ticketUpdates],
            ["khNotifEquipmentAlerts", saved.equipmentAlerts],
            ["khNotifAIIntelligenceAlerts", saved.aiIntelligenceAlerts],
          ];

          pairs.forEach(([id, isOn]) => {
            const badge = panel.querySelector(`[data-badge-for="${id}"]`);
            if (!badge) return;
            badge.textContent = isOn ? "On" : "Off";
            badge.classList.toggle("settings-notification-toggle-badge--on", !!isOn);
            badge.classList.toggle(
              "settings-notification-toggle-badge--off",
              !isOn,
            );
          });
        };

        updateBadges();

        // Toggle handler: persist immediately
        const inputs = panel.querySelectorAll(
          "#khNotifSystem, #khNotifEmail, #khNotifSafetyAlerts, #khNotifTicketUpdates, #khNotifEquipmentAlerts, #khNotifAIIntelligenceAlerts",
        );

        inputs.forEach((input) => {
          input.addEventListener("change", () => {
            const next = getTogglesFromUI();
            persistNotifications(next);

            // reflect badges
            const badgeMap = {
              khNotifSystem: next.system,
              khNotifEmail: next.email,
              khNotifSafetyAlerts: next.safetyAlerts,
              khNotifTicketUpdates: next.ticketUpdates,
              khNotifEquipmentAlerts: next.equipmentAlerts,
              khNotifAIIntelligenceAlerts: next.aiIntelligenceAlerts,
            };

            Object.keys(badgeMap).forEach((id) => {
              const badge = panel.querySelector(`[data-badge-for="${id}"]`);
              if (!badge) return;
              const isOn = badgeMap[id];
              badge.textContent = isOn ? "On" : "Off";
              badge.classList.toggle(
                "settings-notification-toggle-badge--on",
                !!isOn,
              );
              badge.classList.toggle(
                "settings-notification-toggle-badge--off",
                !isOn,
              );
            });
          });
        });

        // Back button
        document
          .getElementById("settings-back-btn")
          ?.addEventListener("click", () => {
            renderLanding();
          });
      }

      const saved = readNotificationsFromStorage();
      renderUI(saved);
      return;
    }

    // Phase 3.6.2: Company Information (UI only)
    if (selected.key === "company-information") {

      panel.innerHTML = `
        <section class="settings-wrap">
          <div class="settings-company-header">
            <div class="settings-company-header-left">
              <div class="settings-company-logo" aria-hidden="true">🏢</div>
              <div class="settings-company-header-identity">
                <h2 class="settings-company-title">Company Information</h2>
                <p class="settings-company-subtitle muted">Manage your company details and enterprise metadata.</p>
              </div>
            </div>

            <div class="settings-company-actions">
              <button id="settings-company-back-btn" class="settings-btn settings-back-btn" type="button" aria-label="Back to enterprise settings">
                ← Back
              </button>
            </div>
          </div>

          <div class="settings-company-grid">
            <div class="settings-company-card glass">
              <h3 class="settings-company-card-title">Company Profile</h3>

              <div class="settings-company-form-grid">
                <div class="settings-company-form-group settings-company-form-group--full">
                  <label>Company Name</label>
                  <input type="text" data-company-field="company_name" value="Loading..." />
                </div>

                <div class="settings-company-form-group">
                  <label>Company Code</label>
                  <input type="text" data-company-field="company_code" value="Loading..." />
                </div>

                <div class="settings-company-form-group">
                  <label>Industry</label>
                  <input type="text" data-company-field="industry" value="Loading..." />
                </div>

                <div class="settings-company-form-group settings-company-form-group--full">
                  <label>Website</label>
                  <input type="text" data-company-field="website" value="—" />
                </div>

                <div class="settings-company-form-group">
                  <label>Email</label>
                  <input type="text" data-company-field="email" value="—" />
                </div>

                <div class="settings-company-form-group">
                  <label>Phone</label>
                  <input type="text" data-company-field="phone" value="—" />
                </div>
              </div>
            </div>

            <div class="settings-company-card glass">
              <h3 class="settings-company-card-title">Location</h3>

              <div class="settings-company-form-grid">
                <div class="settings-company-form-group">
                  <label>Country</label>
                  <input type="text" data-company-field="country" value="—" />
                </div>

                <div class="settings-company-form-group">
                  <label>Region</label>
                  <input type="text" data-company-field="region" value="—" />
                </div>

                <div class="settings-company-form-group">
                  <label>City</label>
                  <input type="text" data-company-field="city" value="—" />
                </div>

                <div class="settings-company-form-group settings-company-form-group--full">
                  <label>Address</label>
                  <input type="text" data-company-field="address" value="—" />
                </div>
              </div>
            </div>

            <div class="settings-company-card glass settings-company-card--status">
              <h3 class="settings-company-card-title">Enterprise Status</h3>

              <div class="settings-company-readonly-grid">
                <div class="settings-company-readonly-item">
                  <span class="settings-company-readonly-label">Created At</span>
                  <strong class="settings-company-readonly-value" data-company-readonly-field="created_at">—</strong>
                </div>

                <div class="settings-company-readonly-item">
                  <span class="settings-company-readonly-label">Last Updated</span>
                  <strong class="settings-company-readonly-value" data-company-readonly-field="updated_at">—</strong>
                </div>
              </div>

              <div class="settings-company-save-row">
                <button id="settings-company-discard-btn" class="settings-btn settings-back-btn" type="button">
                  Discard Changes
                </button>
                <button id="settings-company-save-btn" class="settings-btn settings-export-btn" type="button">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </section>
      `;

      const discardBtn = document.getElementById(
        "settings-company-discard-btn",
      );
      const saveBtn = document.getElementById("settings-company-save-btn");

      const backBtn = document.getElementById("settings-company-back-btn");
      backBtn?.addEventListener("click", () => {
        renderLanding();
      });

      function getCompanyFormData() {
        return {
          company_name: panel
            .querySelector('[data-company-field="company_name"]')
            ?.value.trim(),
          company_code: panel
            .querySelector('[data-company-field="company_code"]')
            ?.value.trim(),
          industry: panel
            .querySelector('[data-company-field="industry"]')
            ?.value.trim(),
          website: panel
            .querySelector('[data-company-field="website"]')
            ?.value.trim(),
          email: panel
            .querySelector('[data-company-field="email"]')
            ?.value.trim(),
          phone: panel
            .querySelector('[data-company-field="phone"]')
            ?.value.trim(),
          country: panel
            .querySelector('[data-company-field="country"]')
            ?.value.trim(),
          region: panel
            .querySelector('[data-company-field="region"]')
            ?.value.trim(),
          city: panel
            .querySelector('[data-company-field="city"]')
            ?.value.trim(),
          address: panel
            .querySelector('[data-company-field="address"]')
            ?.value.trim(),
        };
      }

      function validateCompany(data) {
        if (!data.company_name) return "Company name is required.";
        if (!data.company_code) return "Company code is required.";
        if (!data.industry) return "Industry is required.";
        if (!data.country) return "Country is required.";
        if (!data.region) return "Region is required.";
        if (!data.city) return "City is required.";
        if (!data.address) return "Address is required.";
        return null;
      }

      async function loadCompanyInformation() {
        try {
          const { data: company, error } = await supabase
            .from("company_information")
            .select("*")
            .single();

          if (error) throw error;
          if (!company) throw new Error("Company information not found");

          originalCompany = { ...company };
          companyId = company.id ?? null;

          panel.querySelectorAll("[data-company-field]").forEach((el) => {
            const field = el.getAttribute("data-company-field");
            const value = company[field];
            const safe = value ?? "—";
            if (el.tagName === "INPUT") el.value = String(safe);
          });

          panel
            .querySelectorAll("[data-company-readonly-field]")
            .forEach((el) => {
              const field = el.getAttribute("data-company-readonly-field");
              const value = company[field];
              el.textContent = value ?? "—";
            });

          if (saveBtn) saveBtn.disabled = false;
          if (discardBtn) discardBtn.disabled = false;
        } catch (err) {
          console.error("Failed to load company information:", err);

          window.dispatchEvent(
            new CustomEvent("enterprise-toast", {
              detail: {
                type: "error",
                message: "Unable to load company information.",
              },
            }),
          );

          if (saveBtn) saveBtn.disabled = true;
          if (discardBtn) discardBtn.disabled = true;
        }
      }

      // initial disabled state until loaded
      if (saveBtn) saveBtn.disabled = true;
      if (discardBtn) discardBtn.disabled = true;

      loadCompanyInformation();

      saveBtn?.addEventListener("click", async () => {
        const formData = getCompanyFormData();
        const validationError = validateCompany(formData);
        if (validationError) {
          console.error(validationError);
          return;
        }

        if (!companyId) {
          console.error(
            "No companyId available for saving company information.",
          );
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";

        try {
          const payload = {
            company_name: formData.company_name,
            company_code: formData.company_code,
            industry: formData.industry,
            website: formData.website,
            email: formData.email,
            phone: formData.phone,
            country: formData.country,
            region: formData.region,
            city: formData.city,
            address: formData.address,
            updated_at: new Date(),
          };

          const { error } = await supabase
            .from("company_information")
            .update(payload)
            .eq("id", companyId);

          if (error) throw error;

          originalCompany = {
            ...originalCompany,
            ...payload,
          };

          // Refresh readonly updated_at display
          const updatedAtEl = panel.querySelector(
            '[data-company-readonly-field="updated_at"]',
          );
          if (updatedAtEl) updatedAtEl.textContent = payload.updated_at ?? "—";

          window.dispatchEvent(
            new CustomEvent("enterprise-toast", {
              detail: {
                type: "success",
                message: "Company information updated successfully.",
              },
            }),
          );
        } catch (err) {
          console.error("Unable to update company information:", err);
          window.dispatchEvent(
            new CustomEvent("enterprise-toast", {
              detail: {
                type: "error",
                message: "Unable to update company information.",
              },
            }),
          );
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = "Save Changes";
        }
      });

      discardBtn?.addEventListener("click", () => {
        if (!originalCompany) return;

        Object.keys(originalCompany).forEach((key) => {
          // restore only editable fields
          const el = panel.querySelector(`[data-company-field="${key}"]`);
          if (el && typeof el.value !== "undefined") {
            el.value = originalCompany[key] ?? "";
          }
        });

        const readonlyCreated = panel.querySelector(
          '[data-company-readonly-field="created_at"]',
        );
        const readonlyUpdated = panel.querySelector(
          '[data-company-readonly-field="updated_at"]',
        );
        if (readonlyCreated)
          readonlyCreated.textContent = originalCompany.created_at ?? "—";
        if (readonlyUpdated)
          readonlyUpdated.textContent = originalCompany.updated_at ?? "—";
      });

      return;
    }

    // Phase 3.5B.1: Administrator Profile (UI-only enterprise profile)
    if (selected.key === "administrator-profile") {
      panel.innerHTML = `
        <section class="settings-wrap">
          <div class="settings-profile-header">
            <div class="settings-profile-header-left">
              <div class="settings-profile-avatar">

                <img 
                  id="settings-profile-avatar-img"
                  src=""
                  alt="Administrator Avatar"
                  style="display:none;"
                />

                <div class="settings-profile-avatar-ring"></div>

                <label 
                  class="settings-profile-avatar-upload"
                  for="settings-avatar-input">
                  📷
                </label>

                <input
                  id="settings-avatar-input"
                  type="file"
                  accept="image/*"
                  hidden
                />

              </div>

              <div class="settings-profile-identity">
                <div class="settings-profile-name-row">
                  <h2 class="settings-profile-name">Loading...</h2>
                  <span class="settings-profile-role-badge" aria-label="Role badge">—</span>
                </div>
                <div class="settings-profile-meta-row">
                  <div class="settings-profile-meta-item">
                    <span class="settings-profile-meta-label">Department</span>
                    <span class="settings-profile-meta-value">—</span>
                  </div>
                  <div class="settings-profile-meta-item">
                    <span class="settings-profile-meta-label">Position</span>
                    <span class="settings-profile-meta-value">—</span>
                  </div>
                </div>
                <div class="settings-profile-status-row">
                  <span class="settings-profile-status-badge" aria-label="Active status badge">—</span>
                </div>
              </div>
            </div>

            <div class="settings-profile-actions">
              <button 
class="settings-profile-btn settings-profile-btn--ghost" 
type="button"
id="settings-profile-discard">
    Discard Changes
</button>

<button 
class="settings-profile-btn settings-profile-btn--primary" 
type="button"
id="settings-profile-save">
    Save Changes
</button>
            </div>
          </div>

          <div id="settings-profile-loading" class="settings-profile-loading" style="display:block; padding: 0.75rem 0 0;">
            Loading administrator profile...
          </div>
          <div id="settings-profile-error" class="settings-profile-error" style="display:none; padding: 0.75rem 0 0; color: #ff6b6b; font-weight: 600;"></div>

          <div class="settings-profile-grid" style="opacity: 0.6;">
            <div class="settings-profile-card glass">
              <h3 class="settings-profile-card-title">Personal Information</h3>

              <div class="settings-profile-form-grid">
                <div class="settings-profile-form-group">
                  <label>Full Name</label>
                  <input type="text" data-profile-field="full_name" value="Loading..." />
                </div>

                <div class="settings-profile-form-group">
                  <label>Phone</label>
                  <input type="text" data-profile-field="phone" value="—" />
                </div>

                <div class="settings-profile-form-group">
                  <label>Department</label>
                  <input type="text" data-profile-field="department" value="—" />
                </div>

                <div class="settings-profile-form-group">
                  <label>Position</label>
                  <input type="text" data-profile-field="position" value="—" />
                </div>

                <div class="settings-profile-form-group settings-profile-form-group--full">
                  <label>Bio</label>
                  <textarea data-profile-field="bio" rows="4">Loading...</textarea>
                </div>
              </div>
            </div>

            <div class="settings-profile-card glass">
              <h3 class="settings-profile-card-title">Account Information</h3>

              <div class="settings-profile-readonly-grid">
                <div class="settings-profile-readonly-item">
                  <span class="settings-profile-readonly-label">Account Status</span>
                  <strong class="settings-profile-readonly-value" data-profile-field="status">—</strong>
                </div>

                <div class="settings-profile-readonly-item">
                  <span class="settings-profile-readonly-label">Role</span>
                  <strong class="settings-profile-readonly-value" data-profile-field="role">—</strong>
                </div>

                <div class="settings-profile-readonly-item">
                  <span class="settings-profile-readonly-label">Created Date</span>
                  <strong class="settings-profile-readonly-value" data-profile-field="created_at">—</strong>
                </div>

                <div class="settings-profile-readonly-item">
                  <span class="settings-profile-readonly-label">Last Updated</span>
                  <strong class="settings-profile-readonly-value" data-profile-field="updated_at">—</strong>
                </div>
              </div>
            </div>
          </div>

          <div class="settings-profile-back-row">
            <button id="settings-back-btn" class="settings-btn settings-back-btn" type="button" aria-label="Back to enterprise settings">
              ← Back
            </button>
          </div>
        </section>
      `;

      // Load read-only administrator profile data
      const loadingEl = document.getElementById("settings-profile-loading");
      const errorEl = document.getElementById("settings-profile-error");
      const gridEl = panel.querySelector(".settings-profile-grid");

      let originalProfile = null;
      let userId = null;

      let selectedAvatarFile = null;
      let avatarPreviewUrl = null;

      function getProfileFormData() {
        return {
          full_name: panel
            .querySelector('[data-profile-field="full_name"]')
            ?.value.trim(),
          phone: panel
            .querySelector('[data-profile-field="phone"]')
            ?.value.trim(),
          department: panel
            .querySelector('[data-profile-field="department"]')
            ?.value.trim(),
          position: panel
            .querySelector('[data-profile-field="position"]')
            ?.value.trim(),
          bio: panel.querySelector('[data-profile-field="bio"]')?.value.trim(),
        };
      }

      function validateProfile(data) {
        if (!data.full_name) return "Full name is required.";
        if (!data.department) return "Department is required.";
        if (!data.position) return "Position is required.";
        if (!data.bio) return "Bio is required.";
        return null;
      }

      async function loadProfile() {
        try {
          errorEl && (errorEl.style.display = "none");

          const { data: sessionData, error: sessionError } =
            await supabase.auth.getSession();
          if (sessionError) throw sessionError;

          const user = sessionData?.session?.user;
          userId = user?.id;
          if (!userId) throw new Error("No authenticated user");

          const { data: profile, error: profileErr } = await supabase
            .from("profiles")
            .select(
              "id, full_name, email, employee_id, role, department, position, phone, bio, avatar_url, status, created_at, updated_at",
            )
            .eq("id", userId)
            .single();

          if (profileErr) throw profileErr;
          if (!profile) throw new Error("Profile not found");

          originalProfile = { ...profile };
          // Store authenticated user id for save/discard actions
          userId = user?.id;

          // Replace placeholders with profile data

          const nameEl = panel.querySelector(".settings-profile-name");
          if (nameEl) nameEl.textContent = profile.full_name || "—";

          const roleBadgeEl = panel.querySelector(
            ".settings-profile-role-badge",
          );
          if (roleBadgeEl) roleBadgeEl.textContent = profile.role || "—";

          const deptMetaEl = panel.querySelector(
            ".settings-profile-meta-item:nth-child(1) .settings-profile-meta-value",
          );
          if (deptMetaEl) deptMetaEl.textContent = profile.department || "—";

          const posMetaEl = panel.querySelector(
            ".settings-profile-meta-item:nth-child(2) .settings-profile-meta-value",
          );
          if (posMetaEl) posMetaEl.textContent = profile.position || "—";

          const statusEl = panel.querySelector(
            ".settings-profile-status-badge",
          );
          if (statusEl) statusEl.textContent = profile.status || "—";

          panel.querySelectorAll("[data-profile-field]").forEach((el) => {
            const field = el.getAttribute("data-profile-field");
            const value = profile[field];
            const safe = value ?? "—";

            if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
              el.value = String(safe);
            } else {
              el.textContent = String(safe);
            }
          });

          const avatarImg = panel.querySelector("#settings-profile-avatar-img");

          if (profile.avatar_url && avatarImg) {
            avatarImg.src = profile.avatar_url;

            avatarImg.style.display = "block";
          }

          if (loadingEl) loadingEl.style.display = "none";
          if (gridEl) gridEl.style.opacity = "1";
        } catch (err) {
          console.error("Failed to load administrator profile:", err);
          if (loadingEl) loadingEl.style.display = "none";
          if (gridEl) gridEl.style.opacity = "1";
          if (errorEl) {
            errorEl.style.display = "block";
            errorEl.textContent =
              "Unable to load administrator profile. Please try again later.";
          }
        }
      }

      // Kick off async load
      loadProfile();

      const avatarInput = document.getElementById("settings-avatar-input");

      avatarInput?.addEventListener("change", (e) => {
        const file = e.target.files[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
          console.error("Only image files allowed");
          return;
        }

        if (file.size > 2 * 1024 * 1024) {
          console.error("Image must be below 2MB");
          return;
        }

        selectedAvatarFile = file;

        avatarPreviewUrl = URL.createObjectURL(file);

        const img = document.getElementById("settings-profile-avatar-img");

        if (img) {
          img.src = avatarPreviewUrl;

          img.style.display = "block";
        }
      });

      async function uploadAvatar() {
        if (!selectedAvatarFile) return null;

        const fileName = `${userId}-${Date.now()}-${selectedAvatarFile.name}`;

        const { error } = await supabase.storage
          .from("avatars")
          .upload(fileName, selectedAvatarFile, { upsert: true });

        if (error) throw error;

        const { data } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);

        return data.publicUrl;
      }

      // Save / Discard logic
      const saveBtn = document.getElementById("settings-profile-save");
      const discardBtn = document.getElementById("settings-profile-discard");

      if (saveBtn) saveBtn.disabled = false;
      if (discardBtn) discardBtn.disabled = false;

      saveBtn?.addEventListener("click", async () => {
        const formData = getProfileFormData();

        const validationError = validateProfile(formData);
        if (validationError) {
          console.error(validationError);
          return;
        }

        if (!userId) {
          console.error("No userId available for saving profile.");
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";

        try {
          let avatarUrl = originalProfile.avatar_url;

          const uploadedAvatar = await uploadAvatar();

          if (uploadedAvatar) {
            avatarUrl = uploadedAvatar;
          }

          const { error } = await supabase
            .from("profiles")
            .update({
              full_name: formData.full_name,
              phone: formData.phone,
              department: formData.department,
              position: formData.position,
              bio: formData.bio,
              avatar_url: avatarUrl,
              updated_at: new Date(),
            })
            .eq("id", userId);

if (error) throw error;

          // Sync updated profile info to sidebar and enterprise topbar
          window.currentAdmin = window.currentAdmin || {};
          window.currentAdmin.full_name = formData.full_name;
          window.currentAdmin.department = formData.department;
          window.currentAdmin.avatar_url = avatarUrl;

          const sidebarAvatar = document.querySelector(".sidebar-profile .avatar");
          const sidebarName = document.querySelector(".sidebar-profile h4");
          const sidebarRole = document.querySelector(".sidebar-profile p");
          const topbarAvatar = document.querySelector(".enterprise-topbar-user .avatar");
          const topbarName = document.querySelector(".enterprise-topbar-user .name");
          const topbarRole = document.querySelector(".enterprise-topbar-user .role");
          const greetingH1 = document.querySelector(".enterprise-topbar-greeting h1");

          if (sidebarAvatar) {
            if (avatarUrl) sidebarAvatar.innerHTML = `<img src="${avatarUrl}" alt="Admin avatar" />`;
            else sidebarAvatar.textContent = "👤";
          }
          if (sidebarName) sidebarName.textContent = formData.full_name || "Administrator";
          if (sidebarRole) sidebarRole.textContent = formData.department || "Mining Operations";
          if (topbarAvatar) {
            if (avatarUrl) topbarAvatar.innerHTML = `<img src="${avatarUrl}" alt="Admin avatar" />`;
            else topbarAvatar.textContent = "👤";
          }
          if (topbarName) topbarName.textContent = formData.full_name || "Administrator";
          if (topbarRole) topbarRole.textContent = formData.department || "Mining Operations";
          if (greetingH1) greetingH1.textContent = `Good Morning, ${formData.full_name || "Admin"}`;

          window.dispatchEvent(
            new CustomEvent("enterprise-toast", {
              detail: {
                type: "success",
                message: "Profile updated successfully.",
              },
            }),
          );

          originalProfile = {
            ...originalProfile,
            ...formData,
            avatar_url: avatarUrl,
            updated_at: new Date(),
          };
        } catch (err) {
          console.error(err);

          window.dispatchEvent(
            new CustomEvent("enterprise-toast", {
              detail: {
                type: "error",
                message: "Unable to update profile.",
              },
            }),
          );
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = "Save Changes";
        }
      });

      discardBtn?.addEventListener("click", () => {
        if (!originalProfile) return;

        const keysToRestore = [
          "full_name",
          "phone",
          "department",
          "position",
          "bio",
        ];

        keysToRestore.forEach((key) => {
          const field = panel.querySelector(`[data-profile-field="${key}"]`);

          if (field) {
            field.value = originalProfile[key] || "";
          }
        });
      });

      // Back button
      const backBtn = document.getElementById("settings-back-btn");
      backBtn?.addEventListener("click", () => {
        renderLanding();
      });
      return;
    }

    // Default placeholder for all other enterprise settings pages
    panel.innerHTML = `
      <section class="settings-wrap">
        <div class="settings-header settings-header--placeholder">
          <div>
            <h2 class="settings-title">${selected.icon} ${selected.title}</h2>
            <p class="muted settings-subtitle">Placeholder view — backend logic coming in a later phase.</p>
          </div>

          <div class="settings-actions">
            <button id="settings-back-btn" class="settings-btn settings-back-btn" type="button">
              ← Back
            </button>
          </div>
        </div>

        <div class="settings-placeholder card glass">
          <div class="settings-placeholder-icon" aria-hidden="true">${selected.icon}</div>
          <h3 class="settings-placeholder-title">${selected.title}</h3>
          <p class="settings-placeholder-desc muted">
            This is a UI-only placeholder. The “Open” button is fully interactive and will show this view without routing or database calls.
          </p>

          <div class="settings-placeholder-grid">
            <div class="settings-placeholder-block">
              <span class="settings-placeholder-label">Status</span>
              <strong class="settings-placeholder-value">Ready</strong>
            </div>
            <div class="settings-placeholder-block">
              <span class="settings-placeholder-label">Config Scope</span>
              <strong class="settings-placeholder-value">Enterprise</strong>
            </div>
            <div class="settings-placeholder-block">
              <span class="settings-placeholder-label">Mode</span>
              <strong class="settings-placeholder-value">Demo UI</strong>
            </div>
            <div class="settings-placeholder-block">
              <span class="settings-placeholder-label">Next</span>
              <strong class="settings-placeholder-value">Wire backend later</strong>
            </div>
          </div>
        </div>
      </section>
    `;

    const backBtn = document.getElementById("settings-back-btn");
    backBtn?.addEventListener("click", () => {
      renderLanding();
    });
  }

  renderLanding();
  console.log("Settings module loaded successfully");
}
