/**
 * KHING AI - Prediction Engine
 * 
 * Rule-based operational predictions using business rules.
 * No ML/AI API calls. All calculations are deterministic.
 */

/**
 * Analyze work order data and predict workload risk
 */
function predictWorkOrderRisk(metrics) {
  const wo = metrics.workOrders;
  
  // Thresholds
  const HIGH_OPEN_RATIO = 0.5;      // >50% open orders
  const HIGH_OVERDUE_COUNT = 5;      // >5 high priority orders
  const HIGH_UNASSIGNED_RATIO = 0.3; // >30% unassigned

  let riskScore = 0;
  let factors = [];

  // Ratio of open to total orders
  const openRatio = wo.total > 0 ? wo.open / wo.total : 0;
  if (openRatio > HIGH_OPEN_RATIO) {
    riskScore += 35;
    factors.push(`Open work orders at ${Math.round(openRatio * 100)}% of total`);
  }

  // High priority/overdue count
  if (wo.overdue > HIGH_OVERDUE_COUNT) {
    riskScore += 35;
    factors.push(`${wo.overdue} high-priority/critical work orders`);
  }

  // Unassigned ratio
  const unassignedRatio = wo.total > 0 ? wo.unassigned / wo.total : 0;
  if (unassignedRatio > HIGH_UNASSIGNED_RATIO) {
    riskScore += 30;
    factors.push(`${Math.round(unassignedRatio * 100)}% of work orders unassigned`);
  }

  // Determine level
  let level, label;
  if (riskScore >= 60) {
    level = "high";
    label = "High Risk";
  } else if (riskScore >= 30) {
    level = "medium";
    label = "Medium Risk";
  } else {
    level = "low";
    label = "Low Risk";
  }

  return {
    domain: "workOrders",
    title: "Work Orders",
    riskScore: Math.min(riskScore, 100),
    level,
    label,
    factors: factors.length > 0 ? factors : ["Work order load within normal parameters"],
    icon: "📋",
  };
}

/**
 * Analyze safety incident data and predict safety risk
 */
function predictSafetyRisk(metrics) {
  const safety = metrics.safety;

  // Thresholds
  const CRITICAL_THRESHOLD = 2;   // >2 critical incidents
  const OPEN_RATIO_THRESHOLD = 0.4; // >40% open incidents

  let riskScore = 0;
  let factors = [];

  // Critical incidents
  if (safety.critical >= CRITICAL_THRESHOLD) {
    riskScore += 50;
    factors.push(`${safety.critical} critical/high severity incidents`);
  } else if (safety.critical === 1) {
    riskScore += 25;
    factors.push(`${safety.critical} critical incident reported`);
  }

  // Open vs resolved ratio
  const openRatio = safety.total > 0 ? safety.open / safety.total : 0;
  if (openRatio > OPEN_RATIO_THRESHOLD) {
    riskScore += 35;
    factors.push(`${Math.round(openRatio * 100)}% of incidents still open`);
  }

  // Total incidents as a baseline indicator
  if (safety.total > 10) {
    riskScore += 15;
    factors.push(`High volume of incidents (${safety.total} total)`);
  }

  // Determine level
  let level, label;
  if (riskScore >= 60) {
    level = "high";
    label = "High Risk";
  } else if (riskScore >= 25) {
    level = "medium";
    label = "Medium Risk";
  } else {
    level = "low";
    label = "Low Risk";
  }

  return {
    domain: "safety",
    title: "Safety",
    riskScore: Math.min(riskScore, 100),
    level,
    label,
    factors: factors.length > 0 ? factors : ["No significant safety risks detected"],
    icon: "⚠️",
  };
}

/**
 * Analyze equipment data and predict failure/maintenance risk
 */
