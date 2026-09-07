/**
 * KHING AI - Risk Assessment Engine
 * 
 * Calculates the overall Operational Health Score using weighted
 * assessment of all prediction domains.
 * 
 * Weight Distribution:
 * - Safety: 40%
 * - Work Orders: 30%
 * - Equipment: 20%
 * - Workforce: 10%
 */

const WEIGHTS = {
  safety: 0.40,
  workOrders: 0.30,
  equipment: 0.20,
  workers: 0.10,
};

/**
 * Convert risk score (0-100 where 100 = highest risk) to health score
 * (0-100 where 100 = best health)
 */
function riskToHealth(riskScore) {
  return 100 - riskScore;
}

/**
 * Calculate level label and status based on score
 */
function getScoreLevel(score) {
  if (score >= 90) return { level: "Excellent", status: "Optimal" };
  if (score >= 75) return { level: "Good", status: "Healthy" };
  if (score >= 60) return { level: "Moderate", status: "Stable" };
  if (score >= 40) return { level: "High", status: "At Risk" };
  return { level: "Critical", status: "Critical" };
}

/**
 * Calculate color based on score
 */
function getScoreColor(score) {
  if (score >= 75) return "#22c55e";  // green
  if (score >= 60) return "#eab308";  // yellow
  if (score >= 40) return "#f97316";  // orange
  return "#ef4444";                    // red
}

/**
 * Calculate the overall operational health score
 * @param {Array} predictions - Array of prediction results from prediction.js
 * @returns {Object} Risk assessment result with score, level, status, and breakdown
 */
export function calculateOperationalRisk(predictions) {
  console.log("[AI Engine] Calculating operational risk...");

  // Map predictions by domain for easy lookup
  const predMap = {};
  for (const pred of predictions) {
    predMap[pred.domain] = pred;
  }

  // Calculate weighted health score
  let weightedScore = 0;

  // Safety (40%)
  const safetyHealth = riskToHealth(predMap.safety?.riskScore || 0);
  weightedScore += safetyHealth * WEIGHTS.safety;

  // Work Orders (30%)
  const workOrdersHealth = riskToHealth(predMap.workOrders?.riskScore || 0);
  weightedScore += workOrdersHealth * WEIGHTS.workOrders;

  // Equipment (20%)
  const equipmentHealth = riskToHealth(predMap.equipment?.riskScore || 0);
  weightedScore += equipmentHealth * WEIGHTS.equipment;

  // Workforce (10%)
  const workersHealth = riskToHealth(predMap.workers?.riskScore || 0);
  weightedScore += workersHealth * WEIGHTS.workers;

  // Round to integer
  const score = Math.round(weightedScore);

  // Get level and status
  const { level, status } = getScoreLevel(score);
  const color = getScoreColor(score);

  const result = {
    score,
    level,
    status,
    color,
    breakdown: {
      safety: {
        health: Math.round(riskToHealth(predMap.safety?.riskScore || 0)),
        risk: predMap.safety?.riskScore || 0,
        weight: WEIGHTS.safety,
        contribution: Math.round(safetyHealth * WEIGHTS.safety),
      },
      workOrders: {
        health: Math.round(riskToHealth(predMap.workOrders?.riskScore || 0)),
        risk: predMap.workOrders?.riskScore || 0,
        weight: WEIGHTS.workOrders,
        contribution: Math.round(workOrdersHealth * WEIGHTS.workOrders),
      },
      equipment: {
        health: Math.round(riskToHealth(predMap.equipment?.riskScore || 0)),
        risk: predMap.equipment?.riskScore || 0,
        weight: WEIGHTS.equipment,
        contribution: Math.round(equipmentHealth * WEIGHTS.equipment),
      },
      workers: {
        health: Math.round(riskToHealth(predMap.workers?.riskScore || 0)),
        risk: predMap.workers?.riskScore || 0,
        weight: WEIGHTS.workers,
        contribution: Math.round(workersHealth * WEIGHTS.workers),
      },
    },
  };

  console.log("[AI Engine] Risk assessment complete:", result);
  return result;
}
