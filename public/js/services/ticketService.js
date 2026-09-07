import { supabase } from "../supabaseClient.js";

function requireUser() {
  return supabase.auth.getUser().then(({ data: { user }, error }) => {
    if (error) throw error;
    if (!user) throw new Error("Not authenticated");
    return user;
  });
}

export function normalizeStatusForDisplay(status) {
  const s = String(status ?? "").trim();
  // tolerate both DB casing variants that already exist in the codebase
  if (!s) return "";
  const lower = s.toLowerCase();
  if (lower === "open") return "Open";
  if (lower === "in progress") return "In Progress";
  if (lower === "in_progress") return "In Progress";
  if (lower === "resolved") return "Resolved";
  if (lower === "closed") return "Closed";
  if (lower === "pending") return "Pending";
  if (lower === "in-progress") return "In Progress";
  return s;
}

export function normalizeStatusForWrite(status) {
  const s = String(status ?? "").trim();
  if (!s) return s;
  const lower = s.toLowerCase();
  // preserve exact strings already used by existing working code where possible
  // Worker create uses "Open" and worker resolve uses "resolved" (lowercase)
  if (lower === "open") return "Open";
  if (lower === "in progress" || lower === "in_progress" || lower === "in-progress") return "In Progress";
  if (lower === "resolved") return "resolved";
  if (lower === "closed") return "Closed";
  return status;
}

export function normalizePriorityForWrite(priority) {
  const p = String(priority ?? "").trim();
  // Worker UI already uses Title Case priorities; keep as-is.
  return p;
}

function getTicketSelectBase() {
  // Only select columns that are already known to exist from existing front-end code.
  return [
    "id",
    "ticket_number",
    "title",
    "description",
    "category",
    "priority",
    "status",
    "worker_id",
    "department",
    "assigned_admin",
    "conversation_id",
    "created_at",
    "updated_at",
  ].join(",");
}

