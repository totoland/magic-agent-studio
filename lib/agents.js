// lib/agents.js — read/write real Claude Code subagent files in ~/.claude/agents/
//
// Each agent is a Markdown file with YAML frontmatter (name, description, model,
// tools) + a system-prompt body. Studio-only fields (avatar, color, glyph) are
// kept in a sidecar `.studio/meta.json` so the .md files stay clean and remain
// valid Claude Code agent definitions.

import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import matter from "gray-matter";

const AGENTS_DIR = path.join(os.homedir(), ".claude", "agents");
const STUDIO_DIR = path.join(AGENTS_DIR, ".studio");
const META_PATH = path.join(STUDIO_DIR, "meta.json");
const AVATARS_DIR = path.join(STUDIO_DIR, "avatars");
// 2.5D office sprites: drop files in public/assets/sprites/<agentId>/ — no code/meta needed.
// Convention: <state>.png (static) or <state>-1.png, <state>-2.png (animated loop).
const SPRITES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "assets", "sprites");

function discoverSprites(id) {
  let files;
  try { files = fssync.readdirSync(path.join(SPRITES_DIR, id)); } catch { return null; }
  const imgs = files.filter((f) => /\.(png|webp|gif)$/i.test(f));
  if (!imgs.length) return null;
  const groups = {};
  for (const f of imgs) {
    const base = f.replace(/\.(png|webp|gif)$/i, "");
    const m = /^(.+?)-(\d+)$/.exec(base);          // <state>-<frame> | <state>
    const state = m ? m[1] : base;
    const n = m ? parseInt(m[2], 10) : 0;
    (groups[state] ||= []).push({ n, url: `/assets/sprites/${id}/${f}` });
  }
  const sprite = {};
  for (const s in groups) {
    const arr = groups[s].sort((a, b) => a.n - b.n).map((x) => x.url);
    sprite[s] = arr.length === 1 ? arr[0] : arr;   // 1 frame = string, many = loop array
  }
  return sprite;
}

const COLOR_CYCLE = ["amber", "teal", "indigo", "sky", "violet", "rose", "lime"];
// Nice defaults so the first launch already looks intentional.
const DEFAULT_META = {
  "crypto-analyst":    { color: "amber",  glyph: "₿", avatar: { type: "preset", id: "ember" } },
  "knowledge-curator": { color: "teal",   glyph: "◇", avatar: { type: "preset", id: "moss"  } },
  "research-writer":   { color: "indigo", glyph: "✎", avatar: { type: "preset", id: "iris"  } },
  "tech-briefing":     { color: "sky",    glyph: "◆", avatar: { type: "preset", id: "sky"   } },
  "swe-builder":       { color: "violet", glyph: "⚙", avatar: { type: "preset", id: "plum"  } },
};

async function ensureDirs() {
  await fs.mkdir(AGENTS_DIR, { recursive: true });
  await fs.mkdir(AVATARS_DIR, { recursive: true });
}

