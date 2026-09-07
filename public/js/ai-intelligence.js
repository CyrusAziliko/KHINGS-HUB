import { initAIReport } from "./ai-report.js";

/**
 * KHING AI Intelligence Center Orchestrator
 * 
 * Initializes and coordinates all AI Intelligence modules:
 * 1. AI Daily Operations Report (ai-report.js) - PDF report with risk summary
 * 2. AI Operational Intelligence Engine (ai-prediction-engine.js) - Enterprise dashboard
 * 
 * Both modules run independently and do not conflict.
 */

export function initAIIntelligenceCenter() {
  console.log("[AI Intelligence] Initializing KHING AI Intelligence Center...");

  // Initialize AI Daily Report (existing - for PDF export & daily ops summary)
  initAIReport();

  // Initialize AI Operational Intelligence Engine (new - enterprise dashboard)
  // The engine uses its own root container (#ai-prediction-root) and does not
  // interfere with the AI report container (#ai-report-content).
  initAIPredictionEngine();

  console.log("[AI Intelligence] KHING AI Intelligence Center initialized.");
}

// Dynamically import the prediction engine to avoid circular dependencies
async function initAIPredictionEngine() {
  try {
    const { initAIPredictionEngine: engine } = await import("./ai-prediction-engine.js");
    engine();
  } catch (error) {
    console.warn("[AI Intelligence] Could not load prediction engine:", error.message);
  }
}
