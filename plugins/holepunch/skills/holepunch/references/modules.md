# Holepunch Modules Deep Dive

Detailed documentation for each core module in the Holepunch ecosystem.

## Module Architecture

The modules are organized in three layers:

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

---

## Networking Layer

### HyperDHT

The DHT powering Hyperswarm. Provides Kademlia-based peer discovery and end-to-end encrypted Noise streams.

**When to use**: Direct peer-to-peer connections when you already have the peer's public key.

**Installation**:
```bash
npm install hyperdht
```

**Creating a Server**:
```javascript
import DHT from 'hyperdht'

const node = new DHT()
const server = node.createServer()

server.on('connection', (socket) => {
  console.log('Remote key:', socket.remotePublicKey.toString('hex'))
  socket.write('Hello from server!')
  socket.on('data', data => console.log('Received:', data.toString()))
})

await server.listen()
console.log('Server key:', server.publicKey.toString('hex'))
```

**Connecting as Client**:
```javascript
import DHT from 'hyperdht'

const node = new DHT()
const serverPublicKey = Buffer.from('...', 'hex')

const socket = node.connect(serverPublicKey)
socket.on('open', () => {
  socket.write('Hello from client!')
})
socket.on('data', data => console.log('Received:', data.toString()))
```

**Key Options**:
- `bootstrap`: Array of bootstrap nodes for isolated networks
- `keyPair`: Custom keypair for the node
- `firewall(remotePublicKey, payload)`: Filter incoming connections

**Firewalling**:
```javascript
const server = node.createServer({
  firewall(remotePublicKey, payload) {
    // Return true to allow, false to reject
    return allowedKeys.includes(remotePublicKey.toString('hex'))
  }
})
```

---

### Hyperswarm

High-level peer discovery by topic. Built on HyperDHT.

**When to use**: Finding peers interested in a common topic without knowing their keys beforehand.

**Installation**:
```bash
npm install hyperswarm
```

**Basic Usage**:
```javascript
import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'

const swarm = new Hyperswarm()

// Create a topic from any string
const topic = crypto.discoveryKey(Buffer.from('my-chat-room'))

// Join the swarm
const discovery = swarm.join(topic, {
  client: true,   // Look for peers (formerly "lookup")
  server: true    // Announce to DHT (formerly "announce")
})

// Handle new connections
swarm.on('connection', (socket, peerInfo) => {
  console.log('New peer:', peerInfo.publicKey.toString('hex').slice(0, 8))

  // Pipe to Hypercore, Hyperdrive, or custom protocol
  socket.write('Hello!')
  socket.on('data', data => console.log(data.toString()))
})

// Wait for initial connections
await swarm.flush()
```

**Important Methods**:

