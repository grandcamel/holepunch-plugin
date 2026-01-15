# Best Practices for Holepunch Development

Patterns, anti-patterns, security considerations, and performance optimization.

## Resource Management

### Proper Cleanup

Always close resources explicitly to prevent memory leaks and connection issues.

**Hypercore**:
```javascript
const core = new Hypercore('./data')
await core.ready()

// ... use core ...

// Always close
await core.close()
```

**Hyperbee**:
```javascript
const db = new Hyperbee(core)
await db.ready()

// ... use db ...

// Close both db and underlying core
await db.close()
```

**Hyperdrive**:
```javascript
const drive = new Hyperdrive(store)
await drive.ready()

// ... use drive ...

await drive.close()
```

**Hyperswarm**:
```javascript
const swarm = new Hyperswarm()

// ... use swarm ...

// Destroy closes all connections
await swarm.destroy()
```

**Corestore**:
```javascript
const store = new Corestore('./storage')

// Get cores (sessions)
const core1 = store.get({ name: 'data1' })
const core2 = store.get({ name: 'data2' })

// Close individual sessions if needed
await core1.close()

// Or close entire store
await store.close()
```

### Session Management with Corestore

Corestore tracks sessions automatically:

```javascript
const store = new Corestore('./storage')

// Multiple gets of same core share resources
const core1 = store.get({ name: 'data' })
const core2 = store.get({ name: 'data' })  // Same underlying core

// Resources released only when ALL sessions close
await core1.close()  // Resources still held
await core2.close()  // Now resources released
```

### Teardown in Pear Apps

```javascript
/* global Pear */
import Hyperswarm from 'hyperswarm'

const swarm = new Hyperswarm()

// Register cleanup handler
Pear.teardown(async () => {
  console.log('Cleaning up...')
  await swarm.destroy()
})

// Your app logic
```

### Mobile Lifecycle

```javascript
// In Bare worklet
Bare.on('suspend', () => {
  // App going to background
  swarm.suspend()
  // Save state if needed
})

Bare.on('resume', () => {
  // App coming to foreground
  swarm.resume()
})

Bare.on('exit', () => {
  // Final cleanup - NO ASYNC!
  // Don't schedule new work here
})
```

---

## Error Handling

### Global Exception Handling

```javascript
// In Bare/Pear apps
Bare.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
  // Log, report, but don't exit if recoverable
})

Bare.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})
```

### Timeouts for Network Operations

```javascript
// Always use timeouts for get()
try {
  const block = await core.get(index, { timeout: 5000 })
} catch (err) {
  if (err.code === 'REQUEST_TIMEOUT') {
    console.log('Block not available from peers')
  }
  throw err
}
```

### Graceful Degradation

```javascript
async function getData(core, index) {
  try {
    return await core.get(index, { timeout: 5000 })
  } catch (err) {
    // Return cached/default if network unavailable
    const cached = await localCache.get(index)
    if (cached) return cached

    throw new Error(`Data unavailable: ${err.message}`)
  }
}
```

### Swarm Ban Handling

```javascript
swarm.on('ban', (peerInfo, err) => {
  // Log for debugging
  console.warn('Peer banned:', {
    key: peerInfo.publicKey?.toString('hex').slice(0, 8),
    error: err.message
  })

  // Could implement retry logic here
})
```

### Autobase Interrupts

```javascript
const base = new Autobase(store, null, {
  async apply(batch, view, base) {
    for (const node of batch) {
      const op = JSON.parse(node.value.toString())

      // Handle unknown operations gracefully
      if (!knownOperations.has(op.type)) {
        // Interrupt if we can't process
        base.host.interrupt(new Error(`Unknown op: ${op.type}`))
        return
      }

      await processOp(op, view)
    }
  }
})
```

---

## Security

### Discovery Key vs Public Key

**Critical**: Never use public keys for peer discovery.

