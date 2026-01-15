# Debugging P2P Applications

Comprehensive troubleshooting guide for Holepunch applications.

## Common Issues Overview

| Category | Symptoms | Likely Cause |
|----------|----------|--------------|
| Connectivity | Peers not connecting | NAT/firewall, DHT issues |
| Replication | Data not syncing | Missing findingPeers, sparse mode |
| Discovery | Can't find peers | Topic mismatch, not flushed |
| Auth | Connection rejected | Key mismatch, firewall callback |

---

## Connectivity Issues

### NAT Traversal Failures

**Symptoms**:
- Peers discovered but connections fail
- Works on local network, fails across internet
- `ban` events with "firewalled" reason

**Diagnosis**:
```javascript
const swarm = new Hyperswarm()

// Monitor ban events
swarm.on('ban', (peerInfo, err) => {
  console.error('Peer banned:', {
    key: peerInfo.publicKey?.toString('hex').slice(0, 8),
    reason: err.message
  })
})

// Check if behind symmetric NAT
swarm.on('connection', (socket, info) => {
  console.log('Connection type:', info.type)  // 'relay' indicates NAT issues
})
```

**Solutions**:

1. **Ensure server mode for at least one peer**:
```javascript
// At least one peer must be a server
swarm.join(topic, { client: true, server: true })
```

2. **Check firewall settings**:
```javascript
// Don't accidentally block all connections
const server = dht.createServer({
  firewall(remotePublicKey, payload) {
    // Log rejections for debugging
    console.log('Firewall check:', remotePublicKey.toString('hex').slice(0, 8))
    return true  // Allow for testing
  }
})
```

3. **Use a relay/bootstrap node**:
```javascript
const dht = new DHT({
  bootstrap: [
    { host: 'your-server.com', port: 49737 }
  ]
})
```

### Isolated Network Setup

For private networks without internet:

```javascript
// First, start a bootstrap node on a machine with open ports
const bootstrap = new DHT({
  bootstrap: [],  // No external bootstrap
  port: 49737
})

await bootstrap.ready()
console.log('Bootstrap node:', bootstrap.host, bootstrap.port)

// Other nodes connect to this bootstrap
const node = new DHT({
  bootstrap: [
    { host: 'bootstrap-ip', port: 49737 }
  ]
})
```

---

## Replication Issues

### Data Not Syncing

**Symptoms**:
- `core.length` is 0 on remote peer
- `core.update()` returns `false`
- No download/upload events

**Common Cause: Missing findingPeers()**

```javascript
// WRONG - update returns immediately
swarm.join(core.discoveryKey)
const updated = await core.update()  // false!

// CORRECT - wait for peer discovery
const done = core.findingPeers()
swarm.join(core.discoveryKey)
swarm.on('connection', socket => core.replicate(socket))
await swarm.flush()
done()

const updated = await core.update()  // Now waits for peers
```

**Diagnosis**:
```javascript
// Monitor replication events
core.on('peer-add', (peer) => {
  console.log('Peer added:', peer.remotePublicKey.toString('hex').slice(0, 8))
})

core.on('peer-remove', (peer) => {
  console.log('Peer removed')
})

core.on('download', (index, data, peer) => {
  console.log(`Downloaded block ${index} from peer`)
})

core.on('upload', (index, data, peer) => {
  console.log(`Uploaded block ${index} to peer`)
})
```

### Sparse Mode Issues

**Symptoms**:
- Only some blocks available
- Files partially downloaded
- `core.get(index)` hangs

**Understanding sparse mode**:
```javascript
// Default: sparse mode - only downloads requested blocks
const core = new Hypercore('./data', remoteKey)

// This downloads ONLY block 5
await core.get(5)

// To download everything:
const range = core.download({ start: 0, end: -1 })
await range.done()

// For sequential data (video, large files):
const range = core.download({ start: 0, end: -1, linear: true })
```

