---
name: Holepunch P2P Development
description: This skill should be used when the user asks to "create a P2P app", "build with Holepunch", "use Hypercore", "use Hyperswarm", "create a Pear application", "build peer-to-peer", "use Hyperdrive", "use Hyperbee", "debug P2P connectivity", "choose between Hypercore modules", or mentions Holepunch, Pear runtime, HyperDHT, Autobase, Corestore, or Bare runtime. Provides guidance for building zero-infrastructure P2P applications.
---

# Holepunch P2P Development

Build zero-infrastructure, peer-to-peer applications using the Holepunch ecosystem and Pear platform.

## Overview

The Holepunch ecosystem provides modular building blocks for creating "unstoppable" P2P applications that run without servers. Applications connect users directly using end-to-end encrypted connections.

**Core Stack:**
- **Pear** - P2P runtime, development, and deployment platform
- **Bare** - Lightweight JavaScript runtime (foundation for Pear)
- **Hypercore** - Secure, append-only log (data foundation)
- **Hyperswarm** - Peer discovery and connection

## Module Selection Guide

Choose modules based on the primary goal:

### Finding and Connecting Peers

| Need | Module |
|------|--------|
| Connect to specific peer by public key | **HyperDHT** |
| Find peers interested in a topic/name | **Hyperswarm** |

### Storing and Sharing Data

| Need | Module |
|------|--------|
| Raw append-only log/stream | **Hypercore** |
| Key-value database with sorted iteration | **Hyperbee** |
| Files and folders (filesystem) | **Hyperdrive** |

### Advanced Scenarios

| Need | Module |
|------|--------|
| Multiple writers collaborating | **Autobase** |
| Managing many Hypercores | **Corestore** |

### Decision Tree

```
1. Primary goal?
   ├─ Find/connect peers → Step 2
   └─ Store/share data → Step 3

2. Peer connection type?
   ├─ Have their public key → HyperDHT
   └─ Find by topic name → Hyperswarm

3. Data organization?
   ├─ Raw log/stream → Hypercore
   ├─ Key-value pairs → Hyperbee
   └─ Files/folders → Hyperdrive

4. Multiple writers? → Add Autobase
5. Many cores to manage? → Add Corestore
```

## Quick Start

### Install Pear Runtime

```bash
npx pear
# Follow PATH instructions from output
```

### Create Desktop Application

```bash
mkdir my-app && cd my-app
npm init -y
npm install pear-electron hyperswarm hypercore
```

**package.json** - Add pear configuration:
```json
{
  "name": "my-app",
  "main": "index.js",
  "pear": {
    "name": "my-app",
    "type": "desktop"
  }
}
```

### Create Terminal Application

```bash
mkdir my-cli && cd my-cli
npm init -y
npm install pear-terminal hyperswarm
```

**package.json**:
```json
{
  "name": "my-cli",
  "main": "index.js",
  "pear": {
    "name": "my-cli",
    "type": "terminal"
  }
}
```

### Run Locally

```bash
pear run --dev .
```

### Deploy/Share

```bash
pear stage .           # Sync to app drive
pear seed .            # Share with network
pear release .         # Production release
```

Applications are shared via `pear://` links.

## Essential Patterns

### Peer Discovery with Hyperswarm

```javascript
import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'

const swarm = new Hyperswarm()
const topic = crypto.discoveryKey(Buffer.from('my-app-topic'))

// Join as both client and server
swarm.join(topic, { client: true, server: true })

swarm.on('connection', (socket, peerInfo) => {
  console.log('Connected to peer:', peerInfo.publicKey.toString('hex').slice(0, 8))
  // Use socket for communication
})

// Wait for connections
await swarm.flush()
```

### Data Sharing with Hypercore