function predictEquipmentRisk(metrics) {
  const eq = metrics.equipment;

  // Thresholds
  const MAINTENANCE_RATIO_THRESHOLD = 0.25; // >25% in maintenance
  const OFFLINE_RATIO_THRESHOLD = 0.1;       // >10% offline

  let riskScore = 0;
  let factors = [];

  // Maintenance ratio
  const maintenanceRatio = eq.total > 0 ? eq.maintenance / eq.total : 0;
  if (maintenanceRatio > MAINTENANCE_RATIO_THRESHOLD) {
    riskScore += 40;
    factors.push(`${Math.round(maintenanceRatio * 100)}% of equipment requires maintenance`);
  } else if (maintenanceRatio > 0) {
    riskScore += 20;
    factors.push(`${eq.maintenance} equipment items need maintenance`);
  }

  // Offline ratio
  const offlineRatio = eq.total > 0 ? eq.offline / eq.total : 0;
  if (offlineRatio > OFFLINE_RATIO_THRESHOLD) {
    riskScore += 35;
    factors.push(`${Math.round(offlineRatio * 100)}% of equipment is offline`);
  } else if (eq.offline > 0) {
    riskScore += 15;
    factors.push(`${eq.offline} equipment items are offline`);
  }

  // Operational ratio (inverse - fewer operational = higher risk)
  const operationalRatio = eq.total > 0 ? eq.operational / eq.total : 0;
  if (operationalRatio < 0.5 && eq.total > 0) {
    riskScore += 25;
    factors.push(`Only ${Math.round(operationalRatio * 100)}% of equipment operational`);
  }

  // Determine level
  let level, label;
  if (riskScore >= 60) {
    level = "high";
    label = "High Risk";
  } else if (riskScore >= 25) {
    level = "medium";
    label = "Medium Risk";
  } else {
    level = "low";
    label = "Low Risk";
  }

  return {
    domain: "equipment",
    title: "Equipment",
    riskScore: Math.min(riskScore, 100),
    level,
    label,
    factors: factors.length > 0 ? factors : ["Equipment fleet is operational"],
    icon: "🚜",
  };
}

/**
 * Analyze workforce data and predict staffing/allocation risk
 */
function predictWorkerRisk(metrics) {
  const workers = metrics.workers;
  const wo = metrics.workOrders;

  // Thresholds
  const INACTIVE_RATIO_THRESHOLD = 0.2;   // >20% inactive workers
  const LOAD_IMBALANCE_RATIO = 5;          // work orders per worker > 5

  let riskScore = 0;
  let factors = [];

  // Inactive workers ratio
  const inactiveCount = workers.total - workers.active;
  const inactiveRatio = workers.total > 0 ? inactiveCount / workers.total : 0;
  if (inactiveRatio > INACTIVE_RATIO_THRESHOLD) {
    riskScore += 40;
    factors.push(`${inactiveCount} workers inactive (${Math.round(inactiveRatio * 100)}%)`);
  } else if (inactiveCount > 0) {
    riskScore += 20;
    factors.push(`${inactiveCount} workers currently inactive`);
  }

  // Workload per worker
  const activeWorkerLoad = workers.active > 0 ? wo.total / workers.active : 0;
  if (activeWorkerLoad > LOAD_IMBALANCE_RATIO) {
    riskScore += 35;
    factors.push(`Average ${Math.round(activeWorkerLoad)} work orders per active worker`);
  }

  // Unassigned orders indicate allocation issues
  if (wo.unassigned > 3) {
    riskScore += 25;
    factors.push(`${wo.unassigned} work orders unassigned`);
  }

  // Determine level
  let level, label;
  if (riskScore >= 60) {
    level = "high";
    label = "High Risk";
  } else if (riskScore >= 25) {
    level = "medium";
    label = "Medium Risk";
  } else {
    level = "low";
    label = "Low Risk";
  }

  return {
    domain: "workers",
    title: "Workforce",
    riskScore: Math.min(riskScore, 100),
    level,
    label,
    factors: factors.length > 0 ? factors : ["Staffing levels are stable"],
    icon: "👷",
  };
}

/**
 * Run all predictions and return results
 * @param {Object} metrics - Normalized operational metrics from metrics.js
 * @returns {Array} Array of prediction results
 */
export function runPredictions(metrics) {
  console.log("[AI Engine] Running predictions...");

  const predictions = [
    predictWorkOrderRisk(metrics),
    predictSafetyRisk(metrics),
    predictEquipmentRisk(metrics),
    predictWorkerRisk(metrics),
  ];

  console.log("[AI Engine] Predictions complete:", predictions);
  return predictions;
}
