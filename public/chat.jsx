// chat.jsx — multi-turn Chat tab. State (thread + sessionId) lives in app.jsx;
// this renders the conversation and the composer. Continuity is via --resume.
const { Icon, Btn, Avatar, mdToHtml } = window;
const fmtTok = (n) => (!n ? "0" : n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n));

// Live tool/thinking trace under an assistant message. Auto-expands while the turn
// is streaming (so you see activity live), collapses once it's done.
function ChatTrace({ events, streaming }) {
  const [open, setOpen] = React.useState(!!streaming);
  React.useEffect(() => { setOpen(!!streaming); }, [streaming]);
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
  const [attachments, setAttachments] = React.useState([]);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef(null);
  const scrollRef = React.useRef(null);
  const msgs = (thread && thread.messages) || [];
  const last = msgs[msgs.length - 1];
  const streaming = !!(last && last.role === "assistant" && last.streaming);
  const sessionTokens = msgs.reduce((a, m) => a + (m.tokens || 0), 0);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs.length, streaming, last && last.text]);

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    for (const f of files) {
      try {
        const dataB64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
        const resp = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name, dataB64 }) });
        if (resp.ok) { const data = await resp.json(); setAttachments((a) => [...a, data]); }
      } catch {}
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }
  const removeAttachment = (i) => setAttachments((a) => a.filter((_, idx) => idx !== i));
  function onPaste(e) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    const files = [];
    for (const it of items) { if (it.kind === "file") { const f = it.getAsFile(); if (f) files.push(f); } }
    if (files.length) { e.preventDefault(); addFiles(files); } // paste an image/file straight in
  }

  const send = () => {
    const t = input.trim();
    if ((!t && !attachments.length) || streaming || uploading) return;
    onSend(t, attachments);
    setInput(""); setAttachments([]);
  };

  return (
    <div className="h-full flex flex-col">
      {/* header */}
      <div className="flex items-center justify-between px-7 py-2.5 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 text-[12px] min-w-0" style={{ color: "var(--muted)" }}>
          <Icon name="bolt" size={13} />
          <span className="truncate">
            {thread && thread.sessionId
              ? <>Session · <span className="font-mono">{thread.sessionId.slice(0, 8)}</span></>
              : "New conversation"}
            {sessionTokens > 0 && <span className="font-mono"> · {fmtTok(sessionTokens)} tok</span>}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onNewChat} disabled={streaming}
            className="flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-lg border transition-colors hover:bg-[var(--hover)] disabled:opacity-40"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            <Icon name="plus" size={13} /> New chat
          </button>
          {(msgs.length > 0 || (thread && thread.sessionId)) && (
            <button onClick={onNewChat}
              title={streaming ? "Stop and close this session" : "Close & clear this session"}
              className="flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-lg border transition-colors"
              style={{ borderColor: "color-mix(in srgb, var(--error) 30%, var(--border))", color: "var(--error)", background: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--error) 12%, transparent)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <Icon name="x" size={13} /> {streaming ? "Stop & close" : "Close"}
            </button>
          )}
        </div>
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
              <div className="max-w-[80%] flex flex-col items-end gap-1.5">
                {m.attachments && m.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {m.attachments.map((at, i) => at.isImage
                      ? <img key={i} src={at.url} alt={at.name} className="rounded-lg border" style={{ maxWidth: 150, maxHeight: 150, borderColor: "var(--border)" }} />
                      : <span key={i} className="flex items-center gap-1.5 text-[11.5px] rounded-lg border px-2 py-1" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--muted)" }}><Icon name="doc" size={12} /> {at.name}</span>)}
                  </div>
                )}
                {m.text && (
                  <div className="rounded-2xl rounded-br-md px-3.5 py-2 text-[13px] whitespace-pre-wrap"
                    style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--text)" }}>{m.text}</div>
                )}
              </div>
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
                  <ChatTrace events={m.events} streaming={m.streaming} />
                </div>
                {m.text && !m.streaming && (
                  <div className="mt-1 flex items-center gap-2">
                    <window.CopyBtn text={m.text} />
                    {m.tokens ? (
                      <span className="text-[10.5px] font-mono" style={{ color: "var(--faint)" }}>
                        {fmtTok(m.tokens)} tok{m.cached ? ` · ⚡${fmtTok(m.cached)} cached` : ""}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* composer */}
      <div className="px-7 py-3 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[760px] mx-auto rounded-2xl border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
          {(attachments.length > 0 || uploading) && (
            <div className="flex flex-wrap gap-1.5 px-1 pb-2">
              {attachments.map((at, i) => (
                <span key={i} className="flex items-center gap-1.5 text-[11.5px] rounded-lg border pl-1.5 pr-1 py-1" style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--muted)" }}>
                  {at.isImage ? <img src={at.url} alt="" className="w-5 h-5 rounded object-cover" /> : <Icon name="doc" size={13} />}
                  <span className="max-w-[140px] truncate">{at.name}</span>
                  <button onClick={() => removeAttachment(i)} className="grid place-items-center w-4 h-4 rounded opacity-50 hover:opacity-100"><Icon name="x" size={11} /></button>
                </span>
              ))}
              {uploading && <span className="text-[11.5px] flex items-center gap-1.5" style={{ color: "var(--faint)" }}><span className="w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} /> uploading…</span>}
            </div>
          )}
          <div className="flex items-end gap-2">
            <button onClick={() => fileRef.current && fileRef.current.click()} disabled={streaming} title="Attach files or images"
              className="grid place-items-center w-9 h-9 rounded-lg shrink-0 transition-colors hover:bg-[var(--hover)] disabled:opacity-40" style={{ color: "var(--muted)" }}>
              <Icon name="paperclip" size={17} />
            </button>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
            <textarea value={input} onChange={(e) => setInput(e.target.value)} disabled={streaming}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send(); }}
              onPaste={onPaste}
              placeholder={`Message ${agent.name}…`} rows={1}
              className="flex-1 resize-none outline-none bg-transparent px-2 py-1.5 text-[14px] scroll-thin"
              style={{ color: "var(--text)", maxHeight: 140 }} />
            <Btn variant="primary" size="md" onClick={send} disabled={(!input.trim() && !attachments.length) || streaming || uploading}><Icon name="play" size={13} /> Send</Btn>
          </div>
        </div>
        <div className="max-w-[760px] mx-auto text-[11px] font-mono pt-1.5 pl-2" style={{ color: "var(--faint)" }}>⌘↵ to send · 📎 attach files/images · remembers within this chat</div>
      </div>
    </div>
  );
}

Object.assign(window, { ChatTab });
