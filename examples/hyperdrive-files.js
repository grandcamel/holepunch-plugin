/**
 * Hyperdrive File Sharing Example
 *
 * Demonstrates creating, writing files to, and replicating a Hyperdrive
 * between two peers.
 *
 * Usage:
 *   # Terminal 1 - Create and seed a drive (writer)
 *   node hyperdrive-files.js
 *
 *   # Terminal 2 - Replicate from the first peer (reader)
 *   KEY=<hex-from-terminal-1> node hyperdrive-files.js
 */

import Corestore from 'corestore'
import Hyperdrive from 'hyperdrive'
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
  ? './drive-writer-' + crypto.randomBytes(4).toString('hex')
  : './drive-reader-' + crypto.randomBytes(4).toString('hex')

console.log('='.repeat(60))
console.log('Hyperdrive File Sharing Example')
console.log('='.repeat(60))
console.log()
console.log('Role:', isWriter ? 'WRITER (can add files)' : 'READER (replicating)')
console.log('Storage:', storageDir)
console.log()

// Create Corestore (manages underlying Hypercores)
const store = new Corestore(storageDir)

// Create Hyperdrive
const drive = remoteKey
  ? new Hyperdrive(store, remoteKey)  // Read-only
  : new Hyperdrive(store)              // Writable

await drive.ready()

console.log('Drive Key:', drive.key.toString('hex'))
console.log('Discovery Key:', drive.discoveryKey.toString('hex').slice(0, 16) + '...')
console.log('Writable:', drive.writable)
console.log()

if (isWriter) {
  console.log('To replicate this drive, run on another machine:')
  console.log(`  KEY=${drive.key.toString('hex')} node hyperdrive-files.js`)
  console.log()

  // Add some initial files
  console.log('Adding initial files...')
  await drive.put('/readme.txt', Buffer.from('Welcome to the P2P filesystem!'))
  await drive.put('/docs/getting-started.md', Buffer.from('# Getting Started\n\nThis is a P2P drive.'))
  console.log('Initial files added.')
  console.log()
}

// Setup Hyperswarm for replication
const swarm = new Hyperswarm()

// Signal that we're finding peers
const done = drive.findingPeers()

// Join the swarm using discovery key
swarm.join(drive.discoveryKey, {
  client: true,
  server: true
})

// Handle connections - replicate the STORE, not the drive
swarm.on('connection', (socket, peerInfo) => {
  const peerId = peerInfo.publicKey.toString('hex').slice(0, 8)
  console.log(`[+] Peer connected: ${peerId}`)

  // Replicate the entire store (handles both metadata and blobs)
  store.replicate(socket)
})

// Wait for initial peer discovery
console.log('Searching for peers...')
await swarm.flush()
done()
console.log(`Found ${swarm.connections.size} peer(s)`)

// List files helper
async function listFiles(path = '/') {
  console.log(`\nFiles in "${path}":`)
  console.log('-'.repeat(40))

  try {
    for await (const entry of drive.list(path, { recursive: true })) {
      const isFile = entry.value.blob !== null
      const size = isFile ? entry.value.blob.byteLength : '-'
      const type = isFile ? 'file' : 'dir'
      console.log(`  [${type}] ${entry.key} (${size} bytes)`)
    }
  } catch (err) {
    console.log('  (empty or error:', err.message + ')')
  }

  console.log('-'.repeat(40))
}

// Show initial files
await listFiles()

// Interactive mode
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

console.log()
console.log('Commands:')
console.log('  list [path]           - List files')
console.log('  read <path>           - Read file contents')
if (isWriter) {
  console.log('  write <path> <text>   - Write a file')
  console.log('  delete <path>         - Delete a file')
}
console.log('  quit                  - Exit')
console.log()

rl.on('line', async (input) => {
  const parts = input.trim().split(' ')
  const command = parts[0]?.toLowerCase()

  try {
    switch (command) {
      case 'list':
      case 'ls': {
        const path = parts[1] || '/'
        await listFiles(path)
        break
      }

      case 'read':
      case 'cat': {
        const path = parts[1]
        if (!path) {
          console.log('Usage: read <path>')
          break
        }
        const content = await drive.get(path)
        if (content) {
          console.log(`\nContent of "${path}":`)
          console.log('-'.repeat(40))
          console.log(content.toString())
          console.log('-'.repeat(40))
        } else {
          console.log('File not found:', path)
        }
        break
      }

      case 'write': {
        if (!isWriter) {
          console.log('Cannot write - this is a read-only replica')
          break
        }
        const path = parts[1]
        const text = parts.slice(2).join(' ')
        if (!path || !text) {
          console.log('Usage: write <path> <text>')
          break
        }
        await drive.put(path, Buffer.from(text))
        console.log(`Wrote ${text.length} bytes to "${path}"`)
        break
      }

      case 'delete':
      case 'rm': {
        if (!isWriter) {
          console.log('Cannot delete - this is a read-only replica')
          break
        }
        const path = parts[1]
        if (!path) {
          console.log('Usage: delete <path>')
          break
        }
        await drive.del(path)
        console.log(`Deleted "${path}"`)
        break
      }

      case 'quit':
      case 'exit': {
        console.log('Shutting down...')
        rl.close()
        await swarm.destroy()
        await drive.close()
        await store.close()
        process.exit(0)
      }

      default:
        if (command) {
          console.log('Unknown command:', command)
        }
    }
  } catch (err) {
    console.error('Error:', err.message)
  }

  process.stdout.write('> ')
})

process.stdout.write('> ')

// Handle cleanup
process.on('SIGINT', async () => {
  console.log('\nShutting down...')
  rl.close()
  await swarm.destroy()
  await drive.close()
  await store.close()
  process.exit(0)
})
