/**
 * Hypercore Replication Example
 *
 * Demonstrates creating, writing, and replicating a Hypercore
 * between two peers.
 *
 * Usage:
 *   # Terminal 1 - Create and seed a core (writer)
 *   node hypercore-replication.js
 *
 *   # Terminal 2 - Replicate from the first peer (reader)
 *   KEY=<hex-from-terminal-1> node hypercore-replication.js
 */

import Hypercore from 'hypercore'
import Hyperswarm from 'hyperswarm'
import crypto from 'crypto'
import readline from 'readline'

// Determine if we're the writer or reader
const remoteKey = process.env.KEY
  ? Buffer.from(process.env.KEY, 'hex')
  : null

const isWriter = !remoteKey

// Create storage directory based on role
const storageDir = isWriter
  ? './data-writer-' + crypto.randomBytes(4).toString('hex')
  : './data-reader-' + crypto.randomBytes(4).toString('hex')

console.log('='.repeat(60))
console.log('Hypercore Replication Example')
console.log('='.repeat(60))
console.log()
console.log('Role:', isWriter ? 'WRITER (can append data)' : 'READER (replicating)')
console.log('Storage:', storageDir)
console.log()

// Create the Hypercore
const core = remoteKey
  ? new Hypercore(storageDir, remoteKey)  // Read-only
  : new Hypercore(storageDir)              // Writable

await core.ready()

console.log('Public Key:', core.key.toString('hex'))
console.log('Discovery Key:', core.discoveryKey.toString('hex').slice(0, 16) + '...')
console.log('Writable:', core.writable)
console.log('Length:', core.length)
console.log()

if (isWriter) {
  console.log('To replicate this core, run on another machine:')
  console.log(`  KEY=${core.key.toString('hex')} node hypercore-replication.js`)
  console.log()
}

// Setup Hyperswarm for replication
const swarm = new Hyperswarm()

// Critical: Signal that we're finding peers
const done = core.findingPeers()

// Join the swarm using discovery key (NOT public key)
swarm.join(core.discoveryKey, {
  client: true,
  server: true
})

// Handle connections
swarm.on('connection', (socket, peerInfo) => {
  const peerId = peerInfo.publicKey.toString('hex').slice(0, 8)
  console.log(`[+] Peer connected: ${peerId}`)

  // Replicate the core over this connection
  core.replicate(socket)
})

// Monitor core events
core.on('peer-add', (peer) => {
  console.log('[i] Replication peer added')
})

core.on('peer-remove', (peer) => {
  console.log('[i] Replication peer removed')
})

core.on('append', () => {
  console.log(`[i] Core appended, new length: ${core.length}`)
})

core.on('download', (index, data) => {
  console.log(`[↓] Downloaded block ${index} (${data.length} bytes)`)
})

core.on('upload', (index, data) => {
  console.log(`[↑] Uploaded block ${index} (${data.length} bytes)`)
})

// Wait for initial peer discovery
console.log('Searching for peers...')
await swarm.flush()
done()  // Signal peer finding complete
console.log(`Found ${swarm.connections.size} peer(s)`)

// For readers, try to get latest data
if (!isWriter) {
  console.log('Checking for updates...')
  const updated = await core.update()
  console.log('Updated:', updated, '- Length:', core.length)

  if (core.length > 0) {
    console.log()
    console.log('Reading all blocks:')
    for (let i = 0; i < core.length; i++) {
      const block = await core.get(i, { timeout: 5000 })
      console.log(`  [${i}]: ${block.toString()}`)
    }
  }
}

console.log()

// Interactive mode for writers
if (isWriter) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  console.log('Type a message and press Enter to append to the core.')
  console.log('Type "read" to show all blocks.')
  console.log('Type "quit" to exit.')
  console.log()

  rl.on('line', async (input) => {
    const message = input.trim()

    if (message.toLowerCase() === 'quit') {
      console.log('Shutting down...')
      rl.close()
      await swarm.destroy()
      await core.close()
      process.exit(0)
    }

    if (message.toLowerCase() === 'read') {
      console.log(`\nCore has ${core.length} blocks:`)
      for (let i = 0; i < core.length; i++) {
        const block = await core.get(i)
        console.log(`  [${i}]: ${block.toString()}`)
      }
      console.log()
      process.stdout.write('> ')
      return
    }

    if (message) {
      await core.append(Buffer.from(message))
      console.log(`Appended block ${core.length - 1}`)
    }

    process.stdout.write('> ')
  })

  process.stdout.write('> ')
} else {
  // Reader: watch for new data
  console.log('Watching for new data... (Ctrl+C to exit)')

  setInterval(async () => {
    const prevLength = core.length
    await core.update()

    if (core.length > prevLength) {
      console.log(`\n[i] New blocks available: ${prevLength} -> ${core.length}`)
      for (let i = prevLength; i < core.length; i++) {
        const block = await core.get(i, { timeout: 5000 })
        console.log(`  [${i}]: ${block.toString()}`)
      }
    }
  }, 2000)
}

// Handle cleanup
process.on('SIGINT', async () => {
  console.log('\nShutting down...')
  await swarm.destroy()
  await core.close()
  process.exit(0)
})
