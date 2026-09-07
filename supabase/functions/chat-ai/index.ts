import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      ...(init.headers || {}),
    },
  });
}

function ndjsonHeaders() {
  return {
    ...corsHeaders,
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
  };
}

function extractBearerToken(req: Request) {
  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!auth) return null;
  const parts = auth.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") return parts[1];
  return null;
}

type Role = "user" | "assistant";

type ChatMessage = {
  role: Role;
  content: string;
  created_at?: string;
};

type ChatConversationRow = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string | null;
};

async function requireUser(supabase: any) {
  const { data, error } = await supabase.auth.getUser();
  const user = (data as any)?.user;

  if (error) throw error;
  if (!user) return null;
  return user;
}

async function assertConversationBelongsToUser({
  supabase,
  conversationId,
  userId,
}: {
  supabase: any;
  conversationId: string;
  userId: string;
}) {

  const { data, error } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) return false;
  return true;
}

function buildGeminiContents({
  systemPrompt,
  history,
  userMessage,
}: {
  systemPrompt: string;
  history: ChatMessage[];
  userMessage: string;
}) {
  const context = [...history, { role: "user", content: userMessage }];

  // Gemini role mapping: user -> user, assistant -> model
  const contents = context.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  if (contents.length > 0) {
    const first = contents[0];
    contents[0] = {
      ...first,
      parts: [
        {
          text: `${systemPrompt}\n\n${first.parts?.[0]?.text ?? ""}`,
        },
      ],
    };
  }

  return contents;
}

async function generateGeminiReply({
  GEMINI_API_KEY,
  contents,
}: {
  GEMINI_API_KEY: string;
  contents: any[];
}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    },
  );

  const data = await response.json();
  const reply =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    "Sorry, no response from AI.";
  return reply as string;
}

async function streamReplyAsNDJSON({
  reply,
  supabase,
  userId,
  conversationId,
}: {
  reply: string;
  supabase: any;
  userId: string;
  conversationId: string;
}) {

  const encoder = new TextEncoder();

  const words = reply.split(/(\s+)/);
  let acc = "";

  const streamBody = new ReadableStream({
    async start(controller) {
      // start
      controller.enqueue(encoder.encode(JSON.stringify({ type: "start" }) + "\n"));

      // chunk as word-by-word
      for (const w of words) {
        if (!w) continue;
        acc += w;
        controller.enqueue(encoder.encode(JSON.stringify({ type: "chunk", content: w }) + "\n"));
        // pacing so typing animation is visible
        await new Promise((r) => setTimeout(r, 18));
      }

      // end
      controller.enqueue(encoder.encode(JSON.stringify({ type: "end" }) + "\n"));

      // persist assistant at end
      try {
        const { error: insertError } = await supabase
          .from("chat_messages")
          .insert({
            user_id: userId,
            conversation_id: conversationId,
            role: "assistant",
            content: reply,
          });
        if (insertError) console.error("chat_messages assistant insert error", insertError);
      } catch (e) {
        console.error("assistant persist error", e);
      }

      controller.close();
    },
  });

  return new Response(streamBody, { headers: ndjsonHeaders() });
}

