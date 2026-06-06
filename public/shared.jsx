// shared.jsx — icons + small UI atoms shared across Agent Studio
const { useState, useEffect, useRef, useCallback } = React;

// ── Icon set (1.5px stroke line icons for UI chrome) ─────────────────────────
function Icon({ name, size = 16, className = "", strokeWidth = 1.6, style }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth, strokeLinecap: "round",
    strokeLinejoin: "round", className, style };
  switch (name) {
    case "search":   return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>;
    case "plus":     return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case "dots":     return <svg {...p}><circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/></svg>;
    case "clock":    return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "play":     return <svg {...p}><path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/></svg>;
    case "stop":     return <svg {...p}><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none"/></svg>;
    case "check":    return <svg {...p}><path d="M5 12.5l4.5 4.5L19 6.5"/></svg>;
    case "x":        return <svg {...p}><path d="M6 6l12 12M18 6 6 18"/></svg>;
    case "copy":     return <svg {...p}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>;
    case "trash":    return <svg {...p}><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/></svg>;
    case "chevron":  return <svg {...p}><path d="m9 6 6 6-6 6"/></svg>;
    case "chevdown": return <svg {...p}><path d="m6 9 6 6 6-6"/></svg>;
    case "panel":    return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></svg>;
    case "revert":   return <svg {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4"/></svg>;
    case "save":     return <svg {...p}><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7M8 20v-6h8v6"/></svg>;
    case "doc":      return <svg {...p}><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/></svg>;
    case "bolt":     return <svg {...p}><path d="M13 3 5 13h6l-1 8 8-10h-6z" /></svg>;
    case "calendar": return <svg {...p}><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>;
    case "target":   return <svg {...p}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/></svg>;
    case "spark":    return <svg {...p}><path d="M12 4v4M12 16v4M4 12h4M16 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8"/></svg>;
    case "wrench":   return <svg {...p}><path d="M15 6a4 4 0 0 0-5.3 5.3L4 17l3 3 5.7-5.7A4 4 0 0 0 18 9l-2.5 2.5L13 9l2.5-2.5A4 4 0 0 0 15 6z"/></svg>;
    case "sun":      return <svg {...p}><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/></svg>;
    case "moon":     return <svg {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z"/></svg>;
    case "camera":   return <svg {...p}><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.2"/></svg>;
    case "menu":     return <svg {...p}><path d="M4 6h16M4 12h16M4 18h16"/></svg>;
    case "paperclip":return <svg {...p}><path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3l7.8-7.8"/></svg>;
    default:         return null;
  }
}

// ── Status dot ───────────────────────────────────────────────────────────────
const STATUS = {
  idle:    { color: "var(--idle)",    label: "Idle",    pulse: false },
  running: { color: "var(--running)", label: "Running", pulse: true  },
  success: { color: "var(--success)", label: "Done",    pulse: false },
  error:   { color: "var(--error)",   label: "Error",   pulse: false },
};
function StatusDot({ status = "idle", size = 8 }) {
  const s = STATUS[status] || STATUS.idle;
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      {s.pulse && (
        <span className="absolute inset-0 rounded-full animate-ping-soft"
          style={{ background: s.color, opacity: 0.55 }} />
      )}
      <span className="relative rounded-full" style={{ width: size, height: size, background: s.color,
        boxShadow: status !== "idle" ? `0 0 8px ${s.color}` : "none" }} />
    </span>
  );
}

// ── Model badge ──────────────────────────────────────────────────────────────
function ModelBadge({ model, size = "sm" }) {
  const tones = {
    inherit: "var(--muted)",
    opus:    "#c084fc",
    sonnet:  "#7dd3fc",
    haiku:   "#86efac",
  };
  const c = tones[model] || "var(--muted)";
  const pad = size === "sm" ? "1px 7px" : "2px 9px";
  const fs  = size === "sm" ? 10.5 : 11.5;
  return (
    <span className="font-mono rounded-md border inline-flex items-center"
      style={{ padding: pad, fontSize: fs, color: c, borderColor: "color-mix(in srgb, " + c + " 32%, transparent)",
        background: "color-mix(in srgb, " + c + " 12%, transparent)", letterSpacing: ".02em" }}>
      {model}
    </span>
  );
}

// ── Tool chip ────────────────────────────────────────────────────────────────
function ToolChip({ tool, onRemove }) {
  const mcp = tool.startsWith("mcp__");
  const label = mcp ? tool.replace(/^mcp__/, "").replace(/__/, " · ") : tool;
  return (
    <span className="group inline-flex items-center gap-1.5 rounded-lg pl-2.5 pr-1.5 py-1 text-xs font-mono border transition-colors"
      style={{ borderColor: "var(--border)", background: "var(--surface-2)",
        color: mcp ? "var(--accent-fg)" : "var(--text)" }}>
      {mcp && <Icon name="wrench" size={11} style={{ opacity: .7 }} />}
      {label}
      {onRemove && (
        <button onClick={onRemove} title="Remove tool"
          className="grid place-items-center rounded-md w-4 h-4 opacity-40 hover:opacity-100 hover:bg-[var(--hover2)] transition">
          <Icon name="x" size={11} />
        </button>
      )}
    </span>
  );
}

// ── Generic small button ─────────────────────────────────────────────────────
function Btn({ children, variant = "ghost", size = "md", className = "", ...rest }) {
  const sizes = { sm: "h-7 px-2.5 text-xs gap-1.5", md: "h-9 px-3.5 text-[13px] gap-2", lg: "h-10 px-4 text-sm gap-2" };
  const base = "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none select-none";
  const variants = {
    primary: "text-white shadow-sm hover:brightness-110 active:scale-[.98]",
    ghost:   "text-[var(--text)] hover:bg-[var(--hover)] border border-transparent",
    outline: "text-[var(--text)] border hover:bg-[var(--hover)]",
    danger:  "text-[var(--error)] border hover:bg-[color-mix(in_srgb,var(--error)_14%,transparent)]",
    subtle:  "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover)]",
  };
  const style = {};
  if (variant === "primary") style.background = "var(--accent)";
  if (variant === "outline") style.borderColor = "var(--border)";
  if (variant === "danger")  style.borderColor = "color-mix(in srgb, var(--error) 36%, transparent)";
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} style={style} {...rest}>
      {children}
    </button>
  );
}

// ── Click-outside hook ───────────────────────────────────────────────────────
function useClickOutside(ref, onOut, active = true) {
  useEffect(() => {
    if (!active) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onOut(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [active, onOut]);
}

// ── tiny markdown → html (headings, bold, code, lists) for result blocks ─────
function mdInline(s) {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text);font-weight:600">$1</strong>')
    .replace(/`(.+?)`/g, '<code style="font-family:var(--mono);background:var(--surface-3);padding:1px 5px;border-radius:5px;font-size:.92em;color:var(--accent-fg)">$1</code>');
}

// full markdown → sanitized HTML for result blocks (headings, lists, tables, hr, code).
// Falls back to the tiny inline renderer if the CDN libs haven't loaded.
function mdToHtml(s) {
  const src = String(s || "");
  if (!window.marked) return mdInline(src);
  const html = window.marked.parse(src, { gfm: true, breaks: true });
  return window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
}

Object.assign(window, {
  Icon, StatusDot, ModelBadge, ToolChip, Btn, useClickOutside, mdInline, mdToHtml, STATUS,
  useState, useEffect, useRef, useCallback,
});
