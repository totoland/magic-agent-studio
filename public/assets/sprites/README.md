# Agent sprites — drop-in convention (no code changes)

The Office view auto-discovers each agent's sprites from this folder. To give an
agent sprites, just create a folder named after the **agent id** and drop PNGs in,
following the filename convention below. The backend picks them up automatically —
**no code or config to edit.**

```
public/assets/sprites/
  <agent-id>/
    idle.png            ← required (default standing pose)
    work-1.png  work-2.png       ← busy / running (typing at desk)
    thinking-1.png  thinking-2.png
    talking-1.png   talking-2.png
    greet-1.png     greet-2.png
    celebrate-1.png celebrate-2.png
```

## Rules
- **Folder name = agent id** (the `.md` filename, e.g. `akane`, `mark`, `nota`).
- **One file per static pose:** `<state>.png`
- **Multiple frames = animated loop:** `<state>-1.png`, `<state>-2.png`, … (played
  ping-pong, ~0.46s/frame). 2 frames is plenty for a soft loop.
- **States used by the Office:** `idle`, `work`, `thinking`, `talking`, `celebrate`, `greet`.
  - `idle` is the fallback for any missing state.
- **Image format:** transparent PNG, full body, feet at bottom-center, consistent
  scale across an agent's frames. (Backgrounds are auto-trimmed.)

## State → when it shows
| state | triggered by |
|-------|--------------|
| idle | default / no activity |
| work | a run, or the agent calling a tool (busy) |
| thinking | the agent is reasoning (SSE `thinking`) |
| talking | the agent is replying in chat |
| celebrate | (manual / future: task finished) |
| greet | (manual / future: on open) |

Tip: right-click an agent in the Office to **test** any state without running it.

## Example
`akane/` ships with idle · work · thinking · talking · greet (2-frame loops).
Copy that folder's structure for a new agent and replace the images.