```javascript
// WRONG - leaks ability to verify/decrypt data
swarm.join(core.key)  // Public key exposed!

// CORRECT - use discovery key (hash)
swarm.join(core.discoveryKey)  // Safe to share
```

The discovery key lets peers find each other without revealing the key needed to verify or decrypt data.

### Key Derivation with Corestore

Use deterministic key derivation:

```javascript
// Generate or load a primary key securely
const primaryKey = loadFromSecureStorage() ||
  crypto.randomBytes(32)

const store = new Corestore('./storage', { primaryKey })

// All core keys derived from primaryKey + name
const userData = store.get({ name: 'user-data' })
const messages = store.get({ name: 'messages' })

// Same primaryKey + name = same keys every time
// Makes backup/restore possible
```

### Firewalling Connections

```javascript
// Implement allowlist
const allowedPeers = new Set()

const server = dht.createServer({
  firewall(remotePublicKey, payload) {
    const key = remotePublicKey.toString('hex')

    if (!allowedPeers.has(key)) {
      console.log('Rejected:', key.slice(0, 8))
      return false
    }

    return true
  }
})

// Or in Hyperswarm
const swarm = new Hyperswarm({
  firewall(remotePublicKey) {
    return allowedPeers.has(remotePublicKey.toString('hex'))
  }
})
```

### Verifying Peer Identity

```javascript
swarm.on('connection', (socket, info) => {
  const peerKey = info.publicKey.toString('hex')

  // Verify against expected peers
  if (!trustedPeers.includes(peerKey)) {
    console.warn('Unknown peer, closing connection')
    socket.destroy()
    return
  }

  // Proceed with trusted peer
  core.replicate(socket)
})
```

### Encrypted by Default

All Hyperswarm/HyperDHT connections use Noise protocol encryption. No additional encryption needed for transport.

```javascript
// Connections are already E2E encrypted
swarm.on('connection', (socket) => {
  // socket is a Noise-encrypted stream
  // Safe to send sensitive data directly
  socket.write(sensitiveData)
})
```

---

## Performance

### Batching Writes

Single writes are slow; batching is much faster:

```javascript
// SLOW - individual writes
for (const item of items) {
  await db.put(item.key, item.value)  // Separate I/O for each
}

// FAST - batched writes
const batch = db.batch()
for (const item of items) {
  await batch.put(item.key, item.value)  // Buffered
}
await batch.flush()  // Single atomic write
```

**Hypercore batching**:
```javascript
// SLOW
for (const block of blocks) {
  await core.append(block)
}

// FAST
await core.append(blocks)  // Array of blocks
```

### Sparse Replication

Only download what you need:

```javascript
// Default: sparse mode
const core = new Hypercore('./data', remoteKey)

// Only downloads block 100
const block = await core.get(100)

// Download range on-demand
const range = core.download({ start: 0, end: 100 })
await range.done()
```

### Linear Downloads

For sequential data (video, large files):

```javascript
// Prioritize sequential blocks
const range = core.download({
  start: 0,
  end: -1,
  linear: true  // Download in order
})
```

### Autobase Big Batches

```javascript
const base = new Autobase(store, null, {
  // ...
})

// Trade responsiveness for throughput
base.setBigBatches(true)
```

### Connection Pooling

Reuse Hyperswarm instances:

```javascript
// WRONG - new swarm per core
for (const core of cores) {
  const swarm = new Hyperswarm()  // Wasteful!
  swarm.join(core.discoveryKey)
}

// CORRECT - single swarm, multiple topics
const swarm = new Hyperswarm()
for (const core of cores) {
  swarm.join(core.discoveryKey)
}
```

### Corestore Replication

Replicate entire store, not individual cores:

```javascript
const store = new Corestore('./storage')

swarm.on('connection', (socket) => {
  // Single replicate handles all cores
  store.replicate(socket)
})
```

---

## Anti-Patterns

### DON'T: Manual Snapshot Management in Watchers