async function readMeta() {
  try {
    const raw = await fs.readFile(META_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
async function writeMeta(meta) {
  await ensureDirs();
  await fs.writeFile(META_PATH, JSON.stringify(meta, null, 2));
}

// tools frontmatter may be a YAML list OR a comma-separated string — normalize.
function normalizeTools(tools) {
  if (Array.isArray(tools)) return tools.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tools === "string") return tools.split(",").map((t) => t.trim()).filter(Boolean);
  return [];
}

function metaFor(id, meta, index) {
  const m = meta[id] || DEFAULT_META[id] || {};
  return {
    color: m.color || COLOR_CYCLE[index % COLOR_CYCLE.length],
    glyph: m.glyph || "✦",
    avatar: m.avatar || null,
    sprite: m.sprite || null, // { idle, work } image URLs for the Office view
  };
}

// Build the API shape the frontend expects.
function toAgent(id, parsed, meta, index) {
  const fm = parsed.data || {};
  const m = metaFor(id, meta, index);
  return {
    id,
    name: fm.name || id,
    description: fm.description || "",
    model: fm.model || "inherit",
    tools: normalizeTools(fm.tools),
    body: parsed.content.replace(/^\s+/, "").replace(/\s+$/, "") + "\n",
    color: m.color,
    glyph: m.glyph,
    avatar: m.avatar,
    sprite: discoverSprites(id) || m.sprite || null, // folder convention wins; meta is fallback
    status: "idle",
  };
}

export async function listAgents() {
  await ensureDirs();
  const entries = await fs.readdir(AGENTS_DIR, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name)
    .sort();
  const meta = await readMeta();
  const agents = [];
  for (let i = 0; i < files.length; i++) {
    const id = files[i].replace(/\.md$/, "");
    try {
      const raw = await fs.readFile(path.join(AGENTS_DIR, files[i]), "utf8");
      agents.push(toAgent(id, matter(raw), meta, i));
    } catch (err) {
      // skip unreadable file but don't crash the whole list
      console.error(`[agents] failed to read ${files[i]}:`, err.message);
    }
  }
  return agents;
}

export async function getAgent(id) {
  const file = path.join(AGENTS_DIR, `${id}.md`);
  const raw = await fs.readFile(file, "utf8");
  const meta = await readMeta();
  return toAgent(id, matter(raw), meta, 0);
}

// Serialize an agent back to a .md file. Keeps frontmatter minimal & valid:
// model is omitted when "inherit"; tools written as a YAML list.
function serialize({ name, description, model, tools, body }) {
  const data = { name };
  if (description) data.description = description;
  if (model && model !== "inherit") data.model = model;
  const cleanTools = normalizeTools(tools);
  if (cleanTools.length) data.tools = cleanTools;
  const content = "\n" + String(body || "").trim() + "\n";
  return matter.stringify(content, data);
}

// If avatar is an uploaded image (data: URL), persist it to a file and return a
// meta-friendly avatar object pointing at the served path. Presets pass through.
async function persistAvatar(id, avatar) {
  if (!avatar) return null;
  if (avatar.type === "image" && typeof avatar.src === "string" && avatar.src.startsWith("data:")) {
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s.exec(avatar.src);
    if (!m) return null;
    const ext = (m[1].split("/")[1] || "png").replace("jpeg", "jpg").replace("+xml", "");
    await ensureDirs();
    const fname = `${id}.${ext}`;
    await fs.writeFile(path.join(AVATARS_DIR, fname), Buffer.from(m[2], "base64"));
    return { type: "image", src: `/avatars/${fname}?v=${Date.now()}`, scale: avatar.scale || 1, pos: avatar.pos };
  }
  if (avatar.type === "image" && typeof avatar.src === "string") {
    return { type: "image", src: avatar.src, scale: avatar.scale || 1, pos: avatar.pos };
  }
  if (avatar.type === "preset") return { type: "preset", id: avatar.id };
  return null;
}

async function saveMetaFields(id, { color, glyph, avatar }) {
  const meta = await readMeta();
  const prev = meta[id] || {};
  const next = { ...prev };
  if (color) next.color = color;
  if (glyph) next.glyph = glyph;
  if (avatar !== undefined) next.avatar = await persistAvatar(id, avatar);
  meta[id] = next;
  await writeMeta(meta);
}

export async function createAgent(input) {
  await ensureDirs();
  const id = (input.name || "").trim();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error("invalid agent name (use kebab-case)");
  const file = path.join(AGENTS_DIR, `${id}.md`);
  if (fssync.existsSync(file)) throw new Error(`agent "${id}" already exists`);
  await fs.writeFile(file, serialize({ ...input, name: id }));
  await saveMetaFields(id, { color: input.color, glyph: input.glyph, avatar: input.avatar });
  return getAgent(id);
}

export async function updateAgent(id, input) {
  const oldFile = path.join(AGENTS_DIR, `${id}.md`);
  if (!fssync.existsSync(oldFile)) throw new Error(`agent "${id}" not found`);
  const newId = (input.name || id).trim();
  if (newId !== id && !/^[a-z0-9][a-z0-9-]*$/.test(newId)) throw new Error("invalid agent name");
  const targetFile = path.join(AGENTS_DIR, `${newId}.md`);
  if (newId !== id && fssync.existsSync(targetFile)) throw new Error(`agent "${newId}" already exists`);

  await fs.writeFile(targetFile, serialize({ ...input, name: newId }));
  if (newId !== id) {
    await fs.rm(oldFile, { force: true });
    // migrate meta key
    const meta = await readMeta();
    if (meta[id]) { meta[newId] = meta[id]; delete meta[id]; await writeMeta(meta); }
  }
  await saveMetaFields(newId, { color: input.color, glyph: input.glyph, avatar: input.avatar });
  return getAgent(newId);
}

export async function deleteAgent(id) {
  await fs.rm(path.join(AGENTS_DIR, `${id}.md`), { force: true });
  const meta = await readMeta();
  if (meta[id]) { delete meta[id]; await writeMeta(meta); }
  // best-effort avatar cleanup
  try {
    const files = await fs.readdir(AVATARS_DIR);
    for (const f of files) if (f.startsWith(`${id}.`)) await fs.rm(path.join(AVATARS_DIR, f), { force: true });
  } catch {}
  return { ok: true };
}

// Upload one sprite frame for a state → trim transparent margin and save as the
// next frame: public/assets/sprites/<id>/<state>-<n>.png. Returns the updated agent.
export async function addSpriteFrame(id, state, dataB64) {
  if (!/^[a-z0-9_-]+$/i.test(state || "")) throw new Error("invalid state name");
  const mm = /^data:[^;]+;base64,(.*)$/s.exec(dataB64 || "");
  const buf = Buffer.from(mm ? mm[1] : (dataB64 || ""), "base64");
  if (!buf.length) throw new Error("no image data");
  const dir = path.join(SPRITES_DIR, id);
  await fs.mkdir(dir, { recursive: true });
  const existing = fssync.readdirSync(dir).filter((f) => new RegExp(`^${state}-\\d+\\.png$`, "i").test(f));
  const out = path.join(dir, `${state}-${existing.length + 1}.png`);
  try { await sharp(buf).trim().png().toFile(out); }       // auto-trim transparent/uniform border
  catch { await sharp(buf).png().toFile(out); }             // fallback: save as-is
  return getAgent(id);
}

// Remove all frames for a state.
export async function clearSpriteState(id, state) {
  const dir = path.join(SPRITES_DIR, id);
  try {
    for (const f of fssync.readdirSync(dir)) {
      if (new RegExp(`^${state}(-\\d+)?\\.(png|webp|gif)$`, "i").test(f)) await fs.rm(path.join(dir, f), { force: true });
    }
  } catch {}
  return getAgent(id);
}

export async function duplicateAgent(id) {
  const src = await getAgent(id);
  let n = `${src.name}-copy`, i = 2;
  while (fssync.existsSync(path.join(AGENTS_DIR, `${n}.md`))) n = `${src.name}-copy-${i++}`;
  return createAgent({
    name: n, description: src.description, model: src.model,
    tools: src.tools, body: src.body, color: src.color, glyph: src.glyph, avatar: src.avatar,
  });
}

export { AGENTS_DIR, AVATARS_DIR };