async function maybeGenerateAndSaveTitle({
  supabase,
  userId,
  conversationId,
  GEMINI_API_KEY,
  firstUserMessage,
}: {
  supabase: any;
  userId: string;
  conversationId: string;
  GEMINI_API_KEY: string;
  firstUserMessage: string;
}) {

  const { data: conv, error } = await supabase
    .from("chat_conversations")
    .select("id, title")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!conv) return;
  if (conv.title && conv.title.trim().length > 0) return;

  const titlePrompt =
    "Generate a short conversation title (3 to 6 words) for a mining company assistant. " +
    "Title must be plain text only, no quotes, no punctuation at the end.";

  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `${titlePrompt}\n\nUser message: ${firstUserMessage}`,
        },
      ],
    },
  ];

  const titleRaw = await generateGeminiReply({
    GEMINI_API_KEY,
    contents,
  });

  const title = titleRaw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\n\r]+/g, " ")
    .slice(0, 60);

  const cleaned = title.replace(/[\.!?]+\s*$/g, "").trim();

  const { error: updErr } = await supabase
    .from("chat_conversations")
    .update({ title: cleaned || null })
    .eq("id", conversationId);

  if (updErr) console.error("chat_conversations title update error", updErr);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("SUPABASE_URL or SUPABASE_ANON_KEY is not configured");
    }

    const bearerToken = extractBearerToken(req);
    if (!bearerToken) {
      return jsonResponse({ error: "Missing auth token" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      },
    });

    const payload = await req.json().catch(() => ({}));

    const action: string = payload?.action ?? "send";
    const message: string | null = payload?.message ?? null;
    const conversation_id: string | null = payload?.conversation_id ?? null;
    const title: string | null = payload?.title ?? payload?.rename_title ?? null;
    const query: string | null = payload?.query ?? payload?.search ?? null;
    const stream: boolean = payload?.stream === true;

    if (action === "send" && (!message || typeof message !== "string")) {
      return jsonResponse({ error: "Missing or invalid 'message'" }, { status: 400 });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const user = await requireUser(supabase);
    if (!user) {
      return jsonResponse({ error: "Unauthorized" }, { status: 401 });
    }

    // list_conversations
    if (action === "list_conversations") {
      const { data: convRows, error: convError } = await supabase
        .from("chat_conversations")
        .select("id, title, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (convError) throw convError;

      const conversations = (convRows ?? []).map((c: any) => ({
        id: c.id,
        title: c.title ?? null,
        created_at: c.created_at,
        updated_at: c.updated_at ?? null,
      }));

      return jsonResponse({ conversations });
    }

    // load
    if (action === "load") {
      const convId = conversation_id;
      if (!convId) {
        return jsonResponse({
          reply: "",
          conversation_id: null,
          messages: [],
        });
      }

      const owns = await assertConversationBelongsToUser({
        supabase,
        conversationId: convId,
        userId: user.id,
      });
      if (!owns) {
        return jsonResponse({
          reply: "",
          conversation_id: null,
          messages: [],
        });
      }

      const { data: messageRows, error: msgError } = await supabase
        .from("chat_messages")
        .select("role, content, created_at")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .limit(20);

      if (msgError) throw msgError;

      const messages: ChatMessage[] = (messageRows ?? []).map((r: any) => ({
        role: r.role,
        content: r.content,
        created_at: r.created_at,
      }));

      return jsonResponse({
        reply: "",
        conversation_id: convId,
        messages,
      });
    }

    // rename
    if (action === "rename_conversation") {
      if (!conversation_id) {
        return jsonResponse({ error: "conversation_id is required" }, { status: 400 });
      }
      if (!title || typeof title !== "string") {
        return jsonResponse({ error: "title is required" }, { status: 400 });
      }

      const owns = await assertConversationBelongsToUser({
        supabase,
        conversationId: conversation_id,
        userId: user.id,
      });
      if (!owns) return jsonResponse({ error: "Unauthorized" }, { status: 403 });

      const { error: updErr } = await supabase
        .from("chat_conversations")
        .update({ title })
        .eq("id", conversation_id);

      if (updErr) throw updErr;
      return jsonResponse({ conversation_id, title });
    }

    // delete
    if (action === "delete_conversation") {
      if (!conversation_id) {
        return jsonResponse({ error: "conversation_id is required" }, { status: 400 });
      }

      const owns = await assertConversationBelongsToUser({
        supabase,
        conversationId: conversation_id,
        userId: user.id,
      });
      if (!owns) return jsonResponse({ error: "Unauthorized" }, { status: 403 });

      const { error: delErr } = await supabase
        .from("chat_conversations")
        .delete()
        .eq("id", conversation_id);

      if (delErr) throw delErr;

      return jsonResponse({ conversation_id, deleted: true });
    }

    // search
    if (action === "search_conversations") {
      const q = (query ?? "").toString().trim();
      if (!q) return jsonResponse({ conversations: [] });

      const { data: titleRows, error: titleErr } = await supabase
        .from("chat_conversations")
        .select("id, title, created_at, updated_at")
        .eq("user_id", user.id)
        .or(`title.ilike.%${q}%`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (titleErr) throw titleErr;

      const titleMap = new Map<string, any>();
      (titleRows ?? []).forEach((r: any) => titleMap.set(r.id, r));

      // supplement from messages
      if ((titleRows ?? []).length < 20) {
        const { data: msgRows, error: msgErr } = await supabase
          .from("chat_messages")
          .select("conversation_id")
          .eq("user_id", user.id)
          .ilike("content", `%${q}%`)
          .order("created_at", { ascending: false })
          .limit(200);

        if (msgErr) throw msgErr;

        const convIds = Array.from(new Set((msgRows ?? []).map((m: any) => m.conversation_id))).slice(0, 20);
        if (convIds.length) {
          const { data: convRows, error: convErr } = await supabase
            .from("chat_conversations")
            .select("id, title, created_at, updated_at")
            .eq("user_id", user.id)
            .in("id", convIds)
            .limit(20);

          if (convErr) throw convErr;
          (convRows ?? []).forEach((r: any) => {
            if (!titleMap.has(r.id)) titleMap.set(r.id, r);
          });
        }
      }

      const conversations = Array.from(titleMap.values())
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20)
        .map((c: any) => ({
          id: c.id,
          title: c.title ?? null,
          created_at: c.created_at,
          updated_at: c.updated_at ?? null,
        }));

      return jsonResponse({ conversations });
    }

    // regenerate
    if (action === "regenerate") {
      const convId = conversation_id ?? null;
      if (!convId) {
        return jsonResponse({ error: "conversation_id is required" }, { status: 400 });
      }

      const owns = await assertConversationBelongsToUser({
        supabase,
        conversationId: convId,
        userId: user.id,
      });
      if (!owns) return jsonResponse({ error: "Unauthorized" }, { status: 403 });

      // find last user message
      const { data: lastUserRows, error: lastUserErr } = await supabase
        .from("chat_messages")
        .select("content")
        .eq("conversation_id", convId)
        .eq("role", "user")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (lastUserErr) throw lastUserErr;
      const lastUserMessage = lastUserRows?.[0]?.content as string | undefined;
      if (!lastUserMessage) {
        return jsonResponse({ reply: "No previous user message found.", conversation_id: convId });
      }

      const systemPrompt =
        "You are VaultDesk AI assistant for a mining company system. Be helpful, concise, and professional.";

      const { data: messageRows, error: msgError } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("conversation_id", convId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(20);

      if (msgError) throw msgError;

      const history: ChatMessage[] = (messageRows ?? []).map((r: any) => ({
        role: r.role,
        content: r.content,
      }));

      const contents = buildGeminiContents({
        systemPrompt,
        history: history.filter((m) => m.role === "user" || m.role === "assistant"),
        userMessage: lastUserMessage,
      });

      const reply = await generateGeminiReply({ GEMINI_API_KEY, contents });

      // delete last assistant message (optional): keep simple by inserting new assistant
      const { error: userInsertError } = await supabase
        .from("chat_messages")
        .insert({
          user_id: user.id,
          conversation_id: convId,
          role: "user",
          content: lastUserMessage,
        });
      if (userInsertError) console.error("regenerate user insert error", userInsertError);

      if (!stream) {
        const { error: insertError } = await supabase
          .from("chat_messages")
          .insert({
            user_id: user.id,
            conversation_id: convId,
            role: "assistant",
            content: reply,
          });
        if (insertError) console.error("regenerate assistant insert error", insertError);

        return jsonResponse({ reply, conversation_id: convId });
      }

      // stream mode: persist assistant at end
      return await streamReplyAsNDJSON({
        reply,
        supabase,
        userId: user.id,
        conversationId: convId,
      });
    }

    // send
    if (action === "send") {
      let convId = conversation_id;

      if (!convId) {
        const { data: convData, error: convError } = await supabase
          .from("chat_conversations")
          .insert({ user_id: user.id, title: payload?.title ?? null })
          .select("id")
          .single();

        if (convError) throw convError;
        convId = convData?.id ?? null;
        if (!convId) throw new Error("Failed to create conversation");
      }

      // load history for context
      const { data: messageRows, error: msgError } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("conversation_id", convId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(20);

      if (msgError) throw msgError;

      const history: ChatMessage[] = (messageRows ?? []).map((r: any) => ({
        role: r.role,
        content: r.content,
      }));

      // persist user message first
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        conversation_id: convId,
        role: "user",
        content: message as string,
      });

      // if first message in conversation, generate title
      try {
        const { data: countRows, error: countErr } = await supabase
          .from("chat_messages")
          .select("id", { count: "exact" })
          .eq("conversation_id", convId)
          .eq("user_id", user.id);
        if (!countErr && (countRows as any)?.length === 1) {
          await maybeGenerateAndSaveTitle({
            supabase,
            userId: user.id,
            conversationId: convId,
            GEMINI_API_KEY,
            firstUserMessage: message as string,
          });
        }
      } catch {
        // non-blocking title generation
      }

      const systemPrompt =
        "You are VaultDesk AI assistant for a mining company system. Be helpful, concise, and professional.";

      const contents = buildGeminiContents({
        systemPrompt,
        history,
        userMessage: message as string,
      });

      const reply = await generateGeminiReply({ GEMINI_API_KEY, contents });

      if (!stream) {
        // persist assistant message
        const { error: insertError } = await supabase
          .from("chat_messages")
          .insert({
            user_id: user.id,
            conversation_id: convId,
            role: "assistant",
            content: reply,
          });
        if (insertError) console.error("chat_messages assistant insert error", insertError);

        return jsonResponse({ reply, conversation_id: convId });
      }

      return await streamReplyAsNDJSON({
        reply,
        supabase,
        userId: user.id,
        conversationId: convId,
      });
    }

    return jsonResponse({ error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: errorMessage }, { status: 500 });
  }
});