**For Hyperdrive**:
```javascript
// Download specific file
await drive.get('/path/to/file')

// Download entire drive
const mirror = drive.mirror(localDrive)
await mirror.done()
```

### Capability Mismatch

**Symptoms**:
- Peers connect but no data transfers
- Works for some cores but not others

**Cause**: Corestore doesn't automatically exchange keys

```javascript
// WRONG - remote doesn't know about this core
const core = store.get({ name: 'secret-data' })
// Remote peer can't replicate what they don't know exists

// CORRECT - share the key first
const core = store.get({ name: 'secret-data' })
console.log('Share this key:', core.key.toString('hex'))

// Remote uses the key directly
const remoteCore = store.get(Buffer.from(sharedKey, 'hex'))
```

---

## Discovery Issues

### Peers Not Found

**Symptoms**:
- `swarm.on('connection')` never fires
- `swarm.flush()` completes but no peers

**Diagnosis**:
```javascript
const swarm = new Hyperswarm()
const topic = crypto.discoveryKey(Buffer.from('test'))

console.log('Topic:', topic.toString('hex'))

const discovery = swarm.join(topic, { client: true, server: true })

// Wait for DHT announcement (server mode)
await discovery.flushed()
console.log('Announced to DHT')

// Wait for connection attempts (client mode)
await swarm.flush()
console.log('Discovery complete')

// Check peer count
console.log('Connections:', swarm.connections.size)
```

**Common issues**:

1. **Topic mismatch**:
```javascript
// Topics must be exactly 32 bytes
const topic = crypto.discoveryKey(Buffer.from('my-room'))

// WRONG - different encoding = different topic
const wrongTopic = crypto.discoveryKey('my-room')  // String vs Buffer
```

2. **Not waiting for flush**:
```javascript
// Servers must wait for flushed() before others can find them
const discovery = swarm.join(topic, { server: true })
await discovery.flushed()  // DHT announcement complete
```

3. **Client-only mode**:
```javascript
// If ALL peers are client-only, none will find each other
swarm.join(topic, { client: true, server: false })  // Can only find servers

// At least one peer needs server mode
swarm.join(topic, { client: true, server: true })
```

### Topic Verification

```javascript
// Ensure topics match across peers
function logTopic(name) {
  const topic = crypto.discoveryKey(Buffer.from(name))
  console.log(`Topic for "${name}":`, topic.toString('hex'))
  return topic
}

// Both peers must use exact same topic
const topic = logTopic('my-chat-room')
```

---

## Authentication Issues

### Connection Rejected

**Symptoms**:
- Connections close immediately
- Firewall callback returns false
- "Unauthorized" errors

**Diagnosis**:
```javascript
const server = dht.createServer({
  firewall(remotePublicKey, payload) {
    const keyHex = remotePublicKey.toString('hex')
    console.log('Firewall check:', keyHex.slice(0, 8))

    const allowed = whitelist.includes(keyHex)
    console.log('Allowed:', allowed)

    return allowed
  }
})
```

**Implementing allowlists**:
```javascript
const allowedKeys = new Set([
  'abc123...',  // Peer 1
  'def456...',  // Peer 2
])

const server = dht.createServer({
  firewall(remotePublicKey) {
    return allowedKeys.has(remotePublicKey.toString('hex'))
  }
})
```

### Key Management Issues

**Symptoms**:
- Data verification fails
- "Invalid signature" errors
- Core public key changes unexpectedly

**Hypercore manifests**:
```javascript
// Hypercore 10 uses manifests for signer configuration
const core = new Hypercore('./data', {
  manifest: {
    signers: [{ publicKey: myPublicKey }]
  }
})

// Changing manifest = new public key!
// The core's key is derived from the manifest
```

**Corestore key derivation**:
```javascript
// Keys are deterministic from primaryKey + name
const store = new Corestore('./storage', {
  primaryKey: myMasterKey
})

const core = store.get({ name: 'my-data' })
// Same primaryKey + name = same key every time
```

