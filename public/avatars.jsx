// avatars.jsx — illustrated agent avatars + picker
const { Icon } = window;

// Each preset = a little gradient "creature": a body shape + a pair of eyes.
const AVATAR_PRESETS = [
  { id: "ember",  g: ["#fb923c", "#ef4444"], shape: "gem",  eyes: "normal" },
  { id: "moss",   g: ["#5eead4", "#0d9488"], shape: "leaf", eyes: "sleepy" },
  { id: "iris",   g: ["#a5b4fc", "#6366f1"], shape: "bot",  eyes: "normal" },
  { id: "sky",    g: ["#7dd3fc", "#3b82f6"], shape: "orb",  eyes: "happy"  },
  { id: "plum",   g: ["#d8b4fe", "#7c3aed"], shape: "hex",  eyes: "wink"   },
  { id: "coral",  g: ["#fda4af", "#e11d48"], shape: "blob", eyes: "happy"  },
  { id: "lime",   g: ["#bef264", "#16a34a"], shape: "orb",  eyes: "normal" },
  { id: "honey",  g: ["#fcd34d", "#f59e0b"], shape: "cat",  eyes: "normal" },
  { id: "azure",  g: ["#67e8f9", "#2563eb"], shape: "bot",  eyes: "sleepy" },
  { id: "rose",   g: ["#f9a8d4", "#db2777"], shape: "blob", eyes: "wink"   },
  { id: "grape",  g: ["#c4b5fd", "#4f46e5"], shape: "gem",  eyes: "happy"  },
  { id: "reef",   g: ["#5eead4", "#0891b2"], shape: "cat",  eyes: "happy"  },
];
const PRESET_BY_ID = Object.fromEntries(AVATAR_PRESETS.map((p) => [p.id, p]));
const EYE = "rgba(28,22,18,.82)";
const BODY = "rgba(255,255,255,.95)";

function shapeEl(shape) {
  switch (shape) {
    case "orb":  return <circle cx="24" cy="25" r="13" fill={BODY} />;
    case "bot":  return <g><rect x="6" y="6" width="6" height="6" rx="3" fill={BODY} opacity=".85"/><rect x="11" y="13" width="26" height="23" rx="8" fill={BODY} /></g>;
    case "gem":  return <path d="M24 11 36 21 30 38 18 38 12 21Z" fill={BODY} />;
    case "hex":  return <path d="M24 10 35 16.5 35 31.5 24 38 13 31.5 13 16.5Z" fill={BODY} />;
    case "leaf": return <path d="M24 10c9 0 13 7 13 14s-4 14-13 14-13-7-13-14S15 10 24 10Z" fill={BODY} />;
    case "blob": return <path d="M24 10c7 0 14 3 14 12 0 4-1 7-4 10-3 4-5 6-10 6s-9-3-12-7c-2-3-2-6-2-9 0-9 7-12 14-12Z" fill={BODY} />;
    case "cat":  return <g><path d="M14 14 19 22 11 22Z" fill={BODY}/><path d="M34 14 37 22 29 22Z" fill={BODY}/><circle cx="24" cy="27" r="12" fill={BODY} /></g>;
    default:     return <circle cx="24" cy="25" r="13" fill={BODY} />;
  }
}
function eyesEl(eyes, cy) {
  const lx = 19.5, rx = 28.5;
  if (eyes === "happy")  return <g stroke={EYE} strokeWidth="2.1" strokeLinecap="round" fill="none"><path d={`M${lx-2.4} ${cy+0.6}q2.4 -3 4.8 0`}/><path d={`M${rx-2.4} ${cy+0.6}q2.4 -3 4.8 0`}/></g>;
  if (eyes === "sleepy") return <g stroke={EYE} strokeWidth="2.1" strokeLinecap="round"><line x1={lx-2.2} y1={cy} x2={lx+2.2} y2={cy}/><line x1={rx-2.2} y1={cy} x2={rx+2.2} y2={cy}/></g>;
  if (eyes === "wink")   return <g><circle cx={lx} cy={cy} r="2.1" fill={EYE}/><line x1={rx-2.2} y1={cy} x2={rx+2.2} y2={cy} stroke={EYE} strokeWidth="2.1" strokeLinecap="round"/></g>;
  return <g fill={EYE}><circle cx={lx} cy={cy} r="2.1"/><circle cx={rx} cy={cy} r="2.1"/></g>;
}

function PresetTile({ preset, size, radius }) {
  const uid = React.useId().replace(/:/g, "");
  const gid = "ag" + uid;
  const cy = preset.shape === "cat" ? 27 : preset.shape === "bot" ? 25 : 25;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ borderRadius: radius, display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={preset.g[0]} />
          <stop offset="1" stopColor={preset.g[1]} />
        </linearGradient>
        <radialGradient id={gid + "h"} cx="0.32" cy="0.26" r="0.8">
          <stop offset="0" stopColor="rgba(255,255,255,.45)" />
          <stop offset="0.5" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <rect width="48" height="48" rx={radius * 48 / size} fill={`url(#${gid})`} />
      <rect width="48" height="48" rx={radius * 48 / size} fill={`url(#${gid}h)`} />
      {shapeEl(preset.shape)}
      {eyesEl(preset.eyes, cy)}
    </svg>
  );
}

