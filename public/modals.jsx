// modals.jsx — New Agent modal, confirm dialog, routine detail view
const { Icon, Btn, Avatar, StatusDot, ModelBadge, AgentAvatar, PresetTile } = window;

function Overlay({ children, onClose }) {
  React.useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6 overlay-in" style={{ background: "rgba(8,6,5,.6)", backdropFilter: "blur(3px)" }} onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

// ── NEW AGENT MODAL ──────────────────────────────────────────────────────────
function NewAgentModal({ onClose, onCreate }) {
  const TEMPLATES = window.STUDIO_DATA.TEMPLATES;
  const PRESETS = window.AVATAR_PRESETS;
  const [tpl, setTpl] = React.useState(TEMPLATES[0]);
  const [name, setName] = React.useState("");
  const [avatar, setAvatar] = React.useState(TEMPLATES[0].seed.avatar || { type: "preset", id: PRESETS[2].id });
  const valid = name.trim().length > 1;
  const previewAgent = { name: name || "new-agent", color: tpl.color, avatar };
  function pickTemplate(tp) { setTpl(tp); if (tp.seed.avatar) setAvatar(tp.seed.avatar); }
  return (
    <Overlay onClose={onClose}>
      <div className="w-[560px] max-w-[92vw] rounded-2xl border shadow-2xl modal-pop overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <div className="flex items-center justify-between px-5 h-14 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-8 h-8 rounded-xl text-white" style={{ background: "linear-gradient(140deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #000))" }}><Icon name="plus" size={17} /></span>
            <div className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>New Agent</div>
          </div>
          <button onClick={onClose} className="grid place-items-center w-8 h-8 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover2)] transition"><Icon name="x" size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* identity */}
          <div className="flex items-center gap-3.5">
            <AgentAvatar agent={previewAgent} size={56} radius={16} />
            <div className="flex-1 space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>Name</label>
              <div className="flex items-center h-10 px-3 rounded-lg border font-mono text-[13px]" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value.replace(/\s+/g, "-").toLowerCase())}
                  placeholder="my-new-agent" className="bg-transparent outline-none w-full" style={{ color: "var(--text)" }} />
                <span style={{ color: "var(--faint)" }}>.md</span>
              </div>
            </div>
          </div>

          {/* avatar gallery */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>Avatar</label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const active = avatar?.type === "preset" && avatar.id === p.id;
                return (
                  <button key={p.id} onClick={() => setAvatar({ type: "preset", id: p.id })}
                    className="rounded-xl transition-transform hover:scale-[1.08]"
                    style={active ? { outline: "2px solid var(--accent)", outlineOffset: 2, borderRadius: 12 } : {}}>
                    <PresetTile preset={p} size={40} radius={11} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>Start from</label>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((t) => {
                const active = tpl.id === t.id;
                const c = window.STUDIO_DATA.AGENT_COLORS[t.color];
                return (
                  <button key={t.id} onClick={() => pickTemplate(t)}
                    className="flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all"
                    style={active
                      ? { borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)", background: "color-mix(in srgb, var(--accent) 9%, transparent)" }
                      : { borderColor: "var(--border)", background: "var(--surface-2)" }}>
                    <span className="grid place-items-center w-8 h-8 rounded-lg shrink-0 font-semibold" style={{ color: c, background: "color-mix(in srgb, " + c + " 16%, transparent)" }}>{t.glyph}</span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium" style={{ color: "var(--text)" }}>{t.name}</div>
                      <div className="text-[11.5px] leading-snug mt-0.5" style={{ color: "var(--muted)" }}>{t.blurb}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 h-16 border-t" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <Btn variant="ghost" size="md" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" size="md" disabled={!valid} onClick={() => onCreate(name.trim(), tpl, avatar)}>
            <Icon name="plus" size={14} /> Create agent
          </Btn>
        </div>
      </div>
    </Overlay>
  );
}

// ── CONFIRM DIALOG ───────────────────────────────────────────────────────────
function ConfirmDialog({ title, body, confirmLabel, onConfirm, onClose, danger }) {
  return (
    <Overlay onClose={onClose}>
      <div className="w-[420px] max-w-[92vw] rounded-2xl border shadow-2xl modal-pop" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className="grid place-items-center w-9 h-9 rounded-xl shrink-0" style={{ background: "color-mix(in srgb, var(--error) 15%, transparent)", color: "var(--error)" }}><Icon name="trash" size={17} /></span>
            <div>
              <div className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>{title}</div>
              <div className="text-[12.5px] leading-relaxed mt-1" style={{ color: "var(--muted)" }}>{body}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 h-16 border-t" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <Btn variant="ghost" size="md" onClick={onClose}>Cancel</Btn>
          <Btn variant={danger ? "danger" : "primary"} size="md" onClick={onConfirm}>{confirmLabel}</Btn>
        </div>
      </div>
    </Overlay>
  );
}

// ── ROUTINE DETAIL VIEW ──────────────────────────────────────────────────────
function RoutineDetail({ routine, agent, onToggle, onRunNow, onBack }) {
  const ok = routine.lastStatus === "success";
  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="max-w-[760px] mx-auto px-7 py-6">
        {/* header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3.5">
            <span className="grid place-items-center w-12 h-12 rounded-2xl shrink-0" style={{ color: routine.enabled ? "var(--accent-fg)" : "var(--muted)", background: routine.enabled ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "var(--surface-2)" }}>
              <Icon name="clock" size={22} />
            </span>
            <div>
              <div className="font-mono text-[17px]" style={{ color: "var(--text)" }}>{routine.name}</div>
              <div className="text-[12.5px] mt-0.5 flex items-center gap-2" style={{ color: "var(--muted)" }}>
                runs {agent && <Avatar agent={agent} size={16} />} <span className="font-mono">{routine.agentId}</span>
              </div>
            </div>
          </div>
          <button onClick={onToggle}
            className="flex items-center gap-2 h-9 px-3 rounded-lg border text-[13px] transition-colors hover:bg-[var(--hover)]"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}>
            <span className="relative h-[18px] w-[30px] rounded-full transition-colors" style={{ background: routine.enabled ? "var(--accent)" : "var(--surface-3)" }}>
              <span className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all shadow" style={{ left: routine.enabled ? 14 : 2 }} />
            </span>
            {routine.enabled ? "Enabled" : "Disabled"}
          </button>
        </div>

        {/* stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { icon: "calendar", k: "Schedule", v: routine.human, mono: false },
            { icon: "clock", k: "Next run", v: routine.enabled ? routine.nextRun : "Paused", mono: false },
            { icon: ok ? "check" : "x", k: "Last run", v: `${routine.lastRunAt} · ${ok ? "success" : "failed"}`, mono: false, ok },
          ].map((s) => (
            <div key={s.k} className="rounded-xl border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider mb-2" style={{ color: "var(--faint)" }}>
                <Icon name={s.icon} size={12} style={s.ok !== undefined ? { color: s.ok ? "var(--success)" : "var(--error)" } : {}} /> {s.k}
              </div>
              <div className="text-[13px]" style={{ color: "var(--text)" }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* cron + target */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <div className="text-[10.5px] uppercase tracking-wider mb-2" style={{ color: "var(--faint)" }}>Cron</div>
            <div className="font-mono text-[14px]" style={{ color: "var(--accent-fg)" }}>{routine.cron}</div>
          </div>
          <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider mb-2" style={{ color: "var(--faint)" }}><Icon name="target" size={12} /> Target</div>
            <div className="text-[13px] font-mono" style={{ color: "var(--text)" }}>{routine.target}</div>
          </div>
        </div>

        {/* prompt */}
        <div className="rounded-xl border overflow-hidden mb-6" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <div className="px-3.5 h-9 flex items-center border-b text-[10.5px] uppercase tracking-wider" style={{ borderColor: "var(--border)", color: "var(--faint)", background: "var(--surface-1)" }}>Prompt</div>
          <div className="p-4 text-[13px] leading-relaxed" style={{ color: "var(--text)", fontFamily: "var(--mono)" }}>{routine.prompt}</div>
        </div>

        <div className="flex items-center gap-2">
          <Btn variant="primary" size="lg" onClick={onRunNow}><Icon name="play" size={14} /> Run now</Btn>
          <Btn variant="outline" size="lg" onClick={onBack}>Back to agent</Btn>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { NewAgentModal, ConfirmDialog, RoutineDetail });
