// lib/routines.js — scheduled-routine metadata, persisted locally.
//
// Routines are *remote* scheduled agents (they run in Anthropic's cloud via
// claude.ai). Creating/editing them there needs an OAuth session this local
// server doesn't hold, so Studio treats routines as read-mostly: it shows what's
// scheduled, lets you flip the local enabled flag, run the routine's agent
// locally now, and deep-links to claude.ai for authoritative management.

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const STORE = path.join(os.homedir(), ".claude", "agents", ".studio", "routines.json");

// Seeded from what we actually set up. daily-tech-briefing is a real cloud
// routine; its triggerId/url deep-link to claude.ai.
const SEED = [
  {
    id: "daily-tech-briefing",
    name: "daily-tech-briefing",
    agentId: "tech-briefing",
    cron: "0 1 * * *",
    human: "Daily at 08:00 (Asia/Bangkok)",
    enabled: true,
    nextRun: "Tomorrow, 08:00",
    lastStatus: "success",
    lastRunAt: "Today, 08:00",
    target: "→ Google Drive / Tech Briefings",
    prompt: "Compile today's AI + infrastructure brief from the last ~24h. Rank items, lead with one 'Signal of the day', keep total read under ~90s. Save the markdown into Google Drive / Tech Briefings.",
    triggerId: "trig_01Lodvj3QR9kfLzKnTJYjFPw",
    url: "https://claude.ai/code/routines/trig_01Lodvj3QR9kfLzKnTJYjFPw",
    remote: true,
  },
  {
    id: "morning-crypto-pulse",
    name: "morning-crypto-pulse",
    agentId: "crypto-analyst",
    cron: "30 0 * * 1-5",
    human: "Weekdays at 07:30 (Asia/Bangkok)",
    enabled: false,
    nextRun: "Paused",
    lastStatus: "success",
    lastRunAt: "—",
    target: "→ local run only",
    prompt: "Pre-open read on BTC, ETH and the top mover. Levels, funding, one risk. Keep it under 8 lines.",
    remote: false,
  },
];

async function load() {
  try {
    return JSON.parse(await fs.readFile(STORE, "utf8"));
  } catch {
    await save(SEED);
    return SEED;
  }
}
async function save(routines) {
  await fs.mkdir(path.dirname(STORE), { recursive: true });
  await fs.writeFile(STORE, JSON.stringify(routines, null, 2));
}

export async function listRoutines() {
  return load();
}

export async function setEnabled(id, enabled) {
  const routines = await load();
  const r = routines.find((x) => x.id === id);
  if (!r) throw new Error("routine not found");
  r.enabled = enabled;
  r.nextRun = enabled ? (r.human.includes("Weekdays") ? "Next weekday" : "Tomorrow, 08:00") : "Paused";
  await save(routines);
  return r;
}