| Method | Purpose |
|--------|---------|
| `join(topic, opts)` | Join a topic for discovery |
| `leave(topic)` | Stop discovery (doesn't close connections) |
| `flush()` | Wait for pending operations |
| `suspend()` | Pause networking (mobile) |
| `resume()` | Resume networking (mobile) |
| `destroy()` | Close all connections and cleanup |

**Events**:

| Event | Description |
|-------|-------------|
| `connection` | New peer connected |
| `update` | Peer state changed |
| `ban` | Peer was banned (connectivity failure) |

**Server vs Client Mode**:
- **Server** (`server: true`): Announces to DHT, accepts incoming connections
- **Client** (`client: true`): Searches DHT, initiates outgoing connections
- Use both for full mesh connectivity

**Flushing**:
```javascript
// For servers - wait for DHT announcement
await discovery.flushed()

// For the swarm - wait for all pending operations
await swarm.flush()
```

---

## Data Layer

### Hypercore

Secure, distributed append-only log. The foundation of all data structures.

**When to use**: Streaming data, event logs, any sequential data that needs P2P distribution.

**Installation**:
```bash
npm install hypercore
```

**Creating a Core**:
```javascript
import Hypercore from 'hypercore'

// Writable core (you have the key pair)
const core = new Hypercore('./storage')
await core.ready()

console.log('Public key:', core.key.toString('hex'))
console.log('Discovery key:', core.discoveryKey.toString('hex'))
```

**Read-Only Core** (from another peer's key):
```javascript
const readOnlyCore = new Hypercore('./storage', publicKey)
await readOnlyCore.ready()
```

**Writing Data**:
```javascript
// Append single block
await core.append(Buffer.from('Hello'))

// Append multiple blocks
await core.append([
  Buffer.from('Block 1'),
  Buffer.from('Block 2')
])

console.log('Length:', core.length)
```

**Reading Data**:
```javascript
// Get specific block
const block = await core.get(0)

// Get with timeout
const block = await core.get(0, { timeout: 5000 })

// Create read stream
const stream = core.createReadStream()
for await (const block of stream) {
  console.log(block.toString())
}
```

**Replication**:
```javascript
import Hyperswarm from 'hyperswarm'

const swarm = new Hyperswarm()
swarm.join(core.discoveryKey)

swarm.on('connection', socket => {
  core.replicate(socket)
})
```

**Sparse Mode** (default):
```javascript
// By default, only downloads requested blocks
const block = await core.get(100)  // Downloads block 100 only

// To download all blocks
const range = core.download({ start: 0, end: -1 })
await range.done()

// Linear download (for sequential data like video)
const range = core.download({ start: 0, end: -1, linear: true })
```

**Key Properties**:

| Property | Description |
|----------|-------------|
| `key` | Public key (32 bytes) |
| `discoveryKey` | Hash of key for discovery |
| `length` | Number of blocks |
| `byteLength` | Total bytes |
| `writable` | Can append data |
| `readable` | Can read data |

---

### Hyperbee

B-tree database running on Hypercore. Provides sorted key-value storage.

**When to use**: Database-like storage with sorted keys, range queries, prefix searches.

**Installation**:
```bash
npm install hyperbee
```

**Basic Usage**:
```javascript
import Hypercore from 'hypercore'
import Hyperbee from 'hyperbee'

const core = new Hypercore('./db')
const db = new Hyperbee(core, {
  keyEncoding: 'utf-8',
  valueEncoding: 'json'
})
await db.ready()
```

**CRUD Operations**:
```javascript
// Put
await db.put('users/alice', { name: 'Alice', age: 30 })

// Get
const entry = await db.get('users/alice')
console.log(entry.value)  // { name: 'Alice', age: 30 }

// Delete
await db.del('users/alice')
```

**Range Queries**:
```javascript
// Get all users
for await (const entry of db.createReadStream({
  gte: 'users/',
  lt: 'users0'  // Character after '/'
})) {
  console.log(entry.key, entry.value)
}

// Reverse order
for await (const entry of db.createReadStream({
  gte: 'users/',
  lt: 'users0',
  reverse: true
})) {
  console.log(entry.key)
}
```

**Batching** (much faster):
```javascript
const batch = db.batch()

await batch.put('key1', 'value1')
await batch.put('key2', 'value2')
await batch.put('key3', 'value3')

await batch.flush()  // Atomic commit
```

**Sub-databases**:
```javascript
const users = db.sub('users')
const posts = db.sub('posts')

await users.put('alice', { name: 'Alice' })
await posts.put('post-1', { title: 'Hello' })
```

---

### Hyperdrive

P2P filesystem. Wrapper around Hyperbee (metadata) and Hypercore (blobs).

**When to use**: File sharing, document sync, any file-based data.

**Installation**:
```bash
npm install hyperdrive corestore
```

**Basic Usage**:
```javascript
import Corestore from 'corestore'
import Hyperdrive from 'hyperdrive'

const store = new Corestore('./storage')
const drive = new Hyperdrive(store)
await drive.ready()

console.log('Key:', drive.key.toString('hex'))
```

**File Operations**:
```javascript
// Write file
await drive.put('/docs/readme.txt', Buffer.from('Hello World'))

// Read file
const content = await drive.get('/docs/readme.txt')
console.log(content.toString())

// Delete file
await drive.del('/docs/readme.txt')

// Check if exists
const exists = await drive.exists('/docs/readme.txt')
```

**Directory Operations**:
```javascript
// List directory
for await (const entry of drive.list('/docs')) {
  console.log(entry.key, entry.value.blob ? 'file' : 'dir')
}

// Recursive list
for await (const entry of drive.list('/', { recursive: true })) {
  console.log(entry.key)
}
```

**Replication**:
```javascript
import Hyperswarm from 'hyperswarm'

const swarm = new Hyperswarm()
swarm.join(drive.discoveryKey)

swarm.on('connection', socket => {
  store.replicate(socket)  // Replicate the store, not the drive
})
```

**Mirroring** (sync entire drives):
```javascript
import Localdrive from 'localdrive'
import { MirrorDrive } from 'mirror-drive'

const local = new Localdrive('./local-folder')
const mirror = new MirrorDrive(drive, local)

// Sync from Hyperdrive to local
await mirror.done()
```

---

## Aggregation Layer

### Corestore

Factory for managing multiple Hypercores with a single master key.

**When to use**: Applications with multiple data streams, managing related Hypercores.

**Installation**:
```bash
npm install corestore
```

**Basic Usage**:
```javascript
import Corestore from 'corestore'

const store = new Corestore('./storage')

// Get cores by name (deterministic keys)
const users = store.get({ name: 'users' })
const posts = store.get({ name: 'posts' })

await users.ready()
await posts.ready()
```

**Key Derivation**:
```javascript
// All keys derived from master key + name
const store = new Corestore('./storage', {
  primaryKey: Buffer.alloc(32).fill('my-secret')
})

// Same name = same key every time
const core1 = store.get({ name: 'data' })
const core2 = store.get({ name: 'data' })
// core1.key equals core2.key
```

**Replication**:
```javascript
import Hyperswarm from 'hyperswarm'

const swarm = new Hyperswarm()

// Join for each core's discovery key
swarm.join(users.discoveryKey)
swarm.join(posts.discoveryKey)

// Single replicate call handles all cores
swarm.on('connection', socket => {
  store.replicate(socket)
})
```

**Namespacing**:
```javascript
const appStore = store.namespace('my-app')
const userCore = appStore.get({ name: 'users' })
// Isolated from other namespaces
```

---

### Autobase

Multiwriter data structures. Linearizes inputs from multiple peers.

**When to use**: Collaborative applications where multiple users write to the same data.

**Installation**:
```bash
npm install autobase
```

**Basic Setup**:
```javascript
import Corestore from 'corestore'
import Autobase from 'autobase'
import Hyperbee from 'hyperbee'

const store = new Corestore('./storage')

const base = new Autobase(store, null, {
  // Create the view (output data structure)
  open(store) {
    return new Hyperbee(store.get('view'), {
      keyEncoding: 'utf-8',
      valueEncoding: 'json'
    })
  },
  // Process input blocks
  async apply(batch, view, base) {
    for (const node of batch) {
      const op = JSON.parse(node.value.toString())
      if (op.type === 'put') {
        await view.put(op.key, op.value)
      }
    }
  }
})

await base.ready()
```

**Writing** (to local input):
```javascript
await base.append(JSON.stringify({
  type: 'put',
  key: 'users/alice',
  value: { name: 'Alice' }
}))
```

**Reading** (from linearized view):
```javascript
const entry = await base.view.get('users/alice')
console.log(entry.value)
```

**Adding Writers**:
```javascript
// Get another peer's writer key
const writerKey = Buffer.from('...', 'hex')

// Add as input
await base.addInput(writerKey)

// Now their writes will be included in the view
```

**Replication**:
```javascript
const swarm = new Hyperswarm()
swarm.join(base.discoveryKey)

swarm.on('connection', socket => {
  store.replicate(socket)
})
```

---

## Module Comparison Table

| Module | Data Model | Writers | Use Case |
|--------|------------|---------|----------|
| Hypercore | Append-only log | Single | Streams, events |
| Hyperbee | Sorted key-value | Single | Databases |
| Hyperdrive | Filesystem | Single | File sharing |
| Autobase | Any (via view) | Multiple | Collaboration |
| Corestore | Core factory | N/A | Managing cores |
| Hyperswarm | Connections | N/A | Peer discovery |
| HyperDHT | Connections | N/A | Direct P2P |

---

## GitHub Repositories

- **Hypercore**: https://github.com/holepunchto/hypercore
- **Hyperbee**: https://github.com/holepunchto/hyperbee
- **Hyperdrive**: https://github.com/holepunchto/hyperdrive
- **Hyperswarm**: https://github.com/holepunchto/hyperswarm
- **HyperDHT**: https://github.com/holepunchto/hyperdht
- **Corestore**: https://github.com/holepunchto/corestore
- **Autobase**: https://github.com/holepunchto/autobase
