/**
 * KHING AI - Enterprise Operational Intelligence Engine
 * 
 * This is the entry point for the Admin Dashboard's AI Intelligence panel.
 * It orchestrates the full AI engine pipeline:
 *   1. Operational Metrics Engine (metrics.js)
 *   2. Prediction Engine (prediction.js)
 *   3. Risk Assessment Engine (risk.js)
 *   4. Recommendation Engine (recommendations.js)
 *   5. Admin AI Dashboard UI (dashboard.js)
 * 
 * No worker-scoped logic. All analysis is at the enterprise level.
 * No Gemini/API calls. All calculations are deterministic business rules.
 */

import { fetchOperationalMetrics } from "./admin-modules/ai-engine/metrics.js";
import { runPredictions } from "./admin-modules/ai-engine/prediction.js";
import { calculateOperationalRisk } from "./admin-modules/ai-engine/risk.js";
import { generateRecommendations } from "./admin-modules/ai-engine/recommendations.js";
import { renderAIDashboard, cleanupAIEngine } from "./admin-modules/ai-engine/dashboard.js";

let refreshInterval = null;

/**
 * Initialize the KHING AI Operational Intelligence Engine
 * This replaces the old worker-scoped prediction engine.
 */
export function initAIPredictionEngine() {
  const root = document.getElementById("ai-prediction-root");
  if (!root) {
    console.warn("[AI Engine] Root container (#ai-prediction-root) not found");
    return;
  }

  console.log("[AI Engine] Initializing KHING AI Operational Intelligence Engine...");

  // Run immediately
  runEngine();

  // Refresh every 60 seconds (instead of old 30s)
  cleanupInterval();
  refreshInterval = setInterval(runEngine, 60000);

  // Cleanup on page unload
  window.addEventListener("beforeunload", cleanupEngine);
}

/**
 * Main engine pipeline execution
 */
async function runEngine() {
  const root = document.getElementById("ai-prediction-root");
  if (!root) return;

  try {
    // Show loading state
    root.innerHTML = `
      <div class="khh-ai-loading">
        <div class="khh-ai-loading-spinner"></div>
        <span class="muted">Analyzing operational intelligence...</span>
      </div>
    `;

    // Step 1: Collect operational metrics
    console.log("[AI Engine] Step 1: Fetching operational metrics...");
    const metrics = await fetchOperationalMetrics();

    // Step 2: Run predictions
    console.log("[AI Engine] Step 2: Running predictions...");
    const predictions = runPredictions(metrics);

    // Step 3: Calculate risk assessment
    console.log("[AI Engine] Step 3: Calculating risk assessment...");
    const risk = calculateOperationalRisk(predictions);

    // Step 4: Generate recommendations
    console.log("[AI Engine] Step 4: Generating recommendations...");
    const recommendations = generateRecommendations(predictions, risk, metrics);

    // Step 5: Render the dashboard
    console.log("[AI Engine] Step 5: Rendering dashboard...");
    renderAIDashboard(metrics, predictions, risk, recommendations);

    console.log("[AI Engine] Pipeline complete.");
  } catch (error) {
    console.error("[AI Engine] Pipeline error:", error);
    root.innerHTML = `
      <div class="khh-ai-error">
        <span class="khh-ai-error-icon">⚠️</span>
        <h3>Unable to Load AI Intelligence</h3>
        <p class="muted">${error.message || "An unexpected error occurred. Please try again."}</p>
        <button onclick="location.reload()" class="khh-ai-retry-btn">Retry</button>
      </div>
    `;
  }
}

/**
 * Clean up interval and chart instances
 */
function cleanupEngine() {
  cleanupInterval();
  try {
    cleanupAIEngine();
  } catch (_) {}
}

function cleanupInterval() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