```javascript
import Hypercore from 'hypercore'
import Hyperswarm from 'hyperswarm'

const core = new Hypercore('./my-data')
await core.ready()

const swarm = new Hyperswarm()
swarm.join(core.discoveryKey)

swarm.on('connection', socket => core.replicate(socket))

// Write data (only creator can write)
await core.append(Buffer.from('Hello P2P!'))

// Read data
const block = await core.get(0)
```

### File Sharing with Hyperdrive

```javascript
import Hyperdrive from 'hyperdrive'
import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'

const store = new Corestore('./storage')
const drive = new Hyperdrive(store)
await drive.ready()

const swarm = new Hyperswarm()
swarm.join(drive.discoveryKey)
swarm.on('connection', socket => store.replicate(socket))

// Write file
await drive.put('/hello.txt', Buffer.from('Hello!'))

// Read file
const data = await drive.get('/hello.txt')
```

## Critical Concepts

### Discovery Keys vs Public Keys

- **Public Key**: Verifies data authenticity, required to decrypt
- **Discovery Key**: Hash of public key, safe to share for peer discovery
- **Always use discovery keys** for `swarm.join()` to avoid leaking the ability to read data

### The findingPeers() Pattern

When waiting for network data, always signal that peer discovery is in progress:

```javascript
const done = core.findingPeers()
swarm.join(core.discoveryKey)
await swarm.flush()
done()

// Now safe to check for updates
const updated = await core.update()
```

Skipping this causes `core.update()` to return immediately without waiting for peers.

### Resource Cleanup

Always close resources explicitly:

```javascript
await core.close()
await drive.close()
await swarm.destroy()
```

For mobile/desktop apps, use suspend/resume:

```javascript
swarm.suspend()  // When app backgrounds
swarm.resume()   // When app foregrounds
```

## NotebookLM Integration

For deeper API documentation and advanced patterns, query the Pear P2P Platform notebook:

```
"Ask my Pear notebook about [specific topic]"
"What does my P2P docs say about [module/pattern]?"
```

Example queries:
- "Ask my Pear notebook about Autobase linearization"
- "What does my P2P docs say about Hypercore manifests?"
- "How do I implement firewalling in Hyperswarm?"

## Common Issues Quick Reference

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| Peers not connecting | Firewall/NAT | Check `swarm.on('ban')` events |
| `core.update()` returns false immediately | Missing `findingPeers()` | Add findingPeers pattern |
| Data not replicating | Sparse mode | Use `core.download()` for full sync |
| Connection drops on mobile | App lifecycle | Use `swarm.suspend()`/`resume()` |

## Reference Files

For detailed information, consult these files in the skill directory:

- **`references/modules.md`** - Deep dive into each module's API and usage
- **`references/platforms.md`** - Platform-specific guidance (desktop, terminal, mobile)
- **`references/debugging.md`** - Troubleshooting connectivity, replication, and discovery
- **`references/best-practices.md`** - Patterns, anti-patterns, security, performance

## Example Files

Working examples in the skill's `examples/` directory:

- **`examples/hyperswarm-basic.js`** - Simple peer discovery and messaging
- **`examples/hypercore-replication.js`** - Data sharing between peers
- **`examples/hyperdrive-files.js`** - P2P file sharing

## Commands

Use these plugin commands for quick actions:

- **`/holepunch:scaffold`** - Scaffold new Pear desktop or terminal app
- **`/holepunch:debug`** - Debug P2P connectivity issues
- **`/holepunch:modules`** - Quick module selection guide

## Scripts

Utility scripts in the skill's `scripts/` directory:

- **`scripts/scaffold-pear.sh`** - Scaffold new Pear desktop or terminal app

## Specialized Agents

This plugin includes agents that activate automatically:

- **p2p-code-reviewer** - Reviews P2P code for best practices, anti-patterns, and security
- **p2p-troubleshooter** - Diagnoses connectivity, replication, and discovery issues

## Key Resources

- **Pear Docs**: https://docs.pears.com
- **Holepunch Docs**: https://docs.holepunch.to
- **GitHub**: https://github.com/holepunchto
