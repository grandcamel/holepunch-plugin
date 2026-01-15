---
name: scaffold
description: Scaffold a new Pear P2P application (desktop or terminal)
argument-hint: "[desktop|terminal] <app-name>"
allowed-tools:
  - Bash
  - Write
  - Read
  - Edit
---

# Scaffold Pear Application

Create a new Pear P2P application with proper project structure and configuration.

## Arguments

Parse the user's arguments to determine:
1. **App type**: `desktop` (default) or `terminal`
2. **App name**: The name for the new application (kebab-case)

If no arguments provided, ask the user for app type and name.

## Scaffold Process

### 1. Create Project Directory

```bash
mkdir <app-name> && cd <app-name>
npm init -y
```

### 2. Install Dependencies

**For desktop apps:**
```bash
npm install pear-electron hyperswarm hypercore corestore
```

**For terminal apps:**
```bash
npm install pear-terminal hyperswarm hypercore corestore
```

### 3. Configure package.json

Update package.json with Pear configuration:

**Desktop:**
```json
{
  "name": "<app-name>",
  "version": "1.0.0",
  "main": "app.js",
  "pear": {
    "name": "<app-name>",
    "type": "desktop",
    "gui": {
      "width": 800,
      "height": 600,
      "backgroundColor": "#1a1a2e"
    }
  }
}
```

**Terminal:**
```json
{
  "name": "<app-name>",
  "version": "1.0.0",
  "main": "index.js",
  "pear": {
    "name": "<app-name>",
    "type": "terminal"
  }
}
```

### 4. Create Entry File

**For desktop (app.js):**
```javascript
/* global Pear */
import Hyperswarm from 'hyperswarm'
import Corestore from 'corestore'
import crypto from 'hypercore-crypto'

const store = new Corestore('./storage')
const swarm = new Hyperswarm()

// Register cleanup
Pear.teardown(async () => {
  await swarm.destroy()
  await store.close()
})

async function main() {
  // Create a topic for peer discovery
  const topic = crypto.discoveryKey(Buffer.from('<app-name>'))

  swarm.join(topic, { client: true, server: true })

  swarm.on('connection', (socket, peerInfo) => {
    console.log('Peer connected:', peerInfo.publicKey.toString('hex').slice(0, 8))
    store.replicate(socket)
  })

  await swarm.flush()
  console.log('Connected to swarm')
}

main().catch(console.error)
```

**For terminal (index.js):**
```javascript
#!/usr/bin/env node
/* global Pear */
import Hyperswarm from 'hyperswarm'
import Corestore from 'corestore'
import crypto from 'hypercore-crypto'

const store = new Corestore('./storage')
const swarm = new Hyperswarm()

// Register cleanup
Pear.teardown(async () => {
  console.log('Shutting down...')
  await swarm.destroy()
  await store.close()
})

async function main() {
  const args = Pear.config.args || process.argv.slice(2)
  console.log('Starting <app-name>...')

  // Create a topic for peer discovery
  const topic = crypto.discoveryKey(Buffer.from('<app-name>'))

  swarm.join(topic, { client: true, server: true })

  swarm.on('connection', (socket, peerInfo) => {
    console.log('Peer connected:', peerInfo.publicKey.toString('hex').slice(0, 8))
    store.replicate(socket)
  })

  await swarm.flush()
  console.log('Ready. Waiting for peers...')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

### 5. Create HTML for Desktop Apps

**For desktop only (index.html):**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title><app-name></title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #1a1a2e;
      color: #eee;
      padding: 2rem;
    }
    h1 { color: #00d9ff; }
    #peers { margin-top: 1rem; }
    .peer {
      padding: 0.5rem;
      background: #16213e;
      margin: 0.25rem 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <h1><app-name></h1>
  <p>P2P Desktop Application</p>
  <div id="peers">
    <h3>Connected Peers</h3>
  </div>
</body>
</html>
```

### 6. Provide Next Steps

After scaffolding, inform the user:

```
Application scaffolded successfully!

Next steps:
1. cd <app-name>
2. pear run --dev .     # Run in development mode

To deploy:
1. pear stage .         # Stage to Hyperdrive
2. pear seed .          # Share with network
3. pear release .       # Production release

Your app will be available via pear:// link after seeding.
```

## Tips

- Replace `<app-name>` with the actual app name throughout
- For desktop apps, the HTML file provides the UI
- For terminal apps, use stdout/stdin for interaction
- The generated code includes proper cleanup with `Pear.teardown()`
- Hyperswarm is configured for both client and server mode
