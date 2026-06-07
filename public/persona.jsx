// persona.jsx — the "soul" editor (Persona tab)
const { Icon, ModelBadge, ToolChip, Btn, useClickOutside, AgentAvatar, AvatarPicker } = window;

function ModelPicker({ value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  const MODELS = window.STUDIO_DATA.MODELS;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-9 px-3 rounded-lg border text-[13px] transition-colors hover:bg-[var(--hover)]"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text)" }}>
        <ModelBadge model={value} />
        <Icon name="chevdown" size={14} style={{ color: "var(--muted)" }} />
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-30 w-60 rounded-xl border p-1 shadow-2xl menu-pop"
          style={{ borderColor: "var(--border)", background: "var(--surface-3)" }}>
          {MODELS.map((m) => (
            <button key={m.id} onClick={() => { onChange(m.id); setOpen(false); }}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--hover2)] transition">
              <div className="flex items-center gap-2.5">
                <ModelBadge model={m.id} />
                <span className="text-[12px]" style={{ color: "var(--muted)" }}>{m.hint}</span>
              </div>
              {value === m.id && <Icon name="check" size={15} style={{ color: "var(--accent-fg)" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolPicker({ selected, onAdd }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const ref = React.useRef(null);
  useClickOutside(ref, () => { setOpen(false); setQ(""); }, open);
  const available = window.STUDIO_DATA.TOOLS.filter(
    (t) => !selected.includes(t) && t.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border border-dashed transition-colors hover:bg-[var(--hover)]"
        style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        <Icon name="plus" size={13} /> add tool
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-30 w-64 rounded-xl border shadow-2xl menu-pop overflow-hidden"
          style={{ borderColor: "var(--border)", background: "var(--surface-3)" }}>
          <div className="flex items-center gap-2 h-9 px-2.5 border-b" style={{ borderColor: "var(--border)" }}>
            <Icon name="search" size={13} style={{ color: "var(--muted)" }} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter tools…"
              className="bg-transparent outline-none text-[12.5px] w-full" style={{ color: "var(--text)" }} />
          </div>
          <div className="max-h-56 overflow-y-auto p-1 scroll-thin">
            {available.map((t) => {
              const mcp = t.startsWith("mcp__");
              return (
                <button key={t} onClick={() => { onAdd(t); setOpen(false); setQ(""); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-[var(--hover2)] transition font-mono text-[12px]"
                  style={{ color: mcp ? "var(--accent-fg)" : "var(--text)" }}>
                  {mcp && <Icon name="wrench" size={12} style={{ opacity: .7 }} />}
                  {mcp ? t.replace(/^mcp__/, "").replace(/__/, " · ") : t}
                </button>
              );
            })}
            {available.length === 0 && <div className="text-center text-[12px] py-4" style={{ color: "var(--faint)" }}>Nothing to add.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>{label}</label>
        {hint && <span className="text-[11px]" style={{ color: "var(--faint)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Office sprite uploader (per state) ───────────────────────────────────────
const SPRITE_STATES = [
  { key: "idle", label: "Idle (default)" }, { key: "work", label: "Working" },
  { key: "thinking", label: "Thinking" }, { key: "talking", label: "Talking" },
  { key: "celebrate", label: "Celebrate" }, { key: "greet", label: "Greet" },
];
function SpriteSettings({ agent, onUpdated }) {
  const [busy, setBusy] = React.useState("");
  const fileRefs = React.useRef({});
  const framesOf = (s) => { const v = agent.sprite && agent.sprite[s]; return v ? (Array.isArray(v) ? v : [v]) : []; };
  const [height, setHeight] = React.useState(agent.spriteHeight ?? "");
  const [savedH, setSavedH] = React.useState(false);
  const heightTimer = React.useRef(null);
  React.useEffect(() => { setHeight(agent.spriteHeight ?? ""); }, [agent.id]);
  async function saveHeight(v) {
    const val = v === undefined ? height : v;
    try {
      const u = await fetch(`/api/agents/${agent.id}/sprite-height`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ height: val === "" ? null : Number(val) }) });
      if (u.ok) { onUpdated(await u.json()); setSavedH(true); setTimeout(() => setSavedH(false), 1300); }
    } catch {}
  }
  function onHeightChange(v) {                 // auto-save 0.5s after the last edit (covers typing + spinner)
    setHeight(v);
    if (heightTimer.current) clearTimeout(heightTimer.current);
    heightTimer.current = setTimeout(() => saveHeight(v), 500);
  }

  async function upload(state, fileList) {
    const files = Array.from(fileList || []); if (!files.length) return;
    setBusy(state);
    for (const f of files) {
      const dataB64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
      try { const u = await fetch(`/api/agents/${agent.id}/sprite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, dataB64 }) }); if (u.ok) onUpdated(await u.json()); } catch {}
    }
    setBusy(""); if (fileRefs.current[state]) fileRefs.current[state].value = "";
  }
  async function clearState(state) {
    setBusy(state);
    try { const u = await fetch(`/api/agents/${agent.id}/sprite?state=${state}`, { method: "DELETE" }); if (u.ok) onUpdated(await u.json()); } catch {}
    setBusy("");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 p-2.5 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <span className="text-[12.5px] font-medium w-24 shrink-0" style={{ color: "var(--text)" }}>Height</span>
        <input type="number" min="8" max="60" value={height} placeholder="32"
          onChange={(e) => onHeightChange(e.target.value)} onBlur={() => saveHeight(height)} onKeyDown={(e) => { if (e.key === "Enter") saveHeight(height); }}
          className="w-16 h-8 px-2 rounded-lg border text-[13px] outline-none" style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text)" }} />
        <span className="text-[12px]" style={{ color: "var(--muted)" }}>vh</span>
        {savedH && <span className="text-[11px] flex items-center gap-1" style={{ color: "var(--success)" }}><Icon name="check" size={12} /> saved</span>}
        <span className="text-[11px]" style={{ color: "var(--faint)" }}>default 32 · front; back ×0.75</span>
      </div>
      {SPRITE_STATES.map(({ key, label }) => {
        const frames = framesOf(key);
        return (
          <div key={key} className="flex items-center gap-3 p-2.5 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <div className="w-24 shrink-0">
              <div className="text-[12.5px] font-medium" style={{ color: "var(--text)" }}>{label}</div>
              <div className="text-[10.5px] font-mono" style={{ color: "var(--faint)" }}>{frames.length} frame{frames.length === 1 ? "" : "s"}</div>
            </div>
            <div className="flex-1 flex flex-wrap items-center gap-1.5 min-h-[44px]">
              {frames.map((url, i) => (
                <span key={i} className="grid place-items-center rounded-lg border overflow-hidden" style={{ width: 38, height: 46, borderColor: "var(--border)", background: "var(--surface-1)" }}>
                  <img src={url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                </span>
              ))}
              {frames.length === 0 && <span className="text-[11.5px]" style={{ color: "var(--faint)" }}>no sprite → falls back to idle</span>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input ref={(el) => (fileRefs.current[key] = el)} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(key, e.target.files)} />
              <button onClick={() => fileRefs.current[key] && fileRefs.current[key].click()} disabled={busy === key}
                className="flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-[var(--hover)] disabled:opacity-40" style={{ borderColor: "var(--border)", color: "var(--accent-fg)" }}>
                <Icon name="plus" size={13} /> {busy === key ? "…" : "Add"}
              </button>
              {frames.length > 0 && (
                <button onClick={() => clearState(key)} disabled={busy === key} title="Remove all frames"
                  className="grid place-items-center w-8 h-8 rounded-lg text-[var(--muted)] hover:text-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error)_12%,transparent)] transition"><Icon name="trash" size={14} /></button>
              )}
            </div>
          </div>
        );
      })}
      <div className="text-[11px] leading-relaxed" style={{ color: "var(--faint)" }}>
        Upload transparent PNGs (full body, feet at bottom-center). Margins auto-trimmed. 2+ frames = animated loop (ping-pong). Saved to <span className="font-mono">sprites/{agent.id}/</span>.
      </div>
    </div>
  );
}

function PersonaTab({ agent, draft, setDraft, dirty, onSave, onRevert, onSpriteUpdated }) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [promptOpen, setPromptOpen] = React.useState(false); // system prompt collapsed by default
  const [spritesOpen, setSpritesOpen] = React.useState(false);
  React.useEffect(() => { setPickerOpen(false); setPromptOpen(false); setSpritesOpen(false); }, [agent.id]);
  const avatarAgent = { name: draft.name, color: agent.color, avatar: draft.avatar };
  const charCount = draft.body.length;
  const inputCls = "w-full h-9 px-3 rounded-lg border text-[13px] outline-none transition-colors focus:border-[color-mix(in_srgb,var(--accent)_55%,transparent)]";
  const inputStyle = { borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text)" };

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="max-w-[760px] mx-auto px-7 py-6 space-y-6">
        {/* file path + save bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 font-mono text-[12px] px-2.5 py-1.5 rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--muted)" }}>
            <Icon name="doc" size={13} style={{ color: "var(--faint)" }} />
            ~/.claude/agents/<span style={{ color: "var(--accent-fg)" }}>{draft.name || "untitled"}</span>.md
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] flex items-center gap-1.5 mr-1" style={{ color: dirty ? "var(--running)" : "var(--muted)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: dirty ? "var(--running)" : "var(--success)" }} />
              {dirty ? "Unsaved changes" : "All changes saved"}
            </span>
            <Btn variant="outline" size="md" onClick={onRevert} disabled={!dirty}><Icon name="revert" size={14} /> Revert</Btn>
            <Btn variant="primary" size="md" onClick={onSave} disabled={!dirty}><Icon name="save" size={14} /> Save</Btn>
          </div>
        </div>

        {/* identity: avatar + name / model / description */}
        <div className="flex items-start gap-5">
          <div className="relative shrink-0">
            <button onClick={() => setPickerOpen((o) => !o)} className="group relative block rounded-[18px]" title="Change avatar">
              <AgentAvatar agent={avatarAgent} size={76} radius={18} />
              <span className="absolute inset-0 grid place-items-center rounded-[18px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,.45)", color: "#fff" }}>
                <Icon name="camera" size={20} />
              </span>
            </button>
            {pickerOpen && (
              <AvatarPicker agent={avatarAgent}
                onPick={(av) => { setDraft({ ...draft, avatar: av }); setPickerOpen(false); }}
                onClose={() => setPickerOpen(false)} />
            )}
          </div>
          <div className="flex-1 grid grid-cols-[1fr_auto] gap-x-4 gap-y-3.5">
            <Field label="Name" hint="kebab-case id">
              <input className={inputCls} style={inputStyle} value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value.replace(/\s+/g, "-").toLowerCase() })} />
            </Field>
            <Field label="Model">
              <ModelPicker value={draft.model} onChange={(m) => setDraft({ ...draft, model: m })} />
            </Field>
            <div className="col-span-2">
              <Field label="Description" hint="when to use this agent">
                <input className={inputCls} style={inputStyle} value={draft.description}
                  placeholder="One line on when the router should pick this agent…"
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
            </div>
          </div>
        </div>

        {/* tools */}
        <Field label="Tools" hint={`${draft.tools.length} granted`}>
          <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            {draft.tools.map((t) => (
              <ToolChip key={t} tool={t} onRemove={() => setDraft({ ...draft, tools: draft.tools.filter((x) => x !== t) })} />
            ))}
            <ToolPicker selected={draft.tools} onAdd={(t) => setDraft({ ...draft, tools: [...draft.tools, t] })} />
          </div>
        </Field>

        {/* system prompt — collapsed by default; click to edit */}
        <Field label="System prompt" hint="the agent’s soul">
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <button type="button" onClick={() => setPromptOpen((o) => !o)}
              className="flex w-full items-center justify-between px-3 h-9 border-b transition-colors hover:bg-[var(--hover)]"
              style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
              <span className="flex items-center gap-2">
                <Icon name="chevron" size={14} style={{ color: "var(--muted)", transform: promptOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                <span className="text-[10.5px] font-mono uppercase tracking-wider" style={{ color: "var(--faint)" }}>markdown</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-[11px] font-mono tabular-nums" style={{ color: charCount > 1800 ? "var(--running)" : "var(--muted)" }}>{charCount.toLocaleString()} chars</span>
                <span className="text-[11px] font-medium" style={{ color: "var(--accent-fg)" }}>{promptOpen ? "Hide" : "Edit"}</span>
              </span>
            </button>
            {promptOpen ? (
              <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                spellCheck={false} autoFocus
                className="w-full resize-y outline-none p-4 leading-[1.65] scroll-thin"
                style={{ minHeight: 320, fontFamily: "var(--mono)", fontSize: 13, color: "var(--text)", background: "transparent" }} />
            ) : (
              <button type="button" onClick={() => setPromptOpen(true)}
                className="block w-full text-left px-4 py-3 transition-colors hover:bg-[var(--hover)]"
                style={{ maxHeight: 84, overflow: "hidden" }}>
                <span className="font-mono text-[12.5px] leading-[1.6] whitespace-pre-wrap" style={{ color: "var(--muted)" }}>
                  {draft.body.trim() ? draft.body.trim().slice(0, 200) + (draft.body.trim().length > 200 ? " …" : "") : "Empty — click to write the system prompt…"}
                </span>
              </button>
            )}
          </div>
        </Field>

        {/* office sprites — upload/animation per state */}
        <Field label="Office sprites" hint="2.5D animation per state">
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <button type="button" onClick={() => setSpritesOpen((o) => !o)}
              className="flex w-full items-center justify-between px-3 h-9 border-b transition-colors hover:bg-[var(--hover)]"
              style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
              <span className="flex items-center gap-2">
                <Icon name="chevron" size={14} style={{ color: "var(--muted)", transform: spritesOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                <span className="text-[12px]" style={{ color: "var(--muted)" }}>upload images / animation for the Office view</span>
              </span>
              <span className="text-[11px] font-medium" style={{ color: "var(--accent-fg)" }}>{spritesOpen ? "Hide" : "Edit"}</span>
            </button>
            {spritesOpen && <div className="p-3"><SpriteSettings agent={agent} onUpdated={onSpriteUpdated} /></div>}
          </div>
        </Field>
      </div>
    </div>
  );
}

Object.assign(window, { PersonaTab });
