// run.jsx — Run tab, live streaming right panel, Activity tab
const { Icon, Btn, Avatar, StatusDot, mdInline, mdToHtml } = window;

// Copy-to-clipboard button (copies the raw markdown so it re-pastes cleanly)
function CopyBtn({ text, label = "Copy" }) {
  const [copied, setCopied] = React.useState(false);
  const onCopy = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1400); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(done);
    else done();
  };
  return (
    <button onClick={onCopy} title="Copy result as markdown"
      className="flex items-center gap-1 text-[10.5px] rounded-md px-1.5 py-0.5 transition-colors hover:bg-[var(--hover2)]"
      style={{ color: copied ? "var(--success)" : "var(--muted)" }}>
      <Icon name={copied ? "check" : "copy"} size={12} /> {copied ? "Copied" : label}
    </button>
  );
}

// ── RUN TAB ──────────────────────────────────────────────────────────────────
function RunTab({ agent, task, setTask, running, onRun, onStop, onOpenPanel, panelOpen, injectContext, setInjectContext, contextInfo }) {
  const suggestions = {
    "crypto-analyst": ["Give me a read on BTC right now", "Is the alt move real or leverage?", "Top mover in the last 24h + why"],
    "knowledge-curator": ["Tidy the AI shelf and fix orphans", "Index this week's new notes", "Merge duplicate RAG notes"],
    "research-writer": ["Compare RAG vs fine-tuning, cited", "What changed in EU AI Act 2026?", "Brief me on small language models"],
    "tech-briefing": ["Run today's brief", "Just the infra stories today", "What's the signal of the day?"],
    "swe-builder": ["Fix the stream backpressure bug", "Add a test for the cron parser", "Why is the build failing?"],
  }[agent.id] || ["Describe the task…"];

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="max-w-[760px] mx-auto px-7 py-6">
        <div className="flex items-center gap-3 mb-5">
          <Avatar agent={agent} size={40} />
          <div>
            <div className="font-mono text-[15px]" style={{ color: "var(--text)" }}>{agent.name}</div>
            <div className="text-[12.5px]" style={{ color: "var(--muted)" }}>{agent.description}</div>
          </div>
        </div>

        {/* task composer */}
        <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <textarea value={task} onChange={(e) => setTask(e.target.value)}
            placeholder={`What should ${agent.name} do?`} disabled={running}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !running) onRun(); }}
            className="w-full resize-none outline-none bg-transparent px-2 pt-1.5 leading-relaxed scroll-thin"
            style={{ minHeight: 76, fontSize: 14, color: "var(--text)" }} />
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3 pl-2">
              <span className="text-[11px] font-mono" style={{ color: "var(--faint)" }}>⌘↵ to run</span>
              <button type="button" onClick={() => setInjectContext((v) => !v)} disabled={running}
                title="Already auto-loaded via ~/.claude/CLAUDE.md. Toggle ON only to re-inject/emphasize team context as a cached prefix (costs ~377 extra tok)."
                className="flex items-center gap-1.5 text-[11px] rounded-lg px-2 py-1 border transition-colors disabled:opacity-40"
                style={{ borderColor: "var(--border)",
                  color: injectContext ? "var(--accent-fg)" : "var(--muted)",
                  background: injectContext ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: injectContext ? "var(--accent)" : "var(--faint)" }} />
                🧠 team context {injectContext ? "on" : "off"}
                {injectContext && contextInfo?.available && (
                  <span className="font-mono" style={{ color: "var(--faint)" }}>· ~{contextInfo.tokensEstimate} tok</span>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {!panelOpen && (
                <Btn variant="subtle" size="md" onClick={onOpenPanel}><Icon name="panel" size={14} /> Show output</Btn>
              )}
              {running
                ? <Btn variant="danger" size="md" onClick={onStop}><Icon name="stop" size={13} /> Stop</Btn>
                : <Btn variant="primary" size="md" onClick={onRun} disabled={!task.trim()}><Icon name="play" size={13} /> Run</Btn>}
            </div>
          </div>
        </div>

        {/* suggestion chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          {suggestions.map((s) => (
            <button key={s} disabled={running} onClick={() => setTask(s)}
              className="text-[12px] px-3 py-1.5 rounded-lg border transition-colors hover:bg-[var(--hover)] disabled:opacity-40"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{s}</button>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2 text-[12px]" style={{ color: "var(--faint)" }}>
          <Icon name="bolt" size={13} />
          Runs with <span className="font-mono" style={{ color: "var(--muted)" }}>{agent.model}</span> · {agent.tools.length} tools granted · output streams to the right panel.
        </div>
      </div>
    </div>
  );
}

// ── EVENT (single timeline node) ─────────────────────────────────────────────
function EventNode({ ev, last }) {
  const statusColor = { pending: "var(--running)", done: "var(--success)", error: "var(--error)" }[ev.state] || "var(--muted)";
  if (ev.kind === "start") {
    return (
      <div className="event-in flex items-start gap-3">
        <span className="grid place-items-center w-6 h-6 rounded-lg shrink-0 mt-0.5" style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent-fg)" }}><Icon name="bolt" size={13} /></span>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: "var(--faint)" }}>Task</div>
          <div className="text-[13px]" style={{ color: "var(--text)" }}>{ev.text}</div>
        </div>
      </div>
    );
  }
  if (ev.kind === "thinking") {
    return (
      <div className="event-in relative pl-9">
        <span className="absolute left-[10px] top-1 w-2 h-2 rounded-full" style={{ background: "var(--surface-3)", border: "1.5px solid var(--border)" }} />
        {!last && <span className="absolute left-[13.5px] top-3 bottom-[-14px] w-px" style={{ background: "var(--border)" }} />}
        <div className="text-[12.5px] italic leading-relaxed" style={{ color: "var(--muted)" }}>{ev.text}</div>
      </div>
    );
  }
  if (ev.kind === "result") {
    return (
      <div className="event-in pl-9 relative">
        <span className="absolute left-1 top-0.5 grid place-items-center w-5 h-5 rounded-md" style={{ background: "color-mix(in srgb, var(--success) 18%, transparent)", color: "var(--success)" }}><Icon name="check" size={13} /></span>
        <div className="rounded-xl border p-3.5" style={{ borderColor: "color-mix(in srgb, var(--success) 28%, var(--border))", background: "color-mix(in srgb, var(--success) 6%, var(--surface-2))" }}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold" style={{ color: "var(--success)" }}>Result</div>
            <CopyBtn text={ev.text} />
          </div>
          <div className="md-body" dangerouslySetInnerHTML={{ __html: mdToHtml(ev.text) }} />
        </div>
      </div>
    );
  }
  // tool call
  return (
    <div className="event-in relative pl-9">
      <span className="absolute left-[7px] top-0.5 grid place-items-center w-[18px] h-[18px] rounded-md text-[11px]" style={{ background: "var(--surface-3)" }}>{ev.icon}</span>
      {!last && <span className="absolute left-[15.5px] top-[22px] bottom-[-14px] w-px" style={{ background: "var(--border)" }} />}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[12.5px]" style={{ color: "var(--text)" }}>{ev.label}</span>
        {ev.arg && <span className="font-mono text-[12px] px-1.5 py-0.5 rounded" style={{ background: "var(--surface-3)", color: "var(--accent-fg)" }}>{ev.arg}</span>}
        <span className="flex-1" />
        {ev.state === "pending"
          ? <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin shrink-0" style={{ borderColor: "var(--border)", borderTopColor: "var(--running)" }} />
          : <span className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>{ev.result}</span>}
        <span className="font-mono text-[10.5px] tabular-nums" style={{ color: "var(--faint)" }}>{ev.ts}</span>
      </div>
    </div>
  );
}

// ── RIGHT PANEL (live activity) ──────────────────────────────────────────────
function RightPanel({ agent, run, onClose, onStop, onClear }) {
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [run.events.length, run.status]);

  const statusMeta = {
    idle:      { label: "Idle", color: "var(--idle)" },
    running:   { label: "Running", color: "var(--running)" },
    completed: { label: "Completed", color: "var(--success)" },
    stopped:   { label: "Stopped", color: "var(--error)" },
    error:     { label: "Error", color: "var(--error)" },
  }[run.status] || { label: "Idle", color: "var(--idle)" };

  return (
    <aside className="flex flex-col h-full border-l shrink-0" style={{ width: 400, borderColor: "var(--border)", background: "var(--surface-1)" }}>
      <div className="flex items-center justify-between px-4 h-14 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <StatusDot status={run.status === "running" ? "running" : run.status === "completed" ? "success" : (run.status === "stopped" || run.status === "error") ? "error" : "idle"} />
          <div>
            <div className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "var(--text)" }}>
              Live Activity
            </div>
            <div className="text-[10.5px] font-mono" style={{ color: "var(--muted)" }}>{run.target || (agent ? agent.name : "—")}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {run.status === "running" && <Btn variant="danger" size="sm" onClick={onStop}><Icon name="stop" size={12} /> Stop</Btn>}
          {(run.status === "completed" || run.status === "stopped") && <Btn variant="subtle" size="sm" onClick={onClear}>Clear</Btn>}
          <button onClick={onClose} className="grid place-items-center w-8 h-8 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover2)] transition"><Icon name="chevron" size={16} /></button>
        </div>
      </div>

      {/* counters */}
      <div className="grid grid-cols-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        {[
          { k: "Status", v: statusMeta.label, c: statusMeta.color },
          { k: "Tokens", v: run.tokens.toLocaleString(), c: "var(--text)" },
          { k: "Elapsed", v: run.elapsed.toFixed(1) + "s", c: "var(--text)" },
        ].map((m, i) => (
          <div key={m.k} className="px-4 py-2.5" style={{ borderLeft: i ? "1px solid var(--border)" : "none" }}>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--faint)" }}>{m.k}</div>
            <div className="text-[14px] font-mono tabular-nums mt-0.5 flex items-center gap-1.5" style={{ color: m.c }}>
              {m.k === "Status" && <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.c }} />}
              {m.v}
            </div>
          </div>
        ))}
      </div>

      {/* context + cache meter */}
      {(run.contextTokens > 0 || run.cached > 0) && (
        <div className="flex items-center gap-3 px-4 py-1.5 border-b shrink-0 text-[10.5px] font-mono" style={{ borderColor: "var(--border)", color: "var(--faint)" }}>
          {run.contextTokens > 0 && <span title="team context injected as a cached prefix">🧠 context ~{run.contextTokens} tok</span>}
          {run.cached > 0 && <span style={{ color: "var(--success)" }} title="prompt-cache hit — this much of the prompt was read from cache (~10% cost)">⚡ {run.cached.toLocaleString()} cached</span>}
        </div>
      )}

      {/* timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin px-4 py-4 space-y-3.5">
        {run.events.length === 0 && (
          <div className="h-full grid place-items-center text-center">
            <div className="space-y-2">
              <span className="grid place-items-center w-11 h-11 rounded-2xl mx-auto" style={{ background: "var(--surface-2)", color: "var(--faint)" }}><Icon name="bolt" size={20} /></span>
              <div className="text-[12.5px]" style={{ color: "var(--faint)" }}>No active run.<br/>Trigger one from the <span style={{ color: "var(--muted)" }}>Run</span> tab.</div>
            </div>
          </div>
        )}
        {run.events.map((ev, i) => (
          <EventNode key={ev.id} ev={ev} last={i === run.events.length - 1} />
        ))}
        {run.status === "running" && (
          <div className="flex items-center gap-2 pl-9 text-[12px]" style={{ color: "var(--muted)" }}>
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--running)", animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--running)", animationDelay: "120ms" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--running)", animationDelay: "240ms" }} />
            </span>
            working…
          </div>
        )}
      </div>
    </aside>
  );
}

// ── ACTIVITY TAB (history) ───────────────────────────────────────────────────
function ActivityTab({ agent, history, onRerun }) {
  if (!history.length) {
    return (
      <div className="h-full grid place-items-center">
        <div className="text-center space-y-2">
          <span className="grid place-items-center w-12 h-12 rounded-2xl mx-auto" style={{ background: "var(--surface-2)", color: "var(--faint)" }}><Icon name="clock" size={22} /></span>
          <div className="text-[13px]" style={{ color: "var(--muted)" }}>No runs yet for <span className="font-mono">{agent.name}</span>.</div>
          <div className="text-[12px]" style={{ color: "var(--faint)" }}>Completed runs will show up here.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="max-w-[760px] mx-auto px-7 py-6 space-y-2.5">
        {history.map((h) => (
          <div key={h.id} className="flex items-center gap-3 p-3.5 rounded-xl border transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <span className="grid place-items-center w-8 h-8 rounded-lg shrink-0" style={{ background: h.status === "completed" ? "color-mix(in srgb, var(--success) 16%, transparent)" : "color-mix(in srgb, var(--error) 16%, transparent)", color: h.status === "completed" ? "var(--success)" : "var(--error)" }}>
              <Icon name={h.status === "completed" ? "check" : "x"} size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] truncate" style={{ color: "var(--text)" }}>{h.task}</div>
              <div className="text-[11.5px] font-mono mt-0.5" style={{ color: "var(--muted)" }}>{h.when} · {h.tokens.toLocaleString()} tokens · {h.elapsed}s · {h.steps} steps</div>
            </div>
            <button onClick={() => onRerun(h.task)} className="text-[12px] px-2.5 py-1.5 rounded-lg border shrink-0 transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Re-run</button>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { RunTab, RightPanel, ActivityTab });
