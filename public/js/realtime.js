import { supabase } from "./supabaseClient.js";

export function createAnnouncementsSubscription({ onInsert, onUpdate } = {}) {
  const channel = supabase
    .channel("announcements")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "announcements" },
      (payload) => onInsert?.(payload)
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "announcements" },
      (payload) => onUpdate?.(payload)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function createNotificationsSubscription({ userId, onInsert } = {}) {
  if (!userId) throw new Error("createNotificationsSubscription requires userId");

  const channel = supabase
    .channel("notifications")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onInsert?.(payload)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function createTicketsSubscription({ onAny } = {}) {
  const channel = supabase
    .channel("tickets")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tickets" },
      (payload) => onAny?.(payload)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function createActivityFeedTicketsSubscription({ onAny } = {}) {
  const channel = supabase
    .channel("tickets-activity-feed")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "tickets",
      },
      (payload) => onAny?.(payload)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}



export function createTicketMessagesSubscription({ ticketId, onInsert } = {}) {

  if (!ticketId) throw new Error("createTicketMessagesSubscription requires ticketId");

  const channel = supabase
    .channel(`ticket_messages:${ticketId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "ticket_messages",
        filter: `ticket_id=eq.${ticketId}`,
      },
      (payload) => onInsert?.(payload)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

