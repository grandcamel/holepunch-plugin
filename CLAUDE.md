# Holepunch P2P Development Plugin

Claude Code plugin for building zero-infrastructure P2P applications with the Holepunch ecosystem.

## Project Structure

```
holepunch-dev/
├── .claude-plugin/plugin.json   # Plugin manifest
├── commands/                     # Slash commands
├── agents/                       # Specialized agents
├── skills/holepunch/            # Main skill + references
├── examples/                     # Working code examples
└── scripts/                      # Utility scripts
```

## Development Guidelines

### Versioning

- Version is tracked in `VERSION` file (semver.org format)
- Also update `.claude-plugin/plugin.json` version field when releasing

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
claude --plugin-dir /path/to/holepunch-dev
```

### Component Conventions

- **Commands**: Write instructions FOR Claude, not TO user
- **Agents**: Include `<examples>` blocks for trigger patterns
- **Skills**: Use third-person description, imperative body
- **Paths**: Use `${CLAUDE_PLUGIN_ROOT}` for portability

## Key Files

| File | Purpose |
|------|---------|
| `skills/holepunch/SKILL.md` | Main skill with module guide |
| `skills/holepunch/references/` | Detailed API documentation |
| `commands/*.md` | User-invocable slash commands |
| `agents/*.md` | Proactive specialized agents |