export async function loadTicketList({ role, userId, adminView, filters } = {}) {
  const { limit = 50, search = "" } = filters || {};

  let query = supabase
    .from("tickets")
    .select(getTicketSelectBase())
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!adminView && role !== "admin") {
    query = query.eq("worker_id", userId);
  }

  // status filter
  if (filters?.status) {
    // attempt to match both possible casing conventions by writing the filter as-is;
    // if your DB stores a specific casing/enum, you can adjust in one place later.
    query = query.eq("status", filters.status);
  }

  // priority filter
  if (filters?.priority) {
    query = query.eq("priority", normalizePriorityForWrite(filters.priority));
  }

  // search
  const s = String(search ?? "").trim();
  if (s) {
    // Supabase OR with ilike; keep minimal to avoid schema dependency.
    query = query.or(
      `title.ilike.%${s}%,category.ilike.%${s}%,ticket_number.ilike.%${s}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function loadTicketDetails(ticketId) {
  const { data, error } = await supabase
    .from("tickets")
    .select(getTicketSelectBase())
    .eq("id", ticketId)
    .single();
  if (error) throw error;
  return data;
}

export async function loadConversation(ticketId) {
  // tickets -> conversations -> messages
  const { data: ticket, error: ticketErr } = await supabase
    .from("tickets")
    .select("conversation_id")
    .eq("id", ticketId)
    .single();

  if (ticketErr) throw ticketErr;

  const conversation_id = ticket?.conversation_id;
  if (!conversation_id) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("id,sender,content,attachment_url,created_at,conversation_id")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: true });

  if (error) {
    // fallback: if created_at does not exist, sort by id
    if (String(error?.message || "").toLowerCase().includes("created_at")) {
      const { data: d2, error: e2 } = await supabase
        .from("messages")
        .select("id,sender,content,attachment_url,conversation_id")
        .eq("conversation_id", conversation_id)
        .order("id", { ascending: true });
      if (e2) throw e2;
      return (d2 || []).map((m) => ({
        ...m,
        sender_id: m.sender,
        message: m.content,
      }));
    }
    throw error;
  }

  return (data || []).map((m) => ({
    ...m,
    sender_id: m.sender,
    message: m.content,
  }));
}


export async function createTicket({ title, description, category, priority, attachmentFile } = {}) {
  const user = await requireUser();

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("department")
    .eq("id", user.id)
    .single();
  if (profileErr) throw profileErr;


  const bucket = window.VAULTDESK_CONFIG?.TICKET_ATTACHMENTS_BUCKET;
  let attachment_url = null;

  if (attachmentFile) {
    if (!bucket) throw new Error("Missing TICKET_ATTACHMENTS_BUCKET config");

    const path = `${user.id}/${Date.now()}-${attachmentFile.name}`;
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, attachmentFile, { upsert: true });

    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    attachment_url = pub?.publicUrl || null;
  }

  const payload = {
    title,
    description,
    category,
    priority: normalizePriorityForWrite(priority),
    status: "Open",
    worker_id: user.id,
    department: profile?.department || null,
    assigned_admin: null,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from("tickets")
    .insert(payload)
    .select("id")
    .single();

  if (insertErr) throw insertErr;

  // create a conversation and add the initial message
  let conversation_id = null;
  if (inserted?.id) {
    const { data: conversation, error: convErr } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title: title || `Ticket Conversation`,
      })
      .select("id")
      .single();

    if (convErr) throw convErr;

    conversation_id = conversation?.id;

    // update ticket with the conversation id
    const { error: updErr } = await supabase
      .from("tickets")
      .update({ conversation_id })
      .eq("id", inserted.id);

    if (updErr) throw updErr;

    // insert initial message into public.messages
    const messagePayload = {
      conversation_id,
      sender: user.id,
      content: description,
    };

    if (attachment_url) messagePayload.attachment_url = attachment_url;

    const { error: msgErr } = await supabase.from("messages").insert(messagePayload);
    if (msgErr) throw msgErr;
  }

  // Phase 8.6.2 notifications wiring:
  // createTicket() → notify all admins when a worker creates a ticket.
  try {
    // Notify admins (profiles.role='admin') about the new ticket.
    const { data: admins, error: adminsErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (adminsErr) throw adminsErr;

    const workerId = user.id;
    const message = `Ticket created: ${inserted?.ticket_number || "#" + inserted?.id}`;

    await Promise.all(
      (admins || []).map((a) =>
        createNotification({
          userId: a.id,
          message,
          read_status: false,
          workerId,
        })
      )
    );
  } catch (e) {
    // Non-blocking: keep existing ticket creation behavior unchanged.
    console.error("Notification on ticket create failed", e);
  }

  return inserted;
}



export async function updateTicket({ ticketId, patch } = {}) {
  const payload = { ...patch };
  if (payload.priority) payload.priority = normalizePriorityForWrite(payload.priority);
  if (payload.status) payload.status = normalizeStatusForWrite(payload.status);

  const { error } = await supabase
    .from("tickets")
    .update(payload)
    .eq("id", ticketId);

  if (error) throw error;
  return true;
}

export async function assignTicket({ ticketId, adminId } = {}) {
  const patch = {
    assigned_admin: adminId,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("tickets").update(patch).eq("id", ticketId);
  if (error) throw error;

  // Phase 8.6.2 notifications wiring:
  // assignTicket() → notify worker when a ticket is assigned.
  try {
    const ticket = await loadTicketDetails(ticketId);
    const workerId = ticket?.worker_id;
    if (workerId) {
      await createNotification({
        userId: workerId,
        message: `Ticket assigned: ${ticket?.ticket_number || "#" + ticketId}`,
        read_status: false,
        workerId,
      });
    }
  } catch (e) {
    console.error("Notification on ticket assign failed", e);
  }

  return true;
}


export async function changeStatus({ ticketId, status } = {}) {
  const patch = {
    status: normalizeStatusForWrite(status),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("tickets").update(patch).eq("id", ticketId);
  if (error) throw error;

  // Phase 8.6.2 notifications wiring:
  // changeStatus() → notify worker and assigned admin when status changes.
  try {
    const ticket = await loadTicketDetails(ticketId);
    const workerId = ticket?.worker_id;
    const adminId = ticket?.assigned_admin;

    const normalizedStatus = normalizeStatusForDisplay(ticket?.status);

    const msg = `Ticket status updated to ${normalizedStatus}: ${ticket?.ticket_number || "#" + ticketId}`;

    const tasks = [];
    if (workerId) {
      tasks.push(
        createNotification({
          userId: workerId,
          message: msg,
          read_status: false,
          workerId,
        })
      );
    }
    if (adminId) {
      tasks.push(
        createNotification({
          userId: adminId,
          message: msg,
          read_status: false,
          workerId,
        })
      );
    }

    if (tasks.length) await Promise.all(tasks);
  } catch (e) {
    console.error("Notification on ticket status change failed", e);
  }

  // ── Auto-create follow-up record when ticket is marked as "resolved" ──
  // This ensures the worker receives a follow-up prompt on their dashboard.
  // The existing notification above already notifies them; this adds the
  // interactive follow-up UI.
  try {
    const ticket = await loadTicketDetails(ticketId);
    const newStatus = normalizeStatusForWrite(status);

    // Only create follow-up when transitioning TO "resolved"
    // Prevent duplicate records using ensureFollowUpRecord() (UNIQUE constraint)
    if (newStatus === "resolved" && ticket?.worker_id) {
      await ensureFollowUpRecord({
        ticketId: ticket.id,
        workerId: ticket.worker_id,
      });
    }
  } catch (e) {
    // Non-blocking — follow-up creation failure should not break status change
    console.error("Auto follow-up creation failed", e);
  }

  return true;
}


export async function sendMessage({ ticketId, message, attachmentFile } = {}) {
  const user = await requireUser();

  // fetch ticket conversation_id
  const { data: ticket, error: ticketErr } = await supabase
    .from("tickets")
    .select("conversation_id")
    .eq("id", ticketId)
    .single();

  if (ticketErr) throw ticketErr;

  const conversation_id = ticket?.conversation_id;
  if (!conversation_id) throw new Error("Ticket has no conversation_id");

  let attachment_url = null;
  if (attachmentFile) {
    const bucket = window.VAULTDESK_CONFIG?.TICKET_ATTACHMENTS_BUCKET;
    if (!bucket) throw new Error("Missing TICKET_ATTACHMENTS_BUCKET config");

    const path = `${user.id}/${Date.now()}-${attachmentFile.name}`;
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, attachmentFile, { upsert: true });

    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    attachment_url = pub?.publicUrl || null;
  }

  const messagePayload = {
    conversation_id,
    sender: user.id,
    content: message,
  };

  if (attachment_url) messagePayload.attachment_url = attachment_url;

  const { error } = await supabase.from("messages").insert(messagePayload);

  if (error) throw error;
  return true;
}


export async function createNotification({ userId, message, read_status = false } = {}) {
  if (!userId) return null;

  const payload = {
    user_id: userId,
    message,
    read_status,
  };

  const { error } = await supabase.from("notifications").insert(payload);
  if (error) throw error;
  return true;
}

export async function getAdmins() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name")
    .eq("role", "admin")
    .order("full_name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createTicketNotificationOnCreate({ ticketId } = {}) {
  // Minimal: notify worker (already obvious from ticket.worker_id).
  const ticket = await loadTicketDetails(ticketId);
  const workerId = ticket?.worker_id;
  if (!workerId) return;

  await createNotification({
    userId: workerId,
    message: `Ticket created: ${ticket?.ticket_number || "#" + ticketId}`,
    read_status: false,
  });
}

export async function createTicketNotificationOnAssign({ ticketId } = {}) {
  const ticket = await loadTicketDetails(ticketId);
  const workerId = ticket?.worker_id;
  const adminId = ticket?.assigned_admin;

  await Promise.all([
    createNotification({
      userId: workerId,
      message: `Ticket assigned${ticket?.assigned_admin ? " to an admin" : " update"}: ${ticket?.ticket_number || "#" + ticketId}`,
      read_status: false,
    }),
    createNotification({
      userId: adminId,
      message: `New ticket assigned to you: ${ticket?.ticket_number || "#" + ticketId}`,
      read_status: false,
    }),
  ]);
}

export async function createTicketNotificationOnStatusChange({ ticketId } = {}) {
  const ticket = await loadTicketDetails(ticketId);
  const workerId = ticket?.worker_id;
  const adminId = ticket?.assigned_admin;

  const normalizedStatus = normalizeStatusForDisplay(ticket?.status);

  await Promise.all([
    createNotification({
      userId: workerId,
      message: `Ticket status updated to ${normalizedStatus}: ${ticket?.ticket_number || "#" + ticketId}`,
      read_status: false,
    }),
    createNotification({
      userId: adminId,
      message: `Ticket status updated to ${normalizedStatus}: ${ticket?.ticket_number || "#" + ticketId}`,
      read_status: false,
    }),
  ]);
}

/* =============================(====================================
   TICKET FOLLOW-UP & RESOLUTION CONFIRMATION
   =================================================================
   Added for the "Ticket Follow-Up & Resolution Confirmation" feature.
   All functions are additive — no existing code is modified.
   ================================================================= */

/**
 * Ensure a follow-up record exists for a resolved ticket.
 * Uses UNIQUE(ticket_id) constraint — at most one per ticket.
 * Returns the existing or newly created follow-up row.
 */
export async function ensureFollowUpRecord({ ticketId, workerId } = {}) {
  if (!ticketId || !workerId) throw new Error("ticketId and workerId are required");

  // Check existing
  const { data: existing, error: lookupErr } = await supabase
    .from("ticket_followups")
    .select("id, status, remind_at")
    .eq("ticket_id", ticketId)
    .maybeSingle();

  if (lookupErr) throw lookupErr;
  if (existing) return existing;

  // Create new
  const { data: inserted, error: insertErr } = await supabase
    .from("ticket_followups")
    .insert({
      ticket_id: ticketId,
      worker_id: workerId,
      status: "pending",
    })
    .select("id, status, remind_at")
    .single();

  if (insertErr) throw insertErr;
  return inserted;
}

/**
 * Update a follow-up record's status.
 * Also sets remind_at for 'remind_later' (24 hours from now).
 */
export async function updateFollowUpStatus({ followUpId, status } = {}) {
  if (!followUpId || !status) throw new Error("followUpId and status are required");

  const patch = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "remind_later") {
    // Remind again in 24 hours
    patch.remind_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  const { error } = await supabase
    .from("ticket_followups")
    .update(patch)
    .eq("id", followUpId);

  if (error) throw error;
  return true;
}

/**
 * Fetch pending follow-ups for a worker.
 * Returns follow-ups where:
 *   - status = 'pending', OR
 *   - status = 'remind_later' AND remind_at <= now()
 * Joins with tickets for display data.
 */
export async function getWorkerPendingFollowUps(workerId) {
  if (!workerId) throw new Error("workerId is required");

  const now = new Date().toISOString();
  console.log("[FollowUp.Svc] getWorkerPendingFollowUps called for worker:", workerId);
  console.log("[FollowUp.Svc] now (ISO):", now);

  const { data, error } = await supabase
    .from("ticket_followups")
    .select(`
      id,
      ticket_id,
      worker_id,
      status,
      remind_at,
      updated_at,
      tickets:ticket_id (
        id,
        ticket_number,
        title,
        status,
        priority,
        category,
        updated_at
      )
    `)
    .eq("worker_id", workerId)
    .in("status", ["pending", "remind_later"])
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[FollowUp.Svc] Supabase query error:", error);
    throw error;
  }

  console.log("[FollowUp.Svc] Raw data from Supabase:", data);

  // Filter in JS: return pending immediately, remind_later only if remind_at has passed
  const filtered = (data || []).filter((fu) => {
    if (fu.status === "pending") return true;
    if (fu.status === "remind_later" && fu.remind_at && fu.remind_at <= now) return true;
    return false;
  });

  console.log("[FollowUp.Svc] After JS filter, returning:", filtered?.length, "items", filtered);
  return filtered;
}

/**
 * Mark a follow-up as confirmed and close the ticket.
 * Returns { followUp, ticket } for caller to update UI.
 */
export async function confirmTicketResolution({ followUpId, ticketId } = {}) {
  if (!followUpId || !ticketId) throw new Error("followUpId and ticketId are required");

  // 1. Update follow-up status to 'confirmed'
  await updateFollowUpStatus({ followUpId, status: "confirmed" });

  // 2. Use the existing ticket workflow to close the ticket
  //    "Closed" is the terminal status in the existing system
  await changeStatus({ ticketId, status: "Closed" });

  return true;
}

/**
 * Reopen a ticket from a follow-up.
 * Updates follow-up to 'reopened', sets ticket status back to 'Open',
 * and notifies all admins AND the specifically assigned admin.
 */
export async function reopenTicketFromFollowUp({ followUpId, ticketId } = {}) {
  if (!followUpId || !ticketId) throw new Error("followUpId and ticketId are required");

  // 1. Update follow-up status
  await updateFollowUpStatus({ followUpId, status: "reopened" });

  // 2. Use existing ticket workflow: set status back to "Open"
  await changeStatus({ ticketId, status: "Open" });

  // 3. Notify the assigned admin AND all admins
  try {
    const ticket = await loadTicketDetails(ticketId);
    const assignedAdminId = ticket?.assigned_admin;
    const ticketLabel = ticket?.ticket_number || "#" + ticketId;

    // Notify assigned admin specifically
    if (assignedAdminId) {
      await createNotification({
        userId: assignedAdminId,
        message: `Ticket ${ticketLabel} was reopened by the worker — requires attention.`,
        read_status: false,
      });
    }

    // Notify all admins (in case no specific admin was assigned)
    const admins = await getAdmins();
    const notifiedIds = new Set();
    if (assignedAdminId) notifiedIds.add(assignedAdminId);

    await Promise.all(
      (admins || [])
        .filter((a) => !notifiedIds.has(a.id))
        .map((a) =>
          createNotification({
            userId: a.id,
            message: `Ticket ${ticketLabel} was reopened by the worker and requires review.`,
            read_status: false,
          })
        )
    );
  } catch (e) {
    console.error("Notification on ticket reopen failed", e);
  }

  return true;
}

/**
 * Set a follow-up to 'remind_later'.
 * The record will re-appear when remind_at passes (24 hours).
 */
export async function remindLaterFollowUp({ followUpId } = {}) {
  if (!followUpId) throw new Error("followUpId is required");
  await updateFollowUpStatus({ followUpId, status: "remind_later" });
  return true;
}

