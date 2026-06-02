// sidebar.jsx — left rail: agent roster + scheduled routines
const { Icon, StatusDot, ModelBadge, Avatar, Btn, useClickOutside } = window;

function RowMenu({ onDuplicate, onDelete }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="grid place-items-center w-7 h-7 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover2)] transition opacity-0 group-hover/row:opacity-100 data-[on=true]:opacity-100"
        data-on={open} title="More">
        <Icon name="dots" size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-30 w-40 rounded-xl border p-1 shadow-2xl menu-pop"
          style={{ borderColor: "var(--border)", background: "var(--surface-3)" }}>
          <button onClick={(e) => { e.stopPropagation(); setOpen(false); onDuplicate(); }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[var(--text)] hover:bg-[var(--hover2)] transition">
            <Icon name="copy" size={14} /> Duplicate
          </button>
          <button onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error)_14%,transparent)] transition">
            <Icon name="trash" size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function AgentRow({ agent, active, onSelect, onDuplicate, onDelete }) {
  return (
    <div onClick={onSelect}
      className="group/row relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 cursor-pointer transition-colors"
      style={active
        ? { background: "color-mix(in srgb, var(--accent) 13%, transparent)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 28%, transparent)" }
        : {}}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--hover)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full" style={{ background: "var(--accent)" }} />}
      <Avatar agent={agent} size={34} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] truncate" style={{ color: "var(--text)" }}>{agent.name}</span>
          <StatusDot status={agent.status} />
        </div>
        <div className="text-[11.5px] truncate mt-0.5" style={{ color: "var(--muted)" }}>{agent.description}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <ModelBadge model={agent.model} />
        <RowMenu onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>
    </div>
  );
}

function RoutineRow({ routine, agent, active, onSelect, onToggle }) {
  const ok = routine.lastStatus === "success";
  return (
    <div onClick={onSelect}
      className="group/r flex items-center gap-2.5 rounded-xl px-2.5 py-2 cursor-pointer transition-colors"
      style={active ? { background: "color-mix(in srgb, var(--accent) 12%, transparent)" } : {}}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--hover)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
      <span className="grid place-items-center w-7 h-7 rounded-lg shrink-0"
        style={{ color: routine.enabled ? "var(--accent-fg)" : "var(--muted)",
          background: routine.enabled ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "var(--surface-2)" }}>
        <Icon name="clock" size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[12px] truncate" style={{ color: "var(--text)" }}>{routine.name}</div>
        <div className="text-[10.5px] truncate mt-0.5" style={{ color: "var(--muted)" }}>{routine.human}</div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="relative h-[18px] w-[30px] rounded-full transition-colors shrink-0"
        style={{ background: routine.enabled ? "var(--accent)" : "var(--surface-3)" }} title={routine.enabled ? "Enabled" : "Disabled"}>
        <span className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all shadow"
          style={{ left: routine.enabled ? 14 : 2 }} />
      </button>
    </div>
  );
}

function Sidebar({ agents, routines, selId, selKind, onSelectAgent, onSelectRoutine,
                   onNewAgent, onDuplicate, onDelete, onToggleRoutine, query }) {
  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase()) ||
    a.description.toLowerCase().includes(query.toLowerCase()));
  const running = agents.filter((a) => a.status === "running").length;

  return (
    <aside className="flex flex-col h-full border-r shrink-0" style={{ width: 304, borderColor: "var(--border)", background: "var(--surface-1)" }}>
      {/* roster header */}
      <div className="flex items-center justify-between px-3.5 pt-4 pb-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>Agents</span>
        <span className="text-[10.5px] font-mono px-1.5 py-0.5 rounded" style={{ color: "var(--muted)", background: "var(--surface-2)" }}>{running} running</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5 scroll-thin">
        {filtered.map((a) => (
          <AgentRow key={a.id} agent={a} active={selKind === "agent" && selId === a.id}
            onSelect={() => onSelectAgent(a.id)}
            onDuplicate={() => onDuplicate(a.id)} onDelete={() => onDelete(a.id)} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-[12px] py-8" style={{ color: "var(--faint)" }}>No agents match “{query}”.</div>
        )}
      </div>

      {/* new agent */}
      <div className="px-3 py-2.5">
        <button onClick={onNewAgent}
          className="flex w-full items-center justify-center gap-2 h-9 rounded-lg border border-dashed text-[13px] font-medium transition-all hover:border-solid"
          style={{ borderColor: "color-mix(in srgb, var(--accent) 40%, var(--border))", color: "var(--accent-fg)",
            background: "color-mix(in srgb, var(--accent) 7%, transparent)" }}>
          <Icon name="plus" size={15} /> New Agent
        </button>
      </div>

      {/* routines */}
      <div className="border-t px-2 pt-2.5 pb-3 shrink-0" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <div className="flex items-center gap-1.5 px-1.5 pb-1.5">
          <Icon name="calendar" size={12} style={{ color: "var(--faint)" }} />
          <span className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>Scheduled Routines</span>
        </div>
        <div className="space-y-0.5">
          {routines.map((r) => (
            <RoutineRow key={r.id} routine={r} agent={agents.find((a) => a.id === r.agentId)}
              active={selKind === "routine" && selId === r.id}
              onSelect={() => onSelectRoutine(r.id)} onToggle={() => onToggleRoutine(r.id)} />
          ))}
        </div>
      </div>
    </aside>
  );
}

Object.assign(window, { Sidebar });
