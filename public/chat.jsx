// chat.jsx — multi-turn Chat tab. State (thread + sessionId) lives in app.jsx;
// this renders the conversation and the composer. Continuity is via --resume.
const { Icon, Btn, Avatar, mdToHtml } = window;

// collapsible tool/thinking trace under an assistant message
function ChatTrace({ events }) {
  const [open, setOpen] = React.useState(false);
  const tools = (events || []).filter((e) => e.kind === "tool");
  if (!events || !events.length) return null;
  return (
    <div className="mt-2">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
        <Icon name="chevron" size={12} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
        🔧 {tools.length} {tools.length === 1 ? "step" : "steps"}
      </button>
      {open && (
        <div className="mt-1.5 pl-3 space-y-1 border-l" style={{ borderColor: "var(--border)" }}>
          {events.map((e, i) => e.kind === "tool" ? (
            <div key={i} className="flex items-center gap-2 text-[11.5px] font-mono">
              <span>{e.icon}</span>
              <span style={{ color: "var(--text)" }}>{e.label}</span>
              {e.arg && <span style={{ color: "var(--accent-fg)" }}>{e.arg}</span>}
              {e.state === "pending"
                ? <span className="w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--running)" }} />
                : <span style={{ color: "var(--faint)" }}>{e.result || "ok"}</span>}
            </div>
          ) : e.kind === "thinking" ? (
            <div key={i} className="text-[11.5px] italic leading-relaxed" style={{ color: "var(--faint)" }}>{e.text}</div>
          ) : null)}
        </div>
      )}
    </div>
  );
}

function ChatTab({ agent, thread, onSend, onNewChat }) {
  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef(null);
  const msgs = (thread && thread.messages) || [];
  const last = msgs[msgs.length - 1];
  const streaming = !!(last && last.role === "assistant" && last.streaming);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs.length, streaming, last && last.text]);

  const send = () => { const t = input.trim(); if (!t || streaming) return; onSend(t); setInput(""); };

  return (
    <div className="h-full flex flex-col">
      {/* header */}
      <div className="flex items-center justify-between px-7 py-2.5 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--muted)" }}>
          <Icon name="bolt" size={13} />
          {thread && thread.sessionId
            ? <>Session active · <span className="font-mono">{thread.sessionId.slice(0, 8)}</span></>
            : "New conversation"}
        </div>
        <button onClick={onNewChat} disabled={streaming}
          className="flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-lg border transition-colors hover:bg-[var(--hover)] disabled:opacity-40"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
          <Icon name="plus" size={13} /> New chat
        </button>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin px-7 py-5">
        <div className="max-w-[760px] mx-auto space-y-4">
          {msgs.length === 0 && (
            <div className="grid place-items-center text-center pt-20">
              <div className="space-y-2.5">
                <div className="mx-auto w-fit"><Avatar agent={agent} size={48} /></div>
                <div className="text-[13px]" style={{ color: "var(--muted)" }}>
                  Chat with <span className="font-mono">{agent.name}</span> — it remembers within this conversation.
                </div>
              </div>
            </div>
          )}
          {msgs.map((m) => m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13px] whitespace-pre-wrap"
                style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--text)" }}>{m.text}</div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2.5">
              <Avatar agent={agent} size={28} />
              <div className="min-w-0 flex-1">
                <div className="rounded-2xl rounded-tl-md border px-3.5 py-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  {m.text
                    ? <div className="md-body" dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) }} />
                    : m.streaming
                      ? <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--muted)" }}>
                          <span className="flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--running)" }} />
                            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--running)", animationDelay: "120ms" }} />
                            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--running)", animationDelay: "240ms" }} />
                          </span>working…
                        </div>
                      : <span style={{ color: "var(--faint)" }}>—</span>}
                  <ChatTrace events={m.events} />
                </div>
                {m.text && !m.streaming && <div className="mt-1"><window.CopyBtn text={m.text} /></div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* composer */}
      <div className="px-7 py-3 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[760px] mx-auto rounded-2xl border p-2.5 flex items-end gap-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} disabled={streaming}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send(); }}
            placeholder={`Message ${agent.name}…`} rows={1}
            className="flex-1 resize-none outline-none bg-transparent px-2 py-1.5 text-[14px] scroll-thin"
            style={{ color: "var(--text)", maxHeight: 140 }} />
          <Btn variant="primary" size="md" onClick={send} disabled={!input.trim() || streaming}><Icon name="play" size={13} /> Send</Btn>
        </div>
        <div className="max-w-[760px] mx-auto text-[11px] font-mono pt-1.5 pl-2" style={{ color: "var(--faint)" }}>⌘↵ to send · remembers within this chat</div>
      </div>
    </div>
  );
}

Object.assign(window, { ChatTab });
