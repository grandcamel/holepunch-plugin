---
name: debug
description: Debug P2P connectivity, replication, or discovery issues
argument-hint: "[connectivity|replication|discovery]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

# Debug P2P Issues

Diagnose and troubleshoot common Holepunch P2P issues.

## Issue Categories

Based on user's argument or description, focus on one of:

1. **connectivity** - Peers not connecting, NAT/firewall issues
2. **replication** - Data not syncing between peers
3. **discovery** - Peers not finding each other

If no argument provided, ask the user to describe their symptoms.

## Diagnostic Process

### Step 1: Identify the Issue Category

Ask clarifying questions if needed:
- Are peers connecting at all? (connectivity)
- Are peers connecting but data not syncing? (replication)
- Is `swarm.on('connection')` never firing? (discovery)

### Step 2: Run Appropriate Diagnostics

#### Connectivity Issues

Check for these common problems:

1. **NAT/Firewall blocking**
   - Look for `ban` events: `swarm.on('ban', ...)`
   - Check if all peers are client-only (need at least one server)
   - Verify UDP traffic is allowed

2. **Review the code for:**
   ```javascript
   // Must have at least one server
   swarm.join(topic, { client: true, server: true })

   // Check for firewall rejections
   swarm.on('ban', (peer, err) => {
     console.log('Banned:', err.message)
   })
   ```

3. **Suggest diagnostic code:**
   ```javascript
   swarm.on('connection', (socket, info) => {
     console.log('Connection type:', info.type)
     // 'relay' indicates NAT issues
   })
   ```

#### Replication Issues

Check for these common problems:

1. **Missing findingPeers() pattern**
   - Search code for `findingPeers` usage
   - This is the #1 cause of replication issues

2. **Review the code for:**
   ```javascript
   // WRONG - update returns immediately
   swarm.join(core.discoveryKey)
   const updated = await core.update()  // false!

   // CORRECT
   const done = core.findingPeers()
   swarm.join(core.discoveryKey)
   await swarm.flush()
   done()
   const updated = await core.update()
   ```

3. **Sparse mode issues**
   - Check if only requesting specific blocks
   - May need `core.download({ start: 0, end: -1 })`

4. **Suggest diagnostic code:**
   ```javascript
   core.on('peer-add', (peer) => console.log('Peer added'))
   core.on('download', (index) => console.log('Downloaded:', index))
   core.on('upload', (index) => console.log('Uploaded:', index))
   ```

#### Discovery Issues

Check for these common problems:

1. **Topic mismatch**
   - Topics must be exactly 32 bytes
   - Same encoding on both peers (Buffer vs string)

2. **Not waiting for flush**
   - Servers must `await discovery.flushed()`
   - Clients must `await swarm.flush()`

3. **Client-only mode**
   - If all peers are client-only, none will find each other

4. **Review the code for:**
   ```javascript
   // Verify topic is correct
   const topic = crypto.discoveryKey(Buffer.from('my-topic'))
   console.log('Topic:', topic.toString('hex'))

   // Ensure server mode
   swarm.join(topic, { client: true, server: true })

   // Wait for DHT announcement
   await discovery.flushed()
   ```

### Step 3: Search User's Code

Use Grep and Read to search for:
- `findingPeers` usage
- `swarm.join` calls and their options
- `core.discoveryKey` vs `core.key` usage
- Error handling for `ban` events
- Cleanup with `swarm.destroy()`

### Step 4: Provide Recommendations

Based on findings, provide:
1. Specific code changes to fix issues
2. Diagnostic code to add for more info
3. Reference to `references/debugging.md` for detailed troubleshooting

## Common Fixes Quick Reference

| Symptom | Fix |
|---------|-----|
| `core.update()` returns false | Add `findingPeers()` pattern |
| No `connection` events | Use `server: true` on at least one peer |
| Peers connect then disconnect | Check firewall callback |
| Works locally, fails remote | NAT traversal - try relay server |
| Using `core.key` in `swarm.join` | Change to `core.discoveryKey` |

## Additional Resources

Refer user to:
- `references/debugging.md` for comprehensive troubleshooting
- NotebookLM: "Ask my Pear notebook about [specific issue]"
