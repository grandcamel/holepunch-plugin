---
name: modules
description: Quick reference for choosing Holepunch modules
argument-hint: "[networking|data|advanced]"
allowed-tools:
  - Read
---

# Holepunch Module Selection Guide

Help the user choose the right Holepunch modules for their use case.

## Quick Decision Tree

Present this decision tree to help users choose:

```
What's your primary goal?

1. CONNECT PEERS
   ├─ I have their public key → HyperDHT
   └─ Find by topic/name → Hyperswarm

2. STORE/SHARE DATA
   ├─ Raw log/stream → Hypercore
   ├─ Key-value database → Hyperbee
   └─ Files/folders → Hyperdrive

3. ADVANCED
   ├─ Multiple writers → Autobase
   └─ Many cores → Corestore
```

## Module Quick Reference

### Networking Layer

| Module | Purpose | Install |
|--------|---------|---------|
| **Hyperswarm** | Find peers by topic | `npm install hyperswarm` |
| **HyperDHT** | Direct peer connection | `npm install hyperdht` |

**When to use Hyperswarm:**
- Chat rooms, collaborative apps
- Finding peers interested in same content
- Most common choice

**When to use HyperDHT:**
- Direct peer-to-peer when you already have their key
- Building custom protocols
- Lower level control needed

### Data Layer

| Module | Purpose | Install |
|--------|---------|---------|
| **Hypercore** | Append-only log | `npm install hypercore` |
| **Hyperbee** | Key-value database | `npm install hyperbee` |
| **Hyperdrive** | P2P filesystem | `npm install hyperdrive corestore` |

**When to use Hypercore:**
- Event logs, chat messages
- Streaming data
- Foundation for other modules

**When to use Hyperbee:**
- User profiles, settings
- Sorted data with range queries
- Database-like operations

**When to use Hyperdrive:**
- File sharing
- Document sync
- Any file-based data

### Aggregation Layer

| Module | Purpose | Install |
|--------|---------|---------|
| **Corestore** | Manage multiple cores | `npm install corestore` |
| **Autobase** | Multi-writer support | `npm install autobase` |

**When to use Corestore:**
- Apps with multiple data streams
- Simplified replication
- Deterministic key derivation

**When to use Autobase:**
- Multiple users writing to same data
- Collaborative editing
- Conflict resolution needed

## Common Combinations

### Chat Application
```
Hyperswarm + Hypercore
- Hyperswarm for peer discovery
- Hypercore for message log
```

### File Sharing
```
Hyperswarm + Hyperdrive + Corestore
- Hyperswarm for discovery
- Hyperdrive for files
- Corestore manages underlying cores
```

### Collaborative Database
```
Hyperswarm + Autobase + Hyperbee + Corestore
- Hyperswarm for discovery
- Autobase for multi-writer
- Hyperbee as the view
- Corestore for storage
```

### Simple Key-Value Store
```
Hyperswarm + Hyperbee + Hypercore
- Hyperswarm for discovery
- Hyperbee for K-V ops
- Hypercore as foundation
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Aggregation Layer                          │
│    Corestore (core factory)  │  Autobase (multiwriter)  │
├─────────────────────────────────────────────────────────┤
│                  Data Layer                             │
│  Hypercore (logs) │ Hyperbee (KV) │ Hyperdrive (files)  │
├─────────────────────────────────────────────────────────┤
│               Networking Layer                          │
│       HyperDHT (direct)  │  Hyperswarm (discovery)      │
└─────────────────────────────────────────────────────────┘
```

## Based on User's Argument

If user specifies a category:

- **networking**: Focus on Hyperswarm vs HyperDHT comparison
- **data**: Focus on Hypercore vs Hyperbee vs Hyperdrive
- **advanced**: Focus on Corestore and Autobase

## Additional Help

For detailed API documentation, refer user to:
- `references/modules.md` for complete module documentation
- NotebookLM: "Ask my Pear notebook about [module name]"