---

## Diagnostic Tools

### pear-inspect

Remote debugging over Hyperswarm:

```bash
# Enable inspector in your app
pear run --inspect .

# Connect from another machine
pear inspect <app-key>
```

### bare-inspect

Object inspection for debugging:

```javascript
import inspect from 'bare-inspect'

console.log(inspect(core, { depth: 2 }))
console.log(inspect(swarm.connections))
```

### Event Logging

Comprehensive event monitoring:

```javascript
function debugCore(core, name) {
  core.on('ready', () => console.log(`[${name}] Ready`))
  core.on('append', () => console.log(`[${name}] Append, length: ${core.length}`))
  core.on('truncate', (len) => console.log(`[${name}] Truncate to: ${len}`))
  core.on('peer-add', (peer) => console.log(`[${name}] Peer add`))
  core.on('peer-remove', (peer) => console.log(`[${name}] Peer remove`))
  core.on('download', (index) => console.log(`[${name}] Download: ${index}`))
  core.on('upload', (index) => console.log(`[${name}] Upload: ${index}`))
}

function debugSwarm(swarm) {
  swarm.on('connection', (socket, info) => {
    console.log('[Swarm] Connection:', info.publicKey.toString('hex').slice(0, 8))
  })
  swarm.on('update', () => console.log('[Swarm] Update'))
  swarm.on('ban', (peer, err) => console.log('[Swarm] Ban:', err.message))
}
```

### CLI Tools

```bash
# Check Pear app status
pear info .

# View app logs
pear run --dev . 2>&1 | tee app.log

# Check DHT connectivity
# (Run a simple test script)
node -e "
const DHT = require('hyperdht')
const node = new DHT()
node.ready().then(() => {
  console.log('DHT ready')
  console.log('Nodes:', node.nodes.length)
  node.destroy()
})
"
```

---

## Debugging Checklist

### Before Reporting Issues

1. **Verify basic connectivity**:
   - [ ] Can peers ping each other?
   - [ ] Are firewalls allowing UDP?
   - [ ] Is at least one peer in server mode?

2. **Check replication setup**:
   - [ ] Using `findingPeers()` pattern?
   - [ ] Calling `swarm.flush()` before `core.update()`?
   - [ ] Using discovery key (not public key) for `swarm.join()`?

3. **Verify data flow**:
   - [ ] Are `peer-add` events firing?
   - [ ] Are `download`/`upload` events occurring?
   - [ ] Is sparse mode causing partial downloads?

4. **Check authentication**:
   - [ ] Firewall callback returning `true`?
   - [ ] Keys matching between peers?
   - [ ] Manifest configuration correct?

### Minimal Reproduction

Create a minimal test case:

```javascript
// test-connection.js
import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'

const swarm = new Hyperswarm()
const topic = crypto.discoveryKey(Buffer.from('test-' + Date.now()))

console.log('Topic:', topic.toString('hex'))
console.log('Run this same script on another machine with:')
console.log(`TOPIC=${topic.toString('hex')} node test-connection.js`)

const joinTopic = process.env.TOPIC
  ? Buffer.from(process.env.TOPIC, 'hex')
  : topic

swarm.join(joinTopic, { client: true, server: true })

swarm.on('connection', (socket, info) => {
  console.log('Connected to:', info.publicKey.toString('hex').slice(0, 8))
  socket.write('Hello!')
  socket.on('data', data => console.log('Received:', data.toString()))
})

setTimeout(() => {
  console.log('Connections:', swarm.connections.size)
}, 10000)
```

---

## Getting Help

1. **Check NotebookLM**: "Ask my Pear notebook about [specific error]"
2. **GitHub Issues**: https://github.com/holepunchto
3. **Discord**: Holepunch community Discord
4. **Documentation**: https://docs.pears.com, https://docs.holepunch.to
