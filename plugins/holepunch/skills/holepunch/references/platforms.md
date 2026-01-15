# Platform-Specific Development Guide

Detailed guidance for building Holepunch applications on desktop, terminal, and mobile platforms.

## Platform Overview

| Platform | Runtime | UI Framework | Key Module |
|----------|---------|--------------|------------|
| Desktop | Pear + Bare | Electron | `pear-electron` |
| Terminal | Pear + Bare | CLI | `pear-terminal` |
| Mobile | Bare Kit | React Native | `react-native-bare-kit` |

---

## Desktop Applications (Pear + Electron)

### Project Setup

```bash
mkdir my-desktop-app && cd my-desktop-app
npm init -y
npm install pear-electron hyperswarm hypercore
```

### package.json Configuration

```json
{
  "name": "my-desktop-app",
  "version": "1.0.0",
  "main": "app.js",
  "pear": {
    "name": "My Desktop App",
    "type": "desktop",
    "gui": {
      "width": 800,
      "height": 600,
      "backgroundColor": "#1a1a2e"
    }
  },
  "dependencies": {
    "pear-electron": "latest",
    "hyperswarm": "latest"
  }
}
```

### Application Entry (app.js)

```javascript
/* global Pear */
import Hyperswarm from 'hyperswarm'

// Pear global is available in desktop apps
const swarm = new Hyperswarm()

// Get app info
console.log('App key:', Pear.config.key?.toString('hex'))

// Handle app lifecycle
Pear.teardown(async () => {
  await swarm.destroy()
})

// Initialize your app
async function main() {
  // Your P2P logic here
}

main().catch(console.error)
```

### HTML Frontend (index.html)

```html
<!DOCTYPE html>
<html>
<head>
  <title>My P2P App</title>
  <script type="module" src="./renderer.js"></script>
</head>
<body>
  <div id="app">
    <h1>P2P Desktop App</h1>
    <div id="peers"></div>
  </div>
</body>
</html>
```

### Renderer Process (renderer.js)

```javascript
// Communication with main process via Pear bridge
const { ipc } = await import('pear')

// Send message to main process
ipc.send('connect', { topic: 'my-topic' })

// Receive messages
ipc.on('peer-connected', (data) => {
  document.getElementById('peers').innerHTML +=
    `<p>Connected: ${data.key}</p>`
})
```

### Running Desktop Apps

```bash
# Development mode (hot reload)
pear run --dev .

# Production run
pear run .
```

### Desktop-Specific APIs

```javascript
// Window control
Pear.Window.minimize()
Pear.Window.maximize()
Pear.Window.close()

// App updates
Pear.updates(async (version) => {
  console.log('Update available:', version)
  await Pear.reload()  // Apply update
})

// Media access
const stream = await Pear.media.getUserMedia({ video: true })
```

---

## Terminal Applications

### Project Setup

```bash
mkdir my-cli && cd my-cli
npm init -y
npm install pear-terminal hyperswarm
```

### package.json Configuration

```json
{
  "name": "my-cli",
  "version": "1.0.0",
  "main": "index.js",
  "bin": {
    "my-cli": "./index.js"
  },
  "pear": {
    "name": "my-cli",
    "type": "terminal"
  },
  "dependencies": {
    "pear-terminal": "latest",
    "hyperswarm": "latest"
  }
}
```

### Terminal Application (index.js)

```javascript
#!/usr/bin/env node
/* global Pear */
import Hyperswarm from 'hyperswarm'

const swarm = new Hyperswarm()

// Parse command line arguments
const args = Pear.config.args || process.argv.slice(2)

// Handle graceful shutdown
Pear.teardown(async () => {
  console.log('Shutting down...')
  await swarm.destroy()
})

// Process stdin
process.stdin.setEncoding('utf8')
process.stdin.on('data', (data) => {
  // Handle user input
  console.log('Input:', data.trim())
})

async function main() {
  console.log('Starting P2P CLI...')
  // Your P2P logic
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

### Running Terminal Apps

```bash
# Development
pear run --dev .

# With arguments
pear run --dev . -- --port 8080 --verbose

# Production
pear run .
```

### Terminal UI Libraries

For rich terminal UIs, consider:

```bash
npm install ink        # React for CLI
npm install blessed    # Curses-like widgets
npm install chalk      # Colored output
```

**Example with Ink**:
```javascript
import React from 'react'
import { render, Text, Box } from 'ink'

const App = ({ peers }) => (
  <Box flexDirection="column">
    <Text bold>Connected Peers:</Text>
    {peers.map(peer => (
      <Text key={peer}>• {peer}</Text>
    ))}
  </Box>
)

render(<App peers={connectedPeers} />)
```

---

## Mobile Applications (Bare Kit + React Native)

### Prerequisites

- React Native development environment
- iOS: Xcode
- Android: Android Studio

### Project Setup

```bash
npx react-native init MyP2PApp
cd MyP2PApp
npm install react-native-bare-kit
```

### iOS Setup

```bash
cd ios && pod install && cd ..
```

### Android Setup

No additional setup required.

### Creating a Worklet

Worklets are isolated Bare threads for P2P logic:

**worklet.js** (runs in Bare):
```javascript
/* global Bare */
import Hyperswarm from 'hyperswarm'
import IPC from 'bare-ipc'

