window.VAULTDESK_CONFIG = {
  // Supabase Project (Single Source of Truth)
  SUPABASE_URL: "https://gnwrfwmtfkhjwzisbeko.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_n2p-GBdLIp7oPqiPauljbQ_SXJJtsxW",

  // Edge Functions (AI layer)
  EDGE_FUNCTIONS: {
    CHAT_AI: "chat-ai",
    GEMINI_CHAT: "gemini-chat"
  },

// Storage buckets
  PROFILE_IMAGE_BUCKET: "avatars",
  STORAGE: {
    TICKET_ATTACHMENTS: "ticket-attachments",
    AVATARS: "avatars",
    PROFILE_IMAGES: "avatars",
    EQUIPMENT: "equipment"
  },

  // Realtime channels
  REALTIME: {
    ANNOUNCEMENTS: "announcements",
    NOTIFICATIONS: "notifications",
    TICKETS: "tickets",
    TICKET_MESSAGES: "ticket_messages",
    CHATBOT: "chatbot_conversations"
  }
};