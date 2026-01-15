# Holepunch P2P Development Plugin

A Claude Code plugin for building zero-infrastructure peer-to-peer applications using the Holepunch ecosystem.

## Features

- **Skill**: Comprehensive guidance for Holepunch/Pear development
- **Commands**: Scaffold apps, debug issues, select modules
- **Agents**: Proactive code review and troubleshooting

## Installation

```bash
# Use directly with Claude Code
claude --plugin-dir /path/to/holepunch-dev

# Or copy to your project
cp -r holepunch-dev/.claude-plugin your-project/
```

## Components

### Skill: Holepunch P2P Development

Activates when you:
- Ask to "create a P2P app" or "build with Holepunch"
- Mention Hypercore, Hyperswarm, Hyperdrive, Hyperbee
- Work with Pear, Bare, HyperDHT, Autobase, or Corestore

### Commands

| Command | Description |
|---------|-------------|
| `/holepunch:scaffold` | Create new Pear desktop/terminal app |
| `/holepunch:debug` | Debug P2P connectivity issues |
| `/holepunch:modules` | Quick module selection guide |

### Agents

| Agent | Triggers When |
|-------|---------------|
| `p2p-code-reviewer` | Reviewing code with Holepunch imports |
| `p2p-troubleshooter` | Debugging P2P connectivity/replication issues |

## Module Quick Reference

| Need | Module |
|------|--------|
| Find peers by topic | Hyperswarm |
| Direct P2P connection | HyperDHT |
| Append-only log | Hypercore |
| Key-value database | Hyperbee |
| P2P filesystem | Hyperdrive |
| Multiple writers | Autobase |
| Manage many cores | Corestore |

## Examples

Working examples in `examples/`:

- `hyperswarm-basic.js` - Peer discovery and messaging
- `hypercore-replication.js` - Data sharing between peers
- `hyperdrive-files.js` - P2P file sharing

## Reference Documentation

Detailed docs in `skills/holepunch/references/`:

- `modules.md` - Complete module API reference
- `platforms.md` - Desktop, terminal, mobile guidance
- `debugging.md` - Troubleshooting guide
- `best-practices.md` - Patterns, security, performance

## NotebookLM Integration

For deeper API documentation, query your Pear P2P Platform notebook:

```
"Ask my Pear notebook about Autobase linearization"
"What does my P2P docs say about Hypercore manifests?"
```

## Resources

- [Pear Documentation](https://docs.pears.com)
- [Holepunch Documentation](https://docs.holepunch.to)
- [GitHub](https://github.com/holepunchto)
