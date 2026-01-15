# Holepunch P2P Development Marketplace

Claude Code marketplace providing plugins for building zero-infrastructure P2P applications with the Holepunch ecosystem.

## Project Structure

```
holepunch-plugin/
├── .claude-plugin/
│   └── marketplace.json         # Marketplace metadata
├── plugins/
│   └── holepunch/               # Main plugin
│       ├── .claude-plugin/
│       │   └── plugin.json      # Plugin metadata
│       ├── agents/              # Proactive agents
│       ├── commands/            # Slash commands
│       └── skills/
│           └── holepunch/       # P2P development skill
│               ├── SKILL.md
│               ├── references/  # API documentation
│               ├── examples/    # Working code examples
│               └── scripts/     # Utility scripts
├── README.md
├── LICENSE
└── VERSION
```

## Development Guidelines

### Versioning

Version is tracked in three places (keep in sync):
- `VERSION` file (semver.org format)
- `.claude-plugin/marketplace.json` → `metadata.version` and `plugins[].version`
- `plugins/holepunch/.claude-plugin/plugin.json` → `version`

### Commit Messages

Use conventional commits:
- `feat:` - New features (commands, agents, skills)
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code restructuring
- `chore:` - Maintenance tasks

### Testing

Test plugin locally:
```bash
# Test the plugin directly
claude --plugin-dir ./plugins/holepunch

# Or test via marketplace
claude --plugin-dir .
```

### Component Conventions

- **Commands**: Write instructions FOR Claude, not TO user
- **Agents**: Include `<examples>` blocks for trigger patterns
- **Skills**: Use third-person description, imperative body
- **Paths**: Use `${CLAUDE_PLUGIN_ROOT}` for portability

## Key Files

| File | Purpose |
|------|---------|
| `.claude-plugin/marketplace.json` | Marketplace definition |
| `plugins/holepunch/.claude-plugin/plugin.json` | Plugin metadata |
| `plugins/holepunch/skills/holepunch/SKILL.md` | Main skill |
| `plugins/holepunch/skills/holepunch/references/` | API documentation |
| `plugins/holepunch/commands/*.md` | Slash commands |
| `plugins/holepunch/agents/*.md` | Proactive agents |

## Adding New Plugins

To add another plugin to this marketplace:

1. Create `plugins/<plugin-name>/.claude-plugin/plugin.json`
2. Add plugin components (commands, agents, skills)
3. Register in `.claude-plugin/marketplace.json` under `plugins[]`
4. Update VERSION and all version fields
