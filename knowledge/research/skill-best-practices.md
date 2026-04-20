# Research: Skill Authoring Best Practices

## Sources
- Anthropic official: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Amplitude MCP Marketplace: https://github.com/amplitude/mcp-marketplace
- Community skills: https://github.com/alirezarezvani/claude-skills, https://github.com/ComposioHQ/awesome-claude-skills

## Critical Design Principles

### 1. Concise is Key
- SKILL.md body under 500 lines
- Only add context Claude doesn't already have
- Challenge each piece: "Does Claude really need this explanation?"
- Use progressive disclosure: main SKILL.md → reference files loaded on-demand

### 2. Multi-Phase Workflow Pattern (from Amplitude)
Every skill should follow:
1. **Bootstrap context** — get_context, get_project_context, parallel discovery searches
2. **Gather evidence** — parallel queries, batch chart fetches, funnel analysis
3. **Synthesize** — structured findings with scoring
4. **Validate** — check for false positives, seasonality, already-shipped fixes
5. **Deliver** — narrative memo format, not tables

### 3. Narrative Output (NOT Tables)
- "Numbers are evidence, not the story. Lead with the insight."
- Write findings as paragraphs for a team email, not database records
- Headlines are insights ("Card payments on Android broke this week"), not labels ("Card Payment Update")
- Approximate: "~42%" not "42.37%"
- Active voice only
- Always state time anchor
- 500-700 words for weekly brief, 800-1200 for opportunity reports

### 4. Parallel Discovery Pattern
Always run TWO parallel searches:
- Search A: Official content, sorted by viewCount (what org values)
- Search B: Recent activity, sorted by lastModified (what's being worked on)
- Content in BOTH = highest priority

### 5. Evidence Requirements
- Multi-source evidence required (analytics + code, funnel + errors)
- Confidence scoring: 100% (multi-source), 80% (corroborating), 50% (single), 20% (anecdotal)
- Quality gate: only present high-confidence findings as full issues

### 6. Trigger Descriptions
- Third person: "Analyzes..." not "I can help you..."
- Include BOTH what it does AND when to use it
- Include trigger phrases: "Use when user asks 'why did X drop'"

### 7. Progressive Disclosure
```
skill-folder/
├── SKILL.md              # Main instructions (<500 lines)
├── reference/
│   ├── funnels.md        # Funnel definitions (loaded on demand)
│   ├── events.md         # Event catalog (loaded on demand)
│   └── platforms.md      # Platform mapping (loaded on demand)
```

### 8. Feedback Loops
- Run analysis → validate findings → fix false positives → deliver
- Always end with follow-on question

### 9. Persona Calibration
| Persona | Focus |
|---------|-------|
| Executive | Revenue, competitive position, strategic outcomes |
| PM | Features, conversion, adoption, activation |
| Analyst | Statistical rigor, methodology, drill-downs |
| Growth | Channels, retention cohorts, LTV, acquisition |
| Engineering | Errors, latency, deployments, crashes |

### 10. What Makes Our Skills Unique vs Amplitude's
Amplitude's skills query data. Ours also:
- Cross-reference with actual source code (file:line)
- Compare tracking implementation across codebases
- Correlate code changes (git log) with metric changes
- Find tracking gaps (code events vs Amplitude events)
- Platform-specific code analysis (galileo-site vs xe-apollo)
