// app.jsx — Agent Studio orchestrator: real backend state, run engine, layout, tweaks
const { useState, useEffect, useRef, useCallback } = React;
const {
  Icon, Btn, Avatar, StatusDot, ModelBadge,
  Sidebar, PersonaTab, RunTab, RightPanel, ActivityTab,
  NewAgentModal, ConfirmDialog, RoutineDetail,
  useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakSelect,
} = window;

const D = window.STUDIO_DATA;
let _uid = 0;
const uid = () => `e${++_uid}`;
const nowTs = () => new Date().toLocaleTimeString("en-GB", { hour12: false });

// ── tiny API client ──────────────────────────────────────────────────────────
const api = {
  async get(p) { const r = await fetch(p); if (!r.ok) throw new Error((await r.json()).error || r.statusText); return r.json(); },
  async send(p, method, body) {
    const r = await fetch(p, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
    return r.json();
  },
};

const ACCENTS = {
  indigo: { accent: "#6366f1", fgDark: "#a5a9ff", fgLight: "#4f46e5" },
  teal:   { accent: "#14b8a6", fgDark: "#5eead4", fgLight: "#0f766e" },
  violet: { accent: "#a855f7", fgDark: "#d8b4fe", fgLight: "#7e22ce" },
  amber:  { accent: "#f59e0b", fgDark: "#fcd34d", fgLight: "#b45309" },
};

function TopBar({ query, setQuery, theme, onToggleTheme, agentCount, running }) {
  return (
    <header className="flex items-center gap-4 px-4 border-b shrink-0" style={{ height: 54, borderColor: "var(--border)", background: "var(--surface-1)" }}>
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="grid place-items-center w-8 h-8 rounded-xl text-white shadow-sm" style={{ background: "linear-gradient(140deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #000))" }}>
          <Icon name="spark" size={17} />
        </span>
        <div className="leading-tight">
          <div className="text-[14px] font-semibold tracking-tight" style={{ color: "var(--text)" }}>Totoland&nbsp;Agent&nbsp;Studio</div>
          <div className="text-[10.5px] font-mono" style={{ color: "var(--muted)" }}>{agentCount} agents · {running} running</div>
        </div>
      </div>

      <div className="flex-1 flex justify-center px-4">
        <div className="flex items-center gap-2 h-9 w-full max-w-[440px] rounded-xl px-3 border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <Icon name="search" size={15} style={{ color: "var(--muted)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search agents…"
            className="bg-transparent outline-none text-[13px] w-full placeholder:text-[var(--faint)]" style={{ color: "var(--text)" }} />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: "var(--border)", color: "var(--faint)" }}>⌘K</kbd>
        </div>
      </div>

      <div className="flex items-center p-0.5 rounded-lg border shrink-0" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        {["light", "dark"].map((m) => (
          <button key={m} onClick={() => { if (m !== theme) onToggleTheme(); }} title={`${m} theme`}
            className="grid place-items-center w-7 h-7 rounded-md transition-colors"
            style={theme === m ? { background: "var(--surface-3)", color: "var(--accent-fg)", boxShadow: "0 1px 2px rgba(0,0,0,.18)" } : { color: "var(--muted)" }}>
            <Icon name={m === "light" ? "sun" : "moon"} size={15} />
          </button>
        ))}
      </div>
    </header>
  );
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "indigo",
  "density": "comfy",
  "uiFont": "Geist"
}/*EDITMODE-END*/;

