import { supabase } from "../supabaseClient.js";

function uniqueIds(ids = []) {
  return Array.from(new Set(ids.filter(Boolean)));
}

function toIsoOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function loadProfilesByIds(ids = []) {
  const profileIds = uniqueIds(ids);
  if (profileIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, department, email, status")
    .in("id", profileIds);

  if (error) throw error;

  const map = new Map();
  (data || []).forEach((row) => map.set(row.id, row));
  return map;
}

export async function getCurrentMessagingIdentity() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("Not authenticated.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, department, email, status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) throw new Error("Profile not found for current user.");

  return { user, profile };
}

export async function listUserConversations(userId) {
  const { data: participantRows, error: participantError } = await supabase
    .from("message_participants")
    .select(`
      conversation_id,
      last_read_at,
      joined_at,
      message_conversations (
        id,
        conversation_type,
        title,
        created_by,
        created_at,
        updated_at
      )
    `)
    .eq("user_id", userId);

  if (participantError) throw participantError;

  const ownParticipantRows = participantRows || [];
  const conversationIds = uniqueIds(
    ownParticipantRows
      .map((row) => row.conversation_id)
      .filter(Boolean)
  );

  if (conversationIds.length === 0) return [];

  const { data: allParticipants, error: allParticipantsError } = await supabase
    .from("message_participants")
    .select("conversation_id, user_id, participant_role")
    .in("conversation_id", conversationIds);

  if (allParticipantsError) throw allParticipantsError;

  const { data: allMessages, error: allMessagesError } = await supabase
    .from("message_messages")
    .select("id, conversation_id, sender_id, content, created_at, updated_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false });

  if (allMessagesError) throw allMessagesError;

  const participantIds = uniqueIds((allParticipants || []).map((row) => row.user_id));
  const senderIds = uniqueIds((allMessages || []).map((row) => row.sender_id));
  const profileMap = await loadProfilesByIds([...participantIds, ...senderIds]);

  const participantsByConversation = new Map();
  (allParticipants || []).forEach((row) => {
    if (!participantsByConversation.has(row.conversation_id)) {
      participantsByConversation.set(row.conversation_id, []);
    }
    const profile = profileMap.get(row.user_id) || null;
    participantsByConversation.get(row.conversation_id).push({
      user_id: row.user_id,
      participant_role: row.participant_role,
      profile,
    });
  });

  const latestMessageByConversation = new Map();
  const unreadCountByConversation = new Map();

  ownParticipantRows.forEach((row) => unreadCountByConversation.set(row.conversation_id, 0));

  (allMessages || []).forEach((row) => {
    if (!latestMessageByConversation.has(row.conversation_id)) {
      latestMessageByConversation.set(row.conversation_id, {
        ...row,
        sender_profile: profileMap.get(row.sender_id) || null,
      });
    }
  });

  ownParticipantRows.forEach((row) => {
    const conversationId = row.conversation_id;
    const lastReadAt = toIsoOrNull(row.last_read_at);

    const unread = (allMessages || []).filter((m) => {
      if (m.conversation_id !== conversationId) return false;
      if (m.sender_id === userId) return false;
      if (!lastReadAt) return true;
      const createdAt = toIsoOrNull(m.created_at);
      if (!createdAt) return false;
      return createdAt > lastReadAt;
    }).length;

    unreadCountByConversation.set(conversationId, unread);
  });

  const conversations = ownParticipantRows
    .map((row) => {
      const convo = row.message_conversations;
      if (!convo?.id) return null;
      const participants = participantsByConversation.get(convo.id) || [];
      const lastMessage = latestMessageByConversation.get(convo.id) || null;
      const activityAt = toIsoOrNull(lastMessage?.created_at) || toIsoOrNull(convo.updated_at) || toIsoOrNull(convo.created_at);
      return {
        id: convo.id,
        conversation_type: convo.conversation_type,
        title: convo.title,
        created_by: convo.created_by,
        created_at: convo.created_at,
        updated_at: convo.updated_at,
        last_read_at: row.last_read_at,
        participants,
        last_message: lastMessage,
        unread_count: unreadCountByConversation.get(convo.id) || 0,
        activity_at: activityAt,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const at = new Date(a.activity_at || 0).getTime();
      const bt = new Date(b.activity_at || 0).getTime();
      return bt - at;
    });

  return conversations;
}

export async function loadConversationMessages(conversationId) {
  const { data: messages, error: messageError } = await supabase
    .from("message_messages")
    .select("id, conversation_id, sender_id, content, created_at, updated_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (messageError) throw messageError;

  const senderIds = uniqueIds((messages || []).map((row) => row.sender_id));
  const profileMap = await loadProfilesByIds(senderIds);

  return (messages || []).map((row) => ({
    ...row,
    sender_profile: profileMap.get(row.sender_id) || null,
  }));
}

export async function searchEmployees({ currentUserId, searchText = "", limit = 30 } = {}) {
  const queryText = String(searchText || "").trim();
  let query = supabase
    .from("profiles")
    .select("id, full_name, avatar_url, department, position, email, status")
    .neq("id", currentUserId)
    .order("full_name", { ascending: true })
    .limit(limit);

  if (queryText) {
    query = query.or(
      `full_name.ilike.%${queryText}%,email.ilike.%${queryText}%,department.ilike.%${queryText}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function createConversationWithParticipants({
  createdBy,
  conversationType,
  title = null,
  participantIds = [],
}) {
  const { data: conversation, error: conversationError } = await supabase
    .from("message_conversations")
    .insert({
      conversation_type: conversationType,
      title,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (conversationError) throw conversationError;

  const allIds = uniqueIds([createdBy, ...participantIds]);
  const participantPayload = allIds.map((id) => ({
    conversation_id: conversation.id,
    user_id: id,
    participant_role: id === createdBy ? "owner" : "member",
  }));

  const { error: participantError } = await supabase
    .from("message_participants")
    .insert(participantPayload);

  if (participantError) throw participantError;
  return conversation.id;
}

export async function getOrCreateDirectConversation({ currentUserId, peerUserId }) {
  const { data: ownParticipants, error: ownParticipantsError } = await supabase
    .from("message_participants")
    .select("conversation_id")
    .eq("user_id", currentUserId);

  if (ownParticipantsError) throw ownParticipantsError;

  const candidateConversationIds = uniqueIds((ownParticipants || []).map((row) => row.conversation_id));
  if (candidateConversationIds.length > 0) {
    const { data: directConversations, error: directConversationError } = await supabase
      .from("message_conversations")
      .select("id, conversation_type")
      .in("id", candidateConversationIds)
      .eq("conversation_type", "direct");

    if (directConversationError) throw directConversationError;

    const directIds = uniqueIds((directConversations || []).map((row) => row.id));
    if (directIds.length > 0) {
      const { data: participants, error: participantError } = await supabase
        .from("message_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", directIds);

      if (participantError) throw participantError;

      const membersByConversation = new Map();
      (participants || []).forEach((row) => {
        if (!membersByConversation.has(row.conversation_id)) {
          membersByConversation.set(row.conversation_id, []);
        }
        membersByConversation.get(row.conversation_id).push(row.user_id);
      });

      for (const [conversationId, members] of membersByConversation.entries()) {
        const memberSet = new Set(members);
        if (
          memberSet.size === 2 &&
          memberSet.has(currentUserId) &&
          memberSet.has(peerUserId)
        ) {
          return conversationId;
        }
      }
    }
  }

  return createConversationWithParticipants({
    createdBy: currentUserId,
    conversationType: "direct",
    title: null,
    participantIds: [peerUserId],
  });
}

export async function createGroupConversation({
  currentUserId,
  title,
  memberIds,
}) {
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) throw new Error("Group name is required.");

  const participants = uniqueIds(memberIds).filter((id) => id !== currentUserId);
  if (participants.length < 2) {
    throw new Error("Choose at least 2 coworkers for a group conversation.");
  }

  return createConversationWithParticipants({
    createdBy: currentUserId,
    conversationType: "group",
    title: cleanTitle,
    participantIds: participants,
  });
}

export async function sendConversationMessage({
  conversationId,
  senderId,
  content,
}) {
  const cleanContent = String(content || "").trim();
  if (!cleanContent) throw new Error("Message cannot be empty.");

  const { data, error } = await supabase
    .from("message_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: cleanContent,
    })
    .select("id, conversation_id, sender_id, content, created_at, updated_at")
    .single();

  if (error) throw error;
  return data;
}

export async function updateLastReadAt({
  conversationId,
  userId,
  atIso = new Date().toISOString(),
}) {
  const { error } = await supabase
    .from("message_participants")
    .update({ last_read_at: atIso })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) throw error;
  return true;
}

export async function getProfileSummary(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, department, email, status")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export function subscribeToMessagingRealtime({
  userId,
  onMessageInsert,
  onConversationChange,
  onParticipantChange,
}) {
  const channel = supabase
    .channel(`worker-messages:${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "message_messages" },
      (payload) => onMessageInsert?.(payload.new)
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "message_conversations" },
      (payload) => onConversationChange?.(payload)
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "message_participants",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onParticipantChange?.(payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
