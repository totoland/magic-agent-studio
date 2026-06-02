// data.jsx — static constants for Agent Studio.
// Agents, routines, and run events now come from the real backend API (see app.jsx).
// This file only holds picker constants + templates + the avatar color map.

const TOOLS = [
  "Read", "Write", "Edit", "MultiEdit", "NotebookEdit",
  "Bash", "Grep", "Glob", "WebSearch", "WebFetch", "Task", "TodoWrite",
  // common MCP tools available in this environment
  "mcp__claude_ai_Crypto_com__get_ticker",
  "mcp__claude_ai_Crypto_com__get_candlestick",
  "mcp__claude_ai_Crypto_com__get_book",
  "mcp__claude_ai_Crypto_com__get_trades",
  "mcp__claude_ai_Google_Drive__create_file",
  "mcp__claude_ai_Google_Drive__search_files",
  "mcp__claude_ai_Google_Drive__read_file_content",
];

const MODELS = [
  { id: "inherit", label: "inherit", hint: "use the session model" },
  { id: "opus",    label: "opus",    hint: "most capable, slower" },
  { id: "sonnet",  label: "sonnet",  hint: "balanced default" },
  { id: "haiku",   label: "haiku",   hint: "fastest, cheapest" },
];

const AGENT_COLORS = {
  indigo: "#6366f1", teal: "#14b8a6", amber: "#f59e0b",
  rose: "#fb7185", violet: "#a78bfa", sky: "#38bdf8", lime: "#a3e635",
};

const TEMPLATES = [
  {
    id: "blank", name: "Blank agent", glyph: "＋", color: "indigo",
    blurb: "Start from an empty persona.",
    seed: { avatar: null, description: "", model: "inherit", tools: ["Read"],
      body: "You are a new agent.\n\n## When to use me\n\n## How I work\n" },
  },
  {
    id: "researcher", name: "Researcher", glyph: "✎", color: "indigo",
    avatar: { type: "preset", id: "iris" },
    blurb: "Gathers sources and writes cited briefs.",
    seed: { avatar: { type: "preset", id: "iris" },
      description: "Researches a question across sources and writes a cited brief.",
      model: "inherit", tools: ["Read", "Write", "WebSearch", "WebFetch", "TodoWrite"],
      body: "You are a research agent. Decompose the question, gather independent\nsources, triangulate, and footnote every claim. Never invent a citation." },
  },
  {
    id: "coder", name: "Coder", glyph: "⚙", color: "violet",
    avatar: { type: "preset", id: "plum" },
    blurb: "Surgical code fixes with tests.",
    seed: { avatar: { type: "preset", id: "plum" },
      description: "Makes small, tested code changes and runs the build.",
      model: "inherit", tools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
      body: "You are an engineer. Smallest diff that solves it. Reproduce, test, fix,\nrun the build. Never push to main." },
  },
  {
    id: "analyst", name: "Analyst", glyph: "◆", color: "amber",
    avatar: { type: "preset", id: "ember" },
    blurb: "Reads live data and frames the risk.",
    seed: { avatar: { type: "preset", id: "ember" },
      description: "Pulls live data and gives a numbers-first read with risks.",
      model: "sonnet", tools: ["Read", "WebSearch", "WebFetch"],
      body: "You are an analyst. Numbers first, opinion second. Always state a base\ncase and what would invalidate it. Never give financial advice." },
  },
];

window.STUDIO_DATA = { TOOLS, MODELS, TEMPLATES, AGENT_COLORS };
