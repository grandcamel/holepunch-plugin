/**
 * Hyperswarm Basic Example
 *
 * Demonstrates peer discovery and messaging using Hyperswarm.
 * Run this script on two different machines (or terminals) to see
 * P2P communication in action.
 *
 * Usage:
 *   # Terminal 1 - Start first peer
 *   node hyperswarm-basic.js
 *
 *   # Terminal 2 - Join with the topic from Terminal 1
 *   TOPIC=<hex-from-terminal-1> node hyperswarm-basic.js
 */

import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'
import readline from 'readline'

const swarm = new Hyperswarm()

// Generate or use provided topic
const topicHex = process.env.TOPIC
const topic = topicHex
  ? Buffer.from(topicHex, 'hex')
  : crypto.discoveryKey(Buffer.from('holepunch-example-' + Date.now()))

console.log('='.repeat(60))
console.log('Hyperswarm Basic Example')
console.log('='.repeat(60))
console.log()

if (!topicHex) {
  console.log('Topic created:', topic.toString('hex'))
  console.log()
  console.log('To connect from another machine, run:')
  console.log(`  TOPIC=${topic.toString('hex')} node hyperswarm-basic.js`)
  console.log()
} else {
  console.log('Joining topic:', topicHex.slice(0, 16) + '...')
}

// Track connected peers
const peers = new Map()

// Join the swarm as both client and server
const discovery = swarm.join(topic, {
  client: true,
  server: true
})

// Handle new connections
swarm.on('connection', (socket, peerInfo) => {
  const peerId = peerInfo.publicKey.toString('hex').slice(0, 8)
  console.log(`\n[+] Peer connected: ${peerId}`)

  peers.set(peerId, socket)

  // Handle incoming messages
  socket.on('data', (data) => {
    console.log(`\n[${peerId}]: ${data.toString()}`)
    process.stdout.write('> ')
  })

  // Handle disconnection
  socket.on('close', () => {
    console.log(`\n[-] Peer disconnected: ${peerId}`)
    peers.delete(peerId)
    process.stdout.write('> ')
  })

  socket.on('error', (err) => {
    console.error(`\n[!] Peer error (${peerId}):`, err.message)
    peers.delete(peerId)
  })

  // Send greeting
  socket.write(`Hello from ${swarm.keyPair.publicKey.toString('hex').slice(0, 8)}!`)
})

// Monitor swarm events
swarm.on('update', () => {
  console.log(`\n[i] Swarm update - ${swarm.connections.size} connection(s)`)
  process.stdout.write('> ')
})

// Wait for initial discovery
console.log('Searching for peers...')
await discovery.flushed()
console.log('DHT announcement complete')
await swarm.flush()
console.log(`Connected to ${swarm.connections.size} peer(s)`)
console.log()

// Setup interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

console.log('Type a message and press Enter to send to all peers.')
console.log('Type "quit" to exit.')
console.log()

rl.on('line', (input) => {
  const message = input.trim()

  if (message.toLowerCase() === 'quit') {
    console.log('Shutting down...')
    rl.close()
    swarm.destroy().then(() => process.exit(0))
    return
  }

  if (message && peers.size > 0) {
    // Broadcast to all peers
    for (const [peerId, socket] of peers) {
      try {
        socket.write(message)
      } catch (err) {
        console.error(`Failed to send to ${peerId}:`, err.message)
      }
    }
    console.log(`Sent to ${peers.size} peer(s)`)
  } else if (peers.size === 0) {
    console.log('No peers connected')
  }

  process.stdout.write('> ')
})

process.stdout.write('> ')

// Handle cleanup
process.on('SIGINT', async () => {
  console.log('\nShutting down...')
  rl.close()
  await swarm.destroy()
  process.exit(0)
})
