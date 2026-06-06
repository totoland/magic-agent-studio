// office.jsx — the Virtual Office view (v1). A backdrop stage (office-bg) with a
// dynamic floor of agents (reusing the existing Avatar; swap to 2.5D sprites later).
// Click an agent → open it. Status/“busy” is driven by real run/chat state.
const { Icon, Avatar } = window;

function OfficeAgent({ agent, xPct, yPct, busy, error, onOpen }) {
  const spriteUrl = agent.sprite || (agent.avatar && agent.avatar.type === "sprite" && agent.avatar.src);
  return (
    <button onClick={() => onOpen(agent.id)}
      className="absolute group flex flex-col items-center"
      style={{ left: xPct + "%", top: yPct + "%", transform: "translate(-50%, -100%)" }}
      title={`${agent.name} · ${busy ? "working" : error ? "error" : "idle"}`}>
      {/* thought / status bubble while working */}
      {busy && (
        <div className="mb-1 px-2 py-1 rounded-lg text-[10px] font-mono whitespace-nowrap shadow-lg"
          style={{ background: "rgba(8,6,5,.82)", color: "var(--running)", border: "1px solid color-mix(in srgb, var(--running) 45%, transparent)" }}>
          ● working…
        </div>
      )}
      {/* character */}
      <div className="relative transition-transform duration-150 group-hover:-translate-y-1">
        {spriteUrl
          ? <img src={spriteUrl} alt={agent.name} draggable={false} style={{ height: 96, imageRendering: "auto", filter: error ? "drop-shadow(0 0 6px var(--error))" : "none" }} />
          : <Avatar agent={agent} size={62} />}
        {busy && <span className="absolute -inset-1 rounded-2xl animate-ping-soft" style={{ background: "var(--running)", opacity: .25 }} />}
      </div>
      {/* contact shadow */}
      <span className="rounded-full" style={{ width: 44, height: 9, background: "rgba(0,0,0,.5)", filter: "blur(3px)", marginTop: 2 }} />
      {/* nameplate */}
      <span className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono shadow"
        style={{ background: "rgba(8,6,5,.7)", color: "#ece7e1", border: `1px solid ${error ? "var(--error)" : "rgba(255,255,255,.14)"}` }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: busy ? "var(--running)" : error ? "var(--error)" : "var(--success)" }} />
        {agent.name}
      </span>
    </button>
  );
}

function OfficeView({ agents, busyIds, errorIds, onOpenAgent, onRecruit, runningCount }) {
  // distribute agents along the open floor; wrap to a 2nd (smaller, higher) row past 6
  const ROW = 6;
  const place = (i) => {
    const row = Math.floor(i / ROW), col = i % ROW;
    const inRow = Math.min(ROW, agents.length - row * ROW);
    const x = inRow <= 1 ? 46 : 21 + col * (52 / (inRow - 1));
    const y = row === 0 ? 86 : 70;
    return { x, y };
  };

  return (
    <div className="w-full h-full grid place-items-center overflow-hidden" style={{ background: "#0d0b09" }}>
      <div className="relative inline-block select-none">
        <img src="/assets/office-bg.png" alt="Office" draggable={false} className="block"
          style={{ maxWidth: "100%", maxHeight: "calc(100vh - 56px)" }} />

        {/* LIVE HUD over the dashboard screen */}
        <div className="absolute font-mono" style={{ left: "18%", top: "30%", color: "#34d399" }}>
          <div className="text-[1.4vw] leading-none font-semibold" style={{ textShadow: "0 0 8px rgba(52,211,153,.5)" }}>{agents.length}</div>
        </div>
        <div className="absolute font-mono" style={{ left: "31%", top: "30%", color: "#f5a623" }}>
          <div className="text-[1.4vw] leading-none font-semibold" style={{ textShadow: "0 0 8px rgba(245,166,35,.5)" }}>{runningCount}</div>
        </div>

        {/* Reception → recruit */}
        <button onClick={onRecruit} title="Recruit a new agent"
          className="absolute rounded-lg transition-transform hover:scale-[1.03]"
          style={{ left: "13%", top: "56%", width: "15%", height: "16%", background: "transparent" }} />

        {/* agent floor */}
        {agents.map((a, i) => {
          const { x, y } = place(i);
          return <OfficeAgent key={a.id} agent={a} xPct={x} yPct={y}
            busy={busyIds.has(a.id)} error={errorIds.has(a.id)} onOpen={onOpenAgent} />;
        })}

        {agents.length === 0 && (
          <div className="absolute left-1/2 top-[80%] -translate-x-1/2 text-center text-[13px]" style={{ color: "#ece7e1" }}>
            No agents yet — click Reception to recruit one.
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { OfficeView });
