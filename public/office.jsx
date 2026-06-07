// office.jsx — Virtual Office view. Backdrop stage (office-bg) + dynamic agent floor.
// Sprites: per-state (idle/work/thinking/talking/celebrate/greet); a value may be a
// single URL or an array (animated ping-pong loop). Left-click opens the agent;
// right-click opens a "test state" menu to preview any state without running.
const { Icon, Avatar } = window;

const OFFICE_STATES = ["idle", "work", "thinking", "talking", "celebrate", "greet"];

function pickFrames(sprite, state) {
  if (!sprite) return null;
  const norm = (v) => (v ? (Array.isArray(v) ? v.filter(Boolean) : [v]) : null);
  return norm(sprite[state]) || norm(sprite.idle) || norm(sprite.work);
}

// ping-pong animated sprite (1 frame = static)
function SpriteAnim({ frames, error, height, anim }) {
  const [i, setI] = React.useState(0);
  const key = frames.join("|");
  React.useEffect(() => {
    setI(0);
    if (frames.length < 2) return;
    let idx = 0, dir = 1;
    const t = setInterval(() => {
      idx += dir;
      if (idx >= frames.length - 1) dir = -1; else if (idx <= 0) dir = 1;
      setI(Math.max(0, Math.min(frames.length - 1, idx)));
    }, 460);
    return () => clearInterval(t);
  }, [key]);
  // NB: no whole-image motion for "work" — that sprite is a full desk scene, so bobbing it moves the desk too.
  const cls = anim === "celebrate" ? "sprite-celebrate" : anim === "idle" ? "sprite-idle" : "";
  return <img className={cls} src={frames[i]} draggable={false} style={{ height, filter: error ? "drop-shadow(0 0 5px var(--error))" : "none" }} />;
}

function OfficeAgent({ agent, xPct, yPct, height, state, busy, error, testing, onOpen, onSetTest }) {
  const [menu, setMenu] = React.useState(false);
  const ref = React.useRef(null);
  window.useClickOutside(ref, () => setMenu(false), menu);
  const frames = pickFrames(agent.sprite, state);
  const has = (s) => agent.sprite && agent.sprite[s];

  return (
    <div ref={ref} className="absolute" style={{ left: xPct + "%", top: yPct + "%", transform: "translate(-50%, -100%)" }}>
      <button onClick={() => onOpen(agent.id)} onContextMenu={(e) => { e.preventDefault(); setMenu((m) => !m); }}
        className="group flex flex-col items-center" title={`${agent.name} · ${state}  (left-click: open · right-click: test states)`}>
        {/* status / test bubble */}
        {testing
          ? <div className="mb-1 px-2 py-1 rounded-lg text-[10px] font-mono whitespace-nowrap shadow-lg" style={{ background: "rgba(8,6,5,.82)", color: "var(--accent-fg)", border: "1px solid color-mix(in srgb, var(--accent) 45%, transparent)" }}>🧪 test: {state}</div>
          : busy && <div className="mb-1 px-2 py-1 rounded-lg text-[10px] font-mono whitespace-nowrap shadow-lg" style={{ background: "rgba(8,6,5,.82)", color: "var(--running)", border: "1px solid color-mix(in srgb, var(--running) 45%, transparent)" }}>● {state === "thinking" ? "thinking…" : "working…"}</div>}
        {/* character */}
        <div className="relative transition-transform duration-150 group-hover:-translate-y-1">
          {frames ? <SpriteAnim frames={frames} error={error} height={height} anim={state} /> : <Avatar agent={agent} size={96} />}
          {busy && <span className="absolute -inset-1 rounded-2xl animate-ping-soft" style={{ background: "var(--running)", opacity: .22 }} />}
        </div>
        <span className="rounded-full" style={{ width: "62%", height: 10, background: "rgba(0,0,0,.5)", filter: "blur(3px)", marginTop: 2 }} />
        <span className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono shadow"
          style={{ background: "rgba(8,6,5,.7)", color: "#ece7e1", border: `1px solid ${error ? "var(--error)" : "rgba(255,255,255,.14)"}` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: busy ? "var(--running)" : error ? "var(--error)" : "var(--success)" }} />
          {agent.name}
        </span>
      </button>

      {/* right-click: test-state menu (above the head) */}
      {menu && (
        <div className="absolute z-50 rounded-xl border p-1 shadow-2xl menu-pop" style={{ bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 6, background: "var(--surface-3)", borderColor: "var(--border)", minWidth: 132 }}>
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider" style={{ color: "var(--faint)" }}>Test state</div>
          {OFFICE_STATES.map((s) => (
            <button key={s} onClick={() => { onSetTest(agent.id, s); setMenu(false); }}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-[var(--hover2)] transition"
              style={{ color: testing && state === s ? "var(--accent-fg)" : "var(--text)" }}>
              {s} {!has(s) && <span className="text-[10px]" style={{ color: "var(--faint)" }}>no sprite</span>}
            </button>
          ))}
          <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
          <button onClick={() => { onSetTest(agent.id, null); setMenu(false); }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-[var(--hover2)] transition" style={{ color: "var(--muted)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)" }} /> Live (auto)
          </button>
        </div>
      )}
    </div>
  );
}

function OfficeView({ agents, statesById, testStateById, transientById, busyIds, errorIds, onOpenAgent, onSetTest, onRecruit, runningCount }) {
  // Scatter on the floor with depth: alternate front/back bands (zig-zag, not a
  // straight line); front = lower + bigger, back = higher + smaller (45° perspective).
  const place = (i) => {
    const n = agents.length;
    const x = n <= 1 ? 47 : 24 + i * (50 / (n - 1));
    const back = i % 2 === 1;
    return { x, y: back ? 72 : 90, h: back ? "24vh" : "32vh" };
  };
  return (
    <div className="w-full h-full grid place-items-center overflow-hidden" style={{ background: "#0d0b09" }}>
      <div className="relative inline-block select-none">
        <img src="/assets/office-bg.png" alt="Office" draggable={false} className="block" style={{ maxWidth: "100%", maxHeight: "calc(100vh - 56px)" }} />
        {/* live HUD over the dashboard */}
        <div className="absolute font-mono font-semibold" style={{ left: "18%", top: "30%", color: "#34d399", fontSize: "1.4vw", textShadow: "0 0 8px rgba(52,211,153,.5)" }}>{agents.length}</div>
        <div className="absolute font-mono font-semibold" style={{ left: "31%", top: "30%", color: "#f5a623", fontSize: "1.4vw", textShadow: "0 0 8px rgba(245,166,35,.5)" }}>{runningCount}</div>
        {/* reception → recruit */}
        <button onClick={onRecruit} title="Recruit a new agent" className="absolute" style={{ left: "13%", top: "56%", width: "15%", height: "16%", background: "transparent" }} />
        {/* agent floor */}
        {agents.map((a, i) => {
          const { x, y, h } = place(i);
          const ts = testStateById[a.id];
          const st = ts || (transientById && transientById[a.id]) || statesById[a.id] || "idle"; // test > transient > live
          return <OfficeAgent key={a.id} agent={a} xPct={x} yPct={y} height={h} state={st} testing={!!ts}
            busy={busyIds.has(a.id)} error={errorIds.has(a.id)} onOpen={onOpenAgent} onSetTest={onSetTest} />;
        })}
        {agents.length === 0 && (
          <div className="absolute left-1/2 top-[80%] -translate-x-1/2 text-center text-[13px]" style={{ color: "#ece7e1" }}>No agents yet — click Reception to recruit one.</div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { OfficeView });