const ipc = new IPC()
const swarm = new Hyperswarm()

// Receive messages from React Native
ipc.on('join-topic', async (topic) => {
  const topicBuffer = Buffer.from(topic, 'hex')
  swarm.join(topicBuffer)
  await swarm.flush()
  ipc.send('joined', { topic })
})

// Send peer updates to React Native
swarm.on('connection', (socket, info) => {
  ipc.send('peer-connected', {
    key: info.publicKey.toString('hex')
  })
})

// Handle app lifecycle
Bare.on('suspend', () => {
  swarm.suspend()
})

Bare.on('resume', () => {
  swarm.resume()
})
```

### React Native Integration

**App.js**:
```javascript
import React, { useEffect, useState } from 'react'
import { View, Text, Button } from 'react-native'
import { Worklet } from 'react-native-bare-kit'

// Bundle your worklet code
import workletSource from './worklet.bundle.js'

export default function App() {
  const [worklet, setWorklet] = useState(null)
  const [peers, setPeers] = useState([])

  useEffect(() => {
    // Create worklet
    const w = new Worklet(workletSource)

    // Handle messages from worklet
    w.on('peer-connected', (data) => {
      setPeers(prev => [...prev, data.key])
    })

    setWorklet(w)

    return () => w.terminate()
  }, [])

  const joinTopic = () => {
    worklet?.send('join-topic', 'my-topic-hash')
  }

  return (
    <View>
      <Button title="Join Network" onPress={joinTopic} />
      <Text>Connected Peers: {peers.length}</Text>
      {peers.map(peer => (
        <Text key={peer}>{peer.slice(0, 8)}...</Text>
      ))}
    </View>
  )
}
```

### Bundling Worklet Code

Create a build script for the worklet:

```bash
# Using esbuild
npx esbuild worklet.js --bundle --platform=node \
  --outfile=worklet.bundle.js
```

### Mobile-Specific Considerations

**App Lifecycle**:
```javascript
import { AppState } from 'react-native'

AppState.addEventListener('change', (state) => {
  if (state === 'background') {
    worklet.send('suspend')
  } else if (state === 'active') {
    worklet.send('resume')
  }
})
```

**Background Execution** (limited):
- iOS: Background tasks limited to ~30 seconds
- Android: Use foreground services for longer operations
- Consider using push notifications for peer sync triggers

**Battery Optimization**:
```javascript
// Reduce DHT activity when on battery
const batteryOptimized = Battery.level < 0.2

if (batteryOptimized) {
  swarm.suspend()
}
```

---

## Bare Runtime

### What is Bare?

Bare is the JavaScript runtime powering Pear. It's designed for:
- Embedded/cross-device deployment
- Minimal footprint (~40MB, or ~1MB with JerryScript)
- Mobile-first architecture

### Bare vs Node.js

| Feature | Node.js | Bare |
|---------|---------|------|
| Standard library | Large, built-in | Modular, install as needed |
| Mobile support | Limited | First-class |
| Binary size | ~100MB | ~40MB (or ~1MB) |
| Engine | V8 only | V8, JSC, QuickJS, JerryScript |
| Event loop | libuv | libuv |

### Bare Modules

Standard functionality via small modules:

```bash
npm install bare-fs      # Filesystem
npm install bare-http1   # HTTP client/server
npm install bare-path    # Path utilities
npm install bare-os      # OS info
npm install bare-process # Process info
```

**Usage**:
```javascript
import fs from 'bare-fs'
import path from 'bare-path'

const content = await fs.promises.readFile(
  path.join(Bare.cwd, 'config.json'),
  'utf-8'
)
```

### Bare Lifecycle

```javascript
// Startup
Bare.on('ready', () => {
  console.log('Runtime ready')
})

// Suspension (mobile background)
Bare.on('suspend', () => {
  // Save state, pause networking
})

// Resume (mobile foreground)
Bare.on('resume', () => {
  // Restore state, resume networking
})

// Shutdown
Bare.on('exit', () => {
  // Final cleanup (no async allowed!)
})
```

### Engine Selection

```javascript
// Check current engine
console.log(Bare.engine)  // 'v8', 'jsc', 'quickjs', 'jerryscript'

// Engine-specific optimizations
if (Bare.engine === 'jerryscript') {
  // Reduce memory usage for constrained devices
}
```

---

## Deployment

### Staging and Seeding

```bash
# Stage app (sync to Hyperdrive)
pear stage .

# Seed app (share with network)
pear seed .

# Release (production version)
pear release .
```

### Sharing Applications

```bash
# Get shareable link
pear info .
# Output: pear://abc123...

# Others run via:
pear run pear://abc123...
```

### Cross-Platform Distribution

| Platform | Distribution Method |
|----------|---------------------|
| Desktop | `pear://` link, or bundle with Electron |
| Terminal | `pear://` link, npm package |
| Mobile | App Store (bundled), or Pear link |

---

## Platform Comparison

| Feature | Desktop | Terminal | Mobile |
|---------|---------|----------|--------|
| UI | HTML/CSS/JS | stdout/stdin | React Native |
| IPC | Pear bridge | stdin/stdout | bare-ipc |
| Lifecycle | Window events | Process signals | AppState |
| Background | Full support | Full support | Limited |
| Networking | Full | Full | Battery-aware |
