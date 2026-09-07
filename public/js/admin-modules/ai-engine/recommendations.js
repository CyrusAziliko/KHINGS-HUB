/**
 * KHING AI - Recommendation Engine
 * 
 * Generates actionable, prioritized operational recommendations
 * based on the actual risk assessment and prediction data.
 * All recommendations are deterministic and business-rule driven.
 */

/**
 * Generate recommendations based on predictions and risk assessment
 * @param {Array} predictions - Array of prediction results from prediction.js
 * @param {Object} risk - Risk assessment result from risk.js
 * @param {Object} metrics - Operational metrics from metrics.js
 * @returns {Array} Array of recommendation objects sorted by priority
 */
export function generateRecommendations(predictions, risk, metrics) {
  console.log("[AI Engine] Generating recommendations...");

  let recommendations = [];

  // ── Safety Recommendations ──
  const safetyPred = predictions.find(p => p.domain === "safety");
  if (safetyPred && safetyPred.riskScore >= 25) {
    if (metrics.safety.critical >= 2) {
      recommendations.push({
        priority: "critical",
        title: "Address Critical Safety Incidents",
        description: `${metrics.safety.critical} critical incidents require immediate investigation. Conduct root cause analysis and implement corrective actions.`,
        domain: "safety",
      });
    }

    if (metrics.safety.open > metrics.safety.resolved) {
      recommendations.push({
        priority: "high",
        title: "Resolve Pending Safety Incidents",
        description: `More incidents are open (${metrics.safety.open}) than resolved (${metrics.safety.resolved}). Prioritize closure and documentation.`,
        domain: "safety",
      });
    }

    if (safetyPred.riskScore >= 30) {
      recommendations.push({
        priority: "high",
        title: "Increase Safety Monitoring",
        description: "Elevated safety risk detected. Increase inspection frequency and ensure all PPE compliance checks are up to date.",
        domain: "safety",
      });
    }
  }

  // ── Work Order Recommendations ──
  const woPred = predictions.find(p => p.domain === "workOrders");
  if (woPred && woPred.riskScore >= 30) {
    if (metrics.workOrders.highPriority > 3) {
      recommendations.push({
        priority: "high",
        title: "Triage High-Priority Work Orders",
        description: `${metrics.workOrders.highPriority} high-priority/critical work orders need immediate assignment and attention.`,
        domain: "workOrders",
      });
    }

    if (metrics.workOrders.unassigned > 3) {
      recommendations.push({
        priority: "medium",
        title: "Assign Unallocated Work Orders",
        description: `${metrics.workOrders.unassigned} work orders are unassigned. Distribute workload across available team members.`,
        domain: "workOrders",
      });
    }

    if (metrics.workOrders.open > metrics.workOrders.completed) {
      recommendations.push({
        priority: "medium",
        title: "Balance Work Order Throughput",
        description: `Open orders (${metrics.workOrders.open}) exceed completed orders (${metrics.workOrders.completed}). Review workflow bottlenecks.`,
        domain: "workOrders",
      });
    }
  }

  // ── Equipment Recommendations ──
  const eqPred = predictions.find(p => p.domain === "equipment");
  if (eqPred && eqPred.riskScore >= 25) {
    if (metrics.equipment.maintenance > 0) {
      recommendations.push({
        priority: "high",
        title: "Schedule Preventive Maintenance",
        description: `${metrics.equipment.maintenance} equipment items require maintenance. Schedule servicing to prevent operational disruptions.`,
        domain: "equipment",
      });
    }

    if (metrics.equipment.offline > 0) {
      recommendations.push({
        priority: "medium",
        title: "Restore Offline Equipment",
        description: `${metrics.equipment.offline} equipment units are offline. Investigate and prioritize restoration for critical assets.`,
        domain: "equipment",
      });
    }

    if (eqPred.riskScore >= 40) {
      recommendations.push({
        priority: "critical",
        title: "Urgent Equipment Fleet Review",
        description: "Equipment risk is critical. Conduct comprehensive fleet audit and prioritize repairs for high-utilization machinery.",
        domain: "equipment",
      });
    }
  }

  // ── Workforce Recommendations ──
  const workerPred = predictions.find(p => p.domain === "workers");
  if (workerPred && workerPred.riskScore >= 25) {
    const inactiveCount = metrics.workers.total - metrics.workers.active;
    if (inactiveCount > metrics.workers.total * 0.2) {
      recommendations.push({
        priority: "medium",
        title: "Review Worker Availability",
        description: `${inactiveCount} workers are currently inactive. Review schedules and consider shift adjustments to improve coverage.`,
        domain: "workers",
      });
    }

    if (metrics.workOrders.unassigned > 5) {
      recommendations.push({
        priority: "medium",
        title: "Optimize Staff Allocation",
        description: `High volume of unassigned work orders suggests workload imbalance. Review team capacity and redistribute tasks.`,
        domain: "workers",
      });
    }
  }

  // ── General Operational Recommendations ──
  if (risk.score < 60) {
    recommendations.push({
      priority: "high",
      title: "Escalate Operational Review",
      description: `Operational Health Score is ${risk.score}/100. Schedule an operational review meeting to address identified risks.`,
      domain: "general",
    });
  }

  if (risk.score >= 75) {
    recommendations.push({
      priority: "low",
      title: "Maintain Current Operations",
      description: "Operations are in good health. Continue monitoring and maintain current protocols.",
      domain: "general",
    });
  }

  // ── Sort by priority ──
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  console.log("[AI Engine] Recommendations generated:", recommendations.length);
  return recommendations;
}