function initials(name) {
  const parts = (name || "?").split(/[-_\s]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || "?").slice(0, 2).toUpperCase();
}
function Monogram({ agent, size, radius }) {
  const c = window.STUDIO_DATA.AGENT_COLORS[agent.color] || "#6366f1";
  return (
    <span className="grid place-items-center font-semibold select-none" style={{
      width: size, height: size, borderRadius: radius, fontSize: size * 0.38,
      color: c, background: "color-mix(in srgb, " + c + " 18%, transparent)",
      border: "1px solid color-mix(in srgb, " + c + " 32%, transparent)" }}>
      {initials(agent.name)}
    </span>
  );
}

function AgentAvatar({ agent, size = 34, radius }) {
  const r = radius == null ? Math.max(7, Math.round(size * 0.30)) : radius;
  const av = agent.avatar;
  if (av && av.type === "image" && av.src) {
    return (
      <span className="block shrink-0 overflow-hidden" style={{ width: size, height: size, borderRadius: r, background: "var(--surface-3)" }}>
        <img src={av.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: av.pos || "center", transform: `scale(${av.scale || 1})` }} />
      </span>
    );
  }
  if (av && av.type === "preset" && PRESET_BY_ID[av.id]) {
    return <span className="shrink-0" style={{ width: size, height: size }}><PresetTile preset={PRESET_BY_ID[av.id]} size={size} radius={r} /></span>;
  }
  return <span className="shrink-0"><Monogram agent={agent} size={size} radius={r} /></span>;
}

// ── Avatar picker (popover): upload w/ zoom + preset gallery ──────────────────
function AvatarPicker({ agent, onPick, onClose }) {
  const [tab, setTab] = React.useState("presets");
  const [img, setImg] = React.useState(agent.avatar?.type === "image" ? agent.avatar.src : null);
  const [scale, setScale] = React.useState(agent.avatar?.scale || 1.1);
  const fileRef = React.useRef(null);
  const ref = React.useRef(null);
  window.useClickOutside(ref, onClose, true);

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { setImg(rd.result); setTab("upload"); };
    rd.readAsDataURL(f);
  }

  return (
    <div ref={ref} className="absolute left-0 top-[88px] z-40 w-[320px] rounded-2xl border shadow-2xl menu-pop overflow-hidden"
      style={{ borderColor: "var(--border)", background: "var(--surface-3)" }}>
      <div className="flex items-center gap-1 p-1.5 border-b" style={{ borderColor: "var(--border)" }}>
        {[["presets", "Gallery"], ["upload", "Upload"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 h-8 rounded-lg text-[12.5px] font-medium transition-colors"
            style={tab === id ? { background: "var(--surface-1)", color: "var(--text)" } : { color: "var(--muted)" }}>{label}</button>
        ))}
      </div>

      {tab === "presets" ? (
        <div className="p-3 grid grid-cols-4 gap-2.5 max-h-[230px] overflow-y-auto scroll-thin">
          {AVATAR_PRESETS.map((p) => {
            const active = agent.avatar?.type === "preset" && agent.avatar.id === p.id;
            return (
              <button key={p.id} onClick={() => onPick({ type: "preset", id: p.id })}
                className="relative rounded-xl transition-transform hover:scale-[1.06]"
                style={active ? { outline: "2px solid var(--accent)", outlineOffset: 2, borderRadius: 14 } : {}}>
                <PresetTile preset={p} size={58} radius={14} />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="p-4">
          {img ? (
            <div className="flex flex-col items-center gap-3">
              <div className="overflow-hidden rounded-2xl" style={{ width: 120, height: 120, background: "var(--surface-1)" }}>
                <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
              </div>
              <div className="w-full flex items-center gap-2">
                <Icon name="search" size={13} style={{ color: "var(--muted)" }} />
                <input type="range" min="1" max="2.2" step="0.01" value={scale} onChange={(e) => setScale(+e.target.value)}
                  className="flex-1 accent-[var(--accent)]" />
              </div>
              <div className="flex w-full gap-2">
                <button onClick={() => fileRef.current?.click()} className="flex-1 h-8 rounded-lg border text-[12.5px] transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Replace</button>
                <button onClick={() => onPick({ type: "image", src: img, scale })} className="flex-1 h-8 rounded-lg text-[12.5px] font-medium text-white" style={{ background: "var(--accent)" }}>Use photo</button>
              </div>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()}
              className="w-full grid place-items-center gap-2 rounded-xl border border-dashed py-8 transition-colors hover:bg-[var(--hover)]"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
              <Icon name="plus" size={20} />
              <span className="text-[12.5px]">Upload an image</span>
              <span className="text-[11px]" style={{ color: "var(--faint)" }}>PNG or JPG · square works best</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>
      )}
    </div>
  );
}

Object.assign(window, { AVATAR_PRESETS, AgentAvatar, PresetTile, AvatarPicker, Avatar: AgentAvatar });
