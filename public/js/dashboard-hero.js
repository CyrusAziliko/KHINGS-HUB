import { supabase } from "./supabaseClient.js";

const HERO_IDS = {
  title: "hero-title",
  subtitle: "hero-subtitle",
  workers: "hero-workers",
  efficiency: "hero-efficiency",
  safety: "hero-safety-reviews",
};

let heroRealtimeChannel = null;
let heroInitialized = false;

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function getGreetingByTime() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function getEfficiencySourceTable() {
  // Explicitly configurable for future backend rule/table integration.
  // If absent, hero must show "Efficiency: N/A" (no fabricated values).
  return window.VAULTDESK_CONFIG?.EFFICIENCY_SOURCE_TABLE || null;
}

export async function loadHeroProfile() {
  try {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) {
      console.error("dashboard-hero: getUser failed", userErr);
      setText(HERO_IDS.title, `${getGreetingByTime()}, User`);
      setText(HERO_IDS.subtitle, "Mining Operations Overview");
      return;
    }

    if (!user) {
      setText(HERO_IDS.title, `${getGreetingByTime()}, User`);
      setText(HERO_IDS.subtitle, "Mining Operations Overview");
      return;
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) {
      console.error("dashboard-hero: profile lookup failed", profileErr);
      setText(HERO_IDS.title, `${getGreetingByTime()}, User`);
      setText(HERO_IDS.subtitle, "Mining Operations Overview");
      return;
    }

    const name = String(profile?.full_name || "").trim() || "User";
    setText(HERO_IDS.title, `${getGreetingByTime()}, ${name}`);
    setText(HERO_IDS.subtitle, "Mining Operations Overview");
  } catch (err) {
    console.error("dashboard-hero: loadHeroProfile failed", err);
    setText(HERO_IDS.title, `${getGreetingByTime()}, User`);
    setText(HERO_IDS.subtitle, "Mining Operations Overview");
  }
}

export async function loadActiveWorkers() {
  setText(HERO_IDS.workers, "—");
  try {
    const { count, error } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "worker");

    if (error) {
      console.error("dashboard-hero: loadActiveWorkers query failed", error);
      setText(HERO_IDS.workers, "N/A");
      return;
    }

    // Premium hero stat expects just the numeric value
    setText(HERO_IDS.workers, `${count ?? 0}`);
  } catch (err) {
    console.error("dashboard-hero: loadActiveWorkers failed", err);
    setText(HERO_IDS.workers, "N/A");
  }
}

export async function loadEfficiency() {
  setText(HERO_IDS.efficiency, "—");
  try {
    const sourceTable = getEfficiencySourceTable();
    if (!sourceTable) {
      setText(HERO_IDS.efficiency, "N/A");
      return;
    }

    // Placeholder backend contract: table has a numeric 'efficiency' field.
    // If this contract is not met, we intentionally display N/A (never fake).
    const { data, error } = await supabase
      .from(sourceTable)
      .select("efficiency")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("dashboard-hero: loadEfficiency query failed", error);
      setText(HERO_IDS.efficiency, "N/A");
      return;
    }

    const value = Number(data?.efficiency);
    if (!Number.isFinite(value)) {
      setText(HERO_IDS.efficiency, "N/A");
      return;
    }

    // Premium hero stat expects just the percentage value
    setText(HERO_IDS.efficiency, `${value.toFixed(1)}%`);
  } catch (err) {
    console.error("dashboard-hero: loadEfficiency failed", err);
    setText(HERO_IDS.efficiency, "N/A");
  }
}

export async function loadSafetyReviews() {
  setText(HERO_IDS.safety, "—");
  try {
    const { count, error } = await supabase
      .from("safety_incidents")
      .select("*", { count: "exact", head: true })
      .eq("status", "Pending");

    if (error) {
      console.error("dashboard-hero: loadSafetyReviews query failed", error);
      setText(HERO_IDS.safety, "N/A");
      return;
    }

    // Premium hero stat expects just the count
    setText(HERO_IDS.safety, `${count ?? 0}`);
  } catch (err) {
    console.error("dashboard-hero: loadSafetyReviews failed", err);
    setText(HERO_IDS.safety, "N/A");
  }
}

function subscribeHeroRealtime() {
  if (heroRealtimeChannel) return;

  const efficiencySourceTable = getEfficiencySourceTable();

  heroRealtimeChannel = supabase
    .channel("dashboard-hero-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "profiles" },
      async () => {
        await Promise.all([loadHeroProfile(), loadActiveWorkers()]);
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "safety_incidents" },
      async () => {
        await loadSafetyReviews();
      },
    );

  if (efficiencySourceTable) {
    heroRealtimeChannel = heroRealtimeChannel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: efficiencySourceTable },
      async () => {
        await loadEfficiency();
      },
    );
  }

  heroRealtimeChannel.subscribe((status) => {
    if (status === "CHANNEL_ERROR") {
      console.error("dashboard-hero realtime channel error");
    }
  });
}

export async function initializeHeroSection() {
  if (heroInitialized) return;
  heroInitialized = true;

  setText(HERO_IDS.title, "Loading...");
  setText(HERO_IDS.subtitle, "Mining Operations Overview");
  setText(HERO_IDS.workers, "Loading...");
  setText(HERO_IDS.efficiency, "Loading...");
  setText(HERO_IDS.safety, "Loading...");

  await Promise.all([
    loadHeroProfile(),
    loadActiveWorkers(),
    loadEfficiency(),
    loadSafetyReviews(),
  ]);

  subscribeHeroRealtime();
}
