#!/bin/bash

# Pear Application Scaffolding Script
#
# Creates a new Pear desktop or terminal application with the basic structure
# and dependencies needed to get started.
#
# Usage:
#   ./scaffold-pear.sh desktop my-desktop-app
#   ./scaffold-pear.sh terminal my-cli-app

set -e

TYPE=${1:-desktop}
NAME=${2:-my-pear-app}

echo "========================================"
echo "Pear Application Scaffolder"
echo "========================================"
echo ""

if [[ "$TYPE" != "desktop" && "$TYPE" != "terminal" ]]; then
  echo "Usage: $0 <desktop|terminal> <app-name>"
  echo ""
  echo "Examples:"
  echo "  $0 desktop my-desktop-app"
  echo "  $0 terminal my-cli"
  exit 1
fi

if [[ -d "$NAME" ]]; then
  echo "Error: Directory '$NAME' already exists"
  exit 1
fi

echo "Creating $TYPE application: $NAME"
echo ""

# Create directory structure
mkdir -p "$NAME"
cd "$NAME"

# Initialize package.json
if [[ "$TYPE" == "desktop" ]]; then
  cat > package.json << EOF
{
  "name": "$NAME",
  "version": "1.0.0",
  "description": "A Pear desktop application",
  "main": "app.js",
  "pear": {
    "name": "$NAME",
    "type": "desktop",
    "gui": {
      "width": 800,
      "height": 600,
      "backgroundColor": "#1a1a2e"
    }
  },
  "dependencies": {
    "pear-electron": "latest",
    "hyperswarm": "latest",
    "hypercore": "latest"
  },
  "devDependencies": {},
  "license": "MIT"
}
EOF

  # Create main app file
  cat > app.js << 'EOF'
/* global Pear */
import Hyperswarm from 'hyperswarm'

const swarm = new Hyperswarm()

// Cleanup on app close
Pear.teardown(async () => {
  await swarm.destroy()
})

// Your P2P logic here
console.log('App started')
console.log('App key:', Pear.config.key?.toString('hex') || 'dev mode')
EOF

  # Create HTML file
  cat > index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>My Pear App</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      padding: 20px;
      min-height: 100vh;
    }
    h1 {
      color: #00d9ff;
      margin-bottom: 20px;
    }
    .status {
      padding: 10px;
      background: #16213e;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .peers {
      list-style: none;
    }
    .peers li {
      padding: 8px;
      background: #0f3460;
      margin: 4px 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <h1>Pear P2P App</h1>
  <div class="status">
    <p>Status: <span id="status">Initializing...</span></p>
  </div>
  <h2>Connected Peers</h2>
  <ul id="peers" class="peers">
  </ul>
  <script type="module" src="./renderer.js"></script>
</body>
</html>
EOF

  # Create renderer file
  cat > renderer.js << 'EOF'
// Renderer process (runs in browser context)
// Communication with main process via Pear IPC

document.getElementById('status').textContent = 'Ready'

// Example: Listen for peer updates from main process
// const { ipc } = await import('pear')
// ipc.on('peer-added', (data) => {
//   const li = document.createElement('li')
//   li.textContent = data.key.slice(0, 8) + '...'
//   document.getElementById('peers').appendChild(li)
// })
EOF

else
  # Terminal application
  cat > package.json << EOF
{
  "name": "$NAME",
  "version": "1.0.0",
  "description": "A Pear terminal application",
  "main": "index.js",
  "bin": {
    "$NAME": "./index.js"
  },
  "pear": {
    "name": "$NAME",
    "type": "terminal"
  },
  "dependencies": {
    "pear-terminal": "latest",
    "hyperswarm": "latest",
    "hypercore": "latest"
  },
  "devDependencies": {},
  "license": "MIT"
}
EOF

  # Create main file
  cat > index.js << 'EOF'
#!/usr/bin/env node
/* global Pear */
import Hyperswarm from 'hyperswarm'

const swarm = new Hyperswarm()

// Parse arguments
const args = Pear?.config?.args || process.argv.slice(2)

// Cleanup on exit
Pear?.teardown?.(async () => {
  await swarm.destroy()
})

process.on('SIGINT', async () => {
  console.log('\nShutting down...')
  await swarm.destroy()
  process.exit(0)
})

async function main() {
  console.log('P2P Terminal App')
  console.log('================')
  console.log('')
  console.log('Arguments:', args)
  console.log('')

  // Your P2P logic here
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
EOF

fi

# Create README
cat > README.md << EOF
# $NAME

A Pear $TYPE application.

## Development

\`\`\`bash
# Install dependencies
npm install

# Run in development mode
pear run --dev .
\`\`\`

## Deployment

\`\`\`bash
# Stage the app (sync to Hyperdrive)
pear stage .

# Seed the app (share with network)
pear seed .

# Release for production
pear release .

# Get shareable link
pear info .
\`\`\`

## Structure

- \`package.json\` - App configuration and dependencies
$(if [[ "$TYPE" == "desktop" ]]; then
echo "- \`app.js\` - Main process (P2P logic)"
echo "- \`index.html\` - UI"
echo "- \`renderer.js\` - Renderer process (UI logic)"
else
echo "- \`index.js\` - Main entry point"
fi)

## Learn More

- [Pear Documentation](https://docs.pears.com)
- [Holepunch Documentation](https://docs.holepunch.to)
EOF

# Create .gitignore
cat > .gitignore << 'EOF'
node_modules/
.pear/
data-*/
drive-*/
*.log
EOF

echo "Created $TYPE application in ./$NAME"
echo ""
echo "Next steps:"
echo "  cd $NAME"
echo "  npm install"
echo "  pear run --dev ."
echo ""
echo "For production:"
echo "  pear stage ."
echo "  pear seed ."
echo "  pear release ."
