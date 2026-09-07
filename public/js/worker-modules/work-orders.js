import { supabase } from "../supabaseClient.js";

const ALLOWED_WORKER_TRANSITIONS = {
  Assigned: "Accepted",
  Accepted: "In Progress",
  "In Progress": "Completed",
};

function getCurrentWorkerId() {
  return window.currentWorker?.id || null;
}

export async function loadMyWorkOrders() {
  const workerId = getCurrentWorkerId();

  if (!workerId) {
    console.warn("loadMyWorkOrders: window.currentWorker.id is not available.");
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("work_orders")
      .select("*")
      .eq("assigned_to", workerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load worker work orders:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Unexpected error while loading worker work orders:", err);
    return [];
  }
}

export async function updateWorkerWorkOrderStatus(id, nextStatus) {
  const workerId = getCurrentWorkerId();

  if (!workerId) {
    throw new Error("updateWorkerWorkOrderStatus: window.currentWorker.id is not available.");
  }

  if (!id) {
    throw new Error("updateWorkerWorkOrderStatus: work order id is required.");
  }

  if (!nextStatus) {
    throw new Error("updateWorkerWorkOrderStatus: next status is required.");
  }

  const { data: currentOrder, error: fetchError } = await supabase
    .from("work_orders")
    .select("id, status, assigned_to")
    .eq("id", id)
    .eq("assigned_to", workerId)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to load current worker work order for status validation:", fetchError);
    throw fetchError;
  }

  if (!currentOrder) {
    throw new Error("Work order not found or not assigned to current worker.");
  }

  const expectedNext = ALLOWED_WORKER_TRANSITIONS[currentOrder.status];
  if (!expectedNext || expectedNext !== nextStatus) {
    throw new Error(
      `Invalid status transition from "${currentOrder.status}" to "${nextStatus}" for worker action.`,
    );
  }

  const { data, error } = await supabase
    .from("work_orders")
    .update({ status: nextStatus })
    .eq("id", id)
    .eq("assigned_to", workerId)
    .select()
    .single();

  if (error) {
    console.error("Failed to update worker work order status:", error);
    throw error;
  }

  return data;
}