function snapshot(a) {
  return { name: a.name, description: a.description, model: a.model, tools: [...a.tools], body: a.body, avatar: a.avatar ? { ...a.avatar } : null };
}
function sameDraft(d, a) {
  return d.name === a.name && d.description === a.description && d.model === a.model &&
    d.body === a.body && d.tools.join() === a.tools.join() &&
    JSON.stringify(d.avatar || null) === JSON.stringify(a.avatar || null);
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [agents, setAgents] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [selKind, setSelKind] = useState("agent");
  const [selId, setSelId] = useState(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("persona");
  const [panelOpen, setPanelOpen] = useState(true);
  const [theme, setTheme] = useState("dark");

  const [drafts, setDrafts] = useState({});
  const [taskByAgent, setTaskByAgent] = useState({});
  const [historyByAgent, setHistoryByAgent] = useState({});
  const [injectContext, setInjectContext] = useState(false); // OFF by default: team-context already auto-loads via ~/.claude/CLAUDE.md. This is an optional re-inject/emphasis override.
  const [contextInfo, setContextInfo] = useState(null);      // {available, tokensEstimate} from /api/context

  const [run, setRun] = useState({ status: "idle", events: [], tokens: 0, cached: 0, contextTokens: 0, elapsed: 0, target: null, agentId: null, task: "" });
  const [modal, setModal] = useState(null);
  const [savePulse, setSavePulse] = useState(false);
  const [toast, setToast] = useState(null); // {kind:'error'|'ok', msg}

  const esRef = useRef(null);
  const ticker = useRef(null);

  const agent = agents.find((a) => a.id === selId);
  const routine = routines.find((r) => r.id === selId);
  const draft = agent ? drafts[agent.id] : null;
  const dirty = agent && draft ? !sameDraft(draft, agent) : false;

  // ── initial load ──
  useEffect(() => {
    (async () => {
      try {
        const [ags, rts, ctx] = await Promise.all([
          api.get("/api/agents"), api.get("/api/routines"), api.get("/api/context").catch(() => null),
        ]);
        setAgents(ags);
        setRoutines(rts);
        setContextInfo(ctx);
        setDrafts(Object.fromEntries(ags.map((a) => [a.id, snapshot(a)])));
        if (ags.length) setSelId(ags[0].id);
      } catch (err) {
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function flash(kind, msg) { setToast({ kind, msg }); setTimeout(() => setToast(null), 2600); }

  // ── theme vars from tweaks ──
  useEffect(() => {
    const root = document.documentElement;
    const a = ACCENTS[t.accent] || ACCENTS.indigo;
    root.setAttribute("data-theme", theme);
    root.style.setProperty("--accent", a.accent);
    root.style.setProperty("--accent-fg", theme === "light" ? a.fgLight : a.fgDark);
    root.setAttribute("data-density", t.density);
    const fonts = { Geist: "'Geist', system-ui, sans-serif", Manrope: "'Manrope', system-ui, sans-serif", System: "system-ui, -apple-system, sans-serif" };
    root.style.setProperty("--ui", fonts[t.uiFont] || fonts.Geist);
  }, [t.accent, t.density, t.uiFont, theme]);

  function toggleTheme() {
    const root = document.documentElement;
    root.classList.add("theme-anim");
    setTheme((th) => (th === "dark" ? "light" : "dark"));
    setTimeout(() => root.classList.remove("theme-anim"), 470);
  }

  function setDraft(next) { setDrafts((m) => ({ ...m, [agent.id]: next })); }

  function selectAgent(id) {
    setSelKind("agent"); setSelId(id);
    setDrafts((m) => (m[id] ? m : { ...m, [id]: snapshot(agents.find((a) => a.id === id)) }));
  }
  function selectRoutine(id) { setSelKind("routine"); setSelId(id); }

  // ── persona save / revert (real PUT) ──
  async function saveDraft() {
    if (!agent || !draft) return;
    try {
      const saved = await api.send(`/api/agents/${agent.id}`, "PUT", {
        name: draft.name, description: draft.description, model: draft.model,
        tools: draft.tools, body: draft.body, avatar: draft.avatar, color: agent.color, glyph: agent.glyph,
      });
      setAgents((as) => as.map((a) => (a.id === agent.id ? saved : a)));
      setDrafts((m) => {
        const next = { ...m }; delete next[agent.id]; next[saved.id] = snapshot(saved); return next;
      });
      if (saved.id !== agent.id) setSelId(saved.id);
      setSavePulse(true); setTimeout(() => setSavePulse(false), 1400);
    } catch (err) {
      flash("error", err.message);
    }
  }
  function revertDraft() { setDraft(snapshot(agent)); }

  // ── run engine (real SSE stream) ──
  function stopTicker() { if (ticker.current) { clearInterval(ticker.current); ticker.current = null; } }
  function closeStream() { if (esRef.current) { esRef.current.close(); esRef.current = null; } }

  function setAgentStatus(id, status) {
    setAgents((as) => as.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  function runAgent(targetAgent, taskText, label) {
    closeStream(); stopTicker();
    setPanelOpen(true);
    setAgentStatus(targetAgent.id, "running");
    setRun({ status: "running", events: [], tokens: 0, cached: 0, contextTokens: 0, elapsed: 0, target: label || targetAgent.name, agentId: targetAgent.id, task: taskText });

    const startAt = Date.now();
    ticker.current = setInterval(() => {
      setRun((r) => (r.status !== "running" ? r : { ...r, elapsed: (Date.now() - startAt) / 1000 }));
    }, 90);

    const url = `/api/run?agentId=${encodeURIComponent(targetAgent.id)}&task=${encodeURIComponent(taskText || "")}` +
      (label ? `&label=${encodeURIComponent(label)}` : "") +
      `&context=${injectContext ? "on" : "off"}`;
    const es = new EventSource(url);
    esRef.current = es;

    const finish = (status) => {
      stopTicker(); closeStream();
      setAgentStatus(targetAgent.id, status === "error" ? "error" : "idle");
      // clear the task composer once a run completes successfully (the task is
      // preserved in the run timeline + Activity history); keep it on error/stop for retry
      if (status === "completed") setTaskByAgent((m) => ({ ...m, [targetAgent.id]: "" }));
      setRun((r) => {
        const steps = r.events.filter((e) => e.kind === "tool" || e.kind === "result").length;
        const entry = { id: uid(), task: taskText || `Run ${targetAgent.name}`, status: status === "completed" ? "completed" : "error",
          when: "just now", tokens: r.tokens, elapsed: r.elapsed.toFixed(1), steps };
        setHistoryByAgent((h) => ({ ...h, [targetAgent.id]: [entry, ...(h[targetAgent.id] || [])] }));
        return { ...r, status };
      });
    };

    es.onmessage = (e) => {
      let ev; try { ev = JSON.parse(e.data); } catch { return; }
      switch (ev.kind) {
        case "label":
          setRun((r) => ({ ...r, target: ev.text })); break;
        case "context":
          setRun((r) => ({ ...r, contextTokens: ev.tokens || 0 })); break;
        case "start":
          setRun((r) => ({ ...r, events: [...r.events, { kind: "start", text: ev.text, id: uid(), ts: nowTs() }] })); break;
        case "thinking":
          setRun((r) => ({ ...r, events: [...r.events, { kind: "thinking", text: ev.text, id: uid(), ts: nowTs() }] })); break;
        case "tool":
          setRun((r) => ({ ...r, events: [...r.events, { kind: "tool", id: ev.id || uid(), icon: ev.icon, label: ev.label, arg: ev.arg, state: "pending", ts: nowTs() }] })); break;
        case "tool_update":
          setRun((r) => ({ ...r, events: r.events.map((x) => (x.id === ev.id ? { ...x, state: ev.state, result: ev.result } : x)) })); break;
        case "tokens":
          setRun((r) => ({ ...r, tokens: ev.tokens || r.tokens, cached: ev.cached ?? r.cached })); break;
        case "result":
          setRun((r) => ({ ...r, tokens: ev.tokens || r.tokens, events: [...r.events, { kind: "result", text: ev.text, id: uid(), ts: nowTs() }] })); break;
        case "error":
          setRun((r) => ({ ...r, events: [...r.events, { kind: "result", text: "⚠️ **Error** — " + ev.text, id: uid(), ts: nowTs(), error: true }] })); break;
        case "done":
          setRun((r) => ({ ...r, tokens: ev.tokens || r.tokens, cached: ev.cached ?? r.cached }));
          finish(ev.status || "completed"); break;
      }
    };
    es.onerror = () => {
      // stream dropped (server closed or network). If we were still running, mark error.
      setRun((r) => {
        if (r.status === "running") { setTimeout(() => finish("error"), 0); }
        return r;
      });
    };
  }

  function stopRun() {
    closeStream(); stopTicker();
    setRun((r) => ({ ...r, status: "stopped" }));
    if (run.agentId) setAgentStatus(run.agentId, "idle");
  }
  function clearRun() {
    closeStream(); stopTicker();
    setRun({ status: "idle", events: [], tokens: 0, cached: 0, contextTokens: 0, elapsed: 0, target: null, agentId: null, task: "" });
  }
  function triggerRun() {
    const task = (taskByAgent[agent.id] || "").trim();
    if (!task) return;
    runAgent(agent, task);
  }

  // ── create / clone / delete (real API) ──
  async function createAgent(name, tpl, avatar) {
    try {
      const created = await api.send("/api/agents", "POST", {
        name, description: tpl.seed.description, model: tpl.seed.model, tools: tpl.seed.tools, body: tpl.seed.body,
        color: tpl.color, glyph: tpl.glyph === "＋" ? "✦" : tpl.glyph, avatar: avatar || tpl.seed.avatar || null,
      });
      setAgents((as) => [...as, created]);
      setDrafts((m) => ({ ...m, [created.id]: snapshot(created) }));
      setModal(null); setSelKind("agent"); setSelId(created.id); setActiveTab("persona");
    } catch (err) { flash("error", err.message); }
  }

  async function duplicateAgent(id) {
    try {
      const copy = await api.send(`/api/agents/${id}/duplicate`, "POST");
      setAgents((as) => {
        const idx = as.findIndex((a) => a.id === id);
        const next = [...as]; next.splice(idx + 1, 0, copy); return next;
      });
      setDrafts((m) => ({ ...m, [copy.id]: snapshot(copy) }));
      setSelKind("agent"); setSelId(copy.id);
    } catch (err) { flash("error", err.message); }
  }

  async function deleteAgent(id) {
    try {
      await api.send(`/api/agents/${id}`, "DELETE");
      setAgents((as) => {
        const next = as.filter((a) => a.id !== id);
        if (selId === id && next.length) { setSelId(next[0].id); setSelKind("agent"); }
        else if (!next.length) setSelId(null);
        return next;
      });
      setModal(null);
    } catch (err) { flash("error", err.message); setModal(null); }
  }

  // ── routines ──
  async function toggleRoutine(id) {
    const r = routines.find((x) => x.id === id);
    if (!r) return;
    try {
      const updated = await api.send(`/api/routines/${id}`, "PUT", { enabled: !r.enabled });
      setRoutines((rs) => rs.map((x) => (x.id === id ? updated : x)));
    } catch (err) { flash("error", err.message); }
  }
  function runRoutineNow(r) {
    const a = agents.find((x) => x.id === r.agentId);
    if (a) { setSelKind("agent"); setSelId(a.id); setActiveTab("run"); runAgent(a, r.prompt, r.name); }
    else flash("error", `Agent "${r.agentId}" not found for this routine.`);
  }

  const tabs = [{ id: "persona", label: "Persona" }, { id: "run", label: "Run" }, { id: "activity", label: "Activity" }];
  const history = agent ? (historyByAgent[agent.id] || []) : [];

  if (loading) {
    return (
      <div className="h-screen w-screen grid place-items-center" style={{ background: "var(--bg)", color: "var(--muted)" }}>
        <div className="flex items-center gap-3 text-[13px]">
          <span className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
          Loading agents from <span className="font-mono">~/.claude/agents</span>…
        </div>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="h-screen w-screen grid place-items-center px-8 text-center" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <div className="space-y-2">
          <div className="text-[15px] font-semibold" style={{ color: "var(--error)" }}>Couldn’t reach the backend</div>
          <div className="text-[13px]" style={{ color: "var(--muted)" }}>{loadError}</div>
          <div className="text-[12px] font-mono" style={{ color: "var(--faint)" }}>Is the server running?  npm start</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: "var(--bg)", color: "var(--text)", fontFamily: "var(--ui)" }}>
      <TopBar query={query} setQuery={setQuery} theme={theme} onToggleTheme={toggleTheme}
        agentCount={agents.length} running={agents.filter((a) => a.status === "running").length} />

      <div className="flex-1 flex min-h-0">
      <Sidebar
        agents={agents} routines={routines} selId={selId} selKind={selKind}
        onSelectAgent={selectAgent} onSelectRoutine={selectRoutine}
        onNewAgent={() => setModal({ type: "new" })}
        onDuplicate={duplicateAgent} onDelete={(id) => setModal({ type: "delete", id })}
        onToggleRoutine={toggleRoutine} query={query} />

      <main className="flex-1 flex flex-col min-w-0">
        {selKind === "agent" && agent && draft ? (
          <>
            <header className="flex items-center gap-4 px-5 h-14 border-b shrink-0" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar agent={agent} size={30} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[14px] truncate" style={{ color: "var(--text)" }}>{agent.name}</span>
                    <ModelBadge model={agent.model} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 ml-2 p-0.5 rounded-xl" style={{ background: "var(--surface-2)" }}>
                {tabs.map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className="relative px-3.5 h-8 rounded-lg text-[13px] font-medium transition-colors"
                    style={activeTab === tab.id
                      ? { background: "var(--surface-3)", color: "var(--text)", boxShadow: "0 1px 2px rgba(0,0,0,.25)" }
                      : { color: "var(--muted)" }}>
                    {tab.label}
                    {tab.id === "run" && run.status === "running" && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: "var(--running)" }} />}
                  </button>
                ))}
              </div>

              <div className="flex-1" />
              <div className="flex items-center gap-1.5">
                <StatusDot status={agent.status} />
                <span className="text-[12px]" style={{ color: "var(--muted)" }}>{window.STATUS[agent.status].label}</span>
              </div>
              {!panelOpen && (
                <button onClick={() => setPanelOpen(true)} className="grid place-items-center w-8 h-8 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover2)] transition" title="Show activity panel"><Icon name="panel" size={16} /></button>
              )}
            </header>

            <div className="flex-1 min-h-0">
              {activeTab === "persona" && <PersonaTab agent={agent} draft={draft} setDraft={setDraft} dirty={dirty} onSave={saveDraft} onRevert={revertDraft} />}
              {activeTab === "run" && <RunTab agent={agent} task={taskByAgent[agent.id] || ""} setTask={(v) => setTaskByAgent((m) => ({ ...m, [agent.id]: v }))} running={run.status === "running" && run.agentId === agent.id} onRun={triggerRun} onStop={stopRun} onOpenPanel={() => setPanelOpen(true)} panelOpen={panelOpen} injectContext={injectContext} setInjectContext={setInjectContext} contextInfo={contextInfo} />}
              {activeTab === "activity" && <ActivityTab agent={agent} history={history} onRerun={(task) => { setActiveTab("run"); setTaskByAgent((m) => ({ ...m, [agent.id]: task })); }} />}
            </div>
          </>
        ) : routine ? (
          <>
            <header className="flex items-center gap-3 px-5 h-14 border-b shrink-0" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
              <button onClick={() => { setSelKind("agent"); setSelId(routine.agentId); }} className="grid place-items-center w-8 h-8 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover2)] transition"><Icon name="chevron" size={16} style={{ transform: "rotate(180deg)" }} /></button>
              <Icon name="calendar" size={15} style={{ color: "var(--accent-fg)" }} />
              <span className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>Scheduled Routine</span>
            </header>
            <div className="flex-1 min-h-0">
              <RoutineDetail routine={routine} agent={agents.find((a) => a.id === routine.agentId)}
                onToggle={() => toggleRoutine(routine.id)} onRunNow={() => runRoutineNow(routine)}
                onBack={() => { setSelKind("agent"); setSelId(routine.agentId); }} />
            </div>
          </>
        ) : (
          <div className="flex-1 grid place-items-center text-center px-8">
            <div className="space-y-2">
              <span className="grid place-items-center w-12 h-12 rounded-2xl mx-auto" style={{ background: "var(--surface-2)", color: "var(--faint)" }}><Icon name="spark" size={22} /></span>
              <div className="text-[14px]" style={{ color: "var(--muted)" }}>No agents yet.</div>
              <Btn variant="primary" size="md" onClick={() => setModal({ type: "new" })}><Icon name="plus" size={14} /> New Agent</Btn>
            </div>
          </div>
        )}
      </main>

      {panelOpen && (
        <RightPanel agent={agent} run={run} onClose={() => setPanelOpen(false)} onStop={stopRun} onClear={clearRun} />
      )}
      </div>

      {/* modals */}
      {modal?.type === "new" && <NewAgentModal onClose={() => setModal(null)} onCreate={createAgent} />}
      {modal?.type === "delete" && (() => {
        const a = agents.find((x) => x.id === modal.id);
        if (!a) return null;
        return <ConfirmDialog danger title={`Delete ${a.name}?`}
          body={<>This removes <span className="font-mono" style={{ color: "var(--text)" }}>~/.claude/agents/{a.name}.md</span> from disk. This can't be undone.</>}
          confirmLabel="Delete agent" onConfirm={() => deleteAgent(modal.id)} onClose={() => setModal(null)} />;
      })()}

      {/* saved toast */}
      {savePulse && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 h-10 rounded-xl border shadow-2xl toast-in" style={{ borderColor: "color-mix(in srgb, var(--success) 35%, var(--border))", background: "var(--surface-3)" }}>
          <Icon name="check" size={15} style={{ color: "var(--success)" }} />
          <span className="text-[13px]" style={{ color: "var(--text)" }}>Saved to <span className="font-mono" style={{ color: "var(--muted)" }}>{agent?.name}.md</span></span>
        </div>
      )}
      {/* error/info toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 h-10 rounded-xl border shadow-2xl toast-in" style={{ borderColor: `color-mix(in srgb, var(--${toast.kind === "error" ? "error" : "success"}) 40%, var(--border))`, background: "var(--surface-3)" }}>
          <Icon name={toast.kind === "error" ? "x" : "check"} size={15} style={{ color: `var(--${toast.kind === "error" ? "error" : "success"})` }} />
          <span className="text-[13px]" style={{ color: "var(--text)" }}>{toast.msg}</span>
        </div>
      )}

      {/* tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Accent" />
        <TweakColor label="Color" value={t.accent === "indigo" ? "#6366f1" : t.accent === "teal" ? "#14b8a6" : t.accent === "violet" ? "#a855f7" : "#f59e0b"}
          options={["#6366f1", "#14b8a6", "#a855f7", "#f59e0b"]}
          onChange={(hex) => setTweak("accent", { "#6366f1": "indigo", "#14b8a6": "teal", "#a855f7": "violet", "#f59e0b": "amber" }[hex])} />
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={["compact", "comfy"]} onChange={(v) => setTweak("density", v)} />
        <TweakSelect label="UI font" value={t.uiFont} options={["Geist", "Manrope", "System"]} onChange={(v) => setTweak("uiFont", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
