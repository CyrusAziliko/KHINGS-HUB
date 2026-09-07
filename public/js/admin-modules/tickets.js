import { supabase } from "../supabaseClient.js";
import { createTicketsSubscription } from "../realtime.js";

import { initTicketsAdminUI } from "./tickets-ui-admin.js";

export async function loadAdminTicketsModule() {
  const root = document.getElementById("admin-tickets");
  if (!root) return;

  // Avoid double-init on repeated navigation clicks
  if (root.dataset.initialized === "true") return;
  root.dataset.initialized = "true";

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;



  const unsubscribe = createTicketsSubscription({
    onAny: async () => {
      try {
        await initTicketsAdminUI(root);
      } catch (e) {
        console.error(e);
      }
    },
  });

  await initTicketsAdminUI(root);

  // cleanup when module is unloaded (simple approach: store cleanup and let caller ignore)
  root.dataset.unsubscribeAttached = "true";
  root.dataset.unsubscribeFn = String(!!unsubscribe);
}