```javascript
// WRONG - breaks watcher
for await (const [snapshot, current] of db.watch()) {
  // Do something
  await snapshot.close()  // NO! Auto-closed internally
}

// CORRECT - let it handle cleanup
for await (const [snapshot, current] of db.watch()) {
  // Use snapshot
  // Don't close it manually
}
```

### DON'T: Schedule Work on Exit

```javascript
// WRONG - async work in exit handler
Bare.on('exit', async () => {
  await saveState()  // Won't complete!
  await swarm.destroy()  // Won't complete!
})

// CORRECT - cleanup before exit
Bare.on('suspend', async () => {
  await saveState()  // Save on suspend
})

Bare.on('exit', () => {
  // Synchronous only
  console.log('Goodbye')
})
```

### DON'T: Forget findingPeers()

```javascript
// WRONG - update returns immediately
swarm.join(core.discoveryKey)
await swarm.flush()
const updated = await core.update()  // false!

// CORRECT - signal peer discovery
const done = core.findingPeers()
swarm.join(core.discoveryKey)
await swarm.flush()
done()
const updated = await core.update()  // Waits for peers
```

### DON'T: Forget setActive(false)

```javascript
// WRONG - channel never closes
core.setActive(true)
// ... forgot to set false ...

// CORRECT - always pair true/false
core.setActive(true)
try {
  // Intensive operations
} finally {
  core.setActive(false)  // Always cleanup
}
```

### DON'T: Use Public Key for Discovery

```javascript
// WRONG - exposes public key
swarm.join(core.key)

// CORRECT - use discovery key
swarm.join(core.discoveryKey)
```

### DON'T: Expect Automatic Key Exchange

```javascript
// WRONG - remote can't know about your cores
const core = store.get({ name: 'my-secret' })
// Remote peer has no way to discover this

// CORRECT - share keys out-of-band
const core = store.get({ name: 'my-secret' })
shareKeyViaSomeChannel(core.key.toString('hex'))

// Remote uses shared key
const remoteCopy = store.get(sharedKey)
```

---

## Patterns Summary

### Initialization Pattern

```javascript
async function initApp() {
  const store = new Corestore('./storage')
  const swarm = new Hyperswarm()

  // Register cleanup
  const cleanup = async () => {
    await swarm.destroy()
    await store.close()
  }

  // In Pear
  Pear.teardown(cleanup)

  // Or traditional
  process.on('SIGINT', async () => {
    await cleanup()
    process.exit(0)
  })

  return { store, swarm, cleanup }
}
```

### Replication Pattern

```javascript
async function setupReplication(store, swarm, cores) {
  // Join all discovery keys
  for (const core of cores) {
    const done = core.findingPeers()
    swarm.join(core.discoveryKey)

    swarm.flush().then(done)
  }

  // Single replication handler
  swarm.on('connection', (socket) => {
    store.replicate(socket)
  })

  // Wait for initial sync
  await swarm.flush()

  for (const core of cores) {
    await core.update()
  }
}
```

### Multiwriter Pattern

```javascript
async function setupMultiwriter(store) {
  const base = new Autobase(store, null, {
    open: (store) => new Hyperbee(store.get('view')),
    apply: async (batch, view) => {
      const b = view.batch()
      for (const node of batch) {
        const op = JSON.parse(node.value.toString())
        await b.put(op.key, op.value)
      }
      await b.flush()
    }
  })

  await base.ready()
  return base
}

// Add writers
async function addWriter(base, writerKey) {
  await base.addInput(writerKey)
  await base.view.update()
}
```

---

## Checklist

### Before Deployment

- [ ] All resources have cleanup handlers
- [ ] Teardown registered in Pear apps
- [ ] Using discovery keys (not public keys) for swarm.join()
- [ ] findingPeers() pattern implemented for replication
- [ ] Timeouts set for network operations
- [ ] Global exception handlers registered
- [ ] Mobile lifecycle (suspend/resume) handled
- [ ] Firewall configured if needed
- [ ] No async work in exit handlers
- [ ] Batching used for bulk operations
