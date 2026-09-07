import { supabase } from "./supabaseClient.js";

/**
 * WORKFORCE AI OPTIMIZER
 * Schema-safe optimizer (no worker_id dependency)
 */
export async function runWorkforceOptimizer(workforcePanel) {
  const panel = workforcePanel;
  const container = panel?.querySelector("#workforce-ai");

  if (!container) return;


  const { data: tickets } = await supabase
    .from("tickets")
    .select("status");

  const safeTickets = tickets || [];

  const open = safeTickets.filter((t) => t.status === "open").length;
  const inProgress = safeTickets.filter((t) => t.status === "in_progress").length;

  container.innerHTML = `
    <h3>AI Workload Insight</h3>
    <ul>
      <li>Open tasks: ${open}</li>
      <li>In progress: ${inProgress}</li>
      <li>System load: ${open + inProgress > 20 ? "HIGH" : "NORMAL"}</li>
    </ul>
  `;
}

