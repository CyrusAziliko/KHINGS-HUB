import { supabase } from "../supabaseClient.js";

export function setupLogout() {
  const btn = document.querySelector("[data-logout]");
  if (!btn) return;

  btn.onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "./Page.html";
  };
}

