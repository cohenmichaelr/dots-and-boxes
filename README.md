# Dots and Boxes

A mobile-friendly Dots and Boxes game for up to 4 players — any mix of humans and computer opponents. Play hotseat-style on one shared device, or online across multiple devices with a room code.

**Play it:** https://cohenmichaelr.github.io/dots-and-boxes/

## How online multiplayer works

The multi-device play is peer-to-peer WebRTC via [PeerJS](https://peerjs.com/) — there's no game server at all, which is what makes it work on GitHub Pages (static hosting, no backend). Here's the design, from [`src/net`](src/net):

### Finding each other: room codes as PeerJS IDs

When you host a game, the app generates a 6-character room code from an alphabet with 0/O/1/I removed to avoid squinting ([`roomCode.ts`](src/net/roomCode.ts)). The trick is that the code *is* the network address: the host registers itself with PeerJS's free public broker under the peer ID `dots-and-boxes-room-<CODE>` (the prefix namespaces it, since PeerJS IDs are global across every app using the broker — and [`peerConnection.ts`](src/net/peerConnection.ts) retries with a fresh code if it ever collides). A guest who types the code — or opens the shared `?room=CODE` link — just derives the same peer ID and connects. The broker only performs the introduction (signaling); after the handshake, moves flow directly between the devices over an encrypted WebRTC data channel.

### Staying in sync: the host is the authority

This is the part that prevents two devices from disagreeing about the board. Guests are deliberately dumb terminals — [`guestSession.ts`](src/net/guestSession.ts) can only send two messages: `join` and `move (edgeId)`. Only the host ([`hostSession.ts`](src/net/hostSession.ts)) runs the actual game engine. When a move arrives it validates everything — game started? seat at the table? actually your turn? — applies it with the same `playTurn` the offline mode uses, and then broadcasts the complete game state to every device: all drawn edges, box owners, scores, whose turn it is. Sending full snapshots instead of deltas ([`protocol.ts`](src/net/protocol.ts)) means guests can't drift out of sync — each snapshot fully replaces whatever they had. AI opponents also live host-side, so a guest playing "against the computer" is really just receiving state broadcasts like anyone else.

The lobby works the same way — joins are validated by the host (room full, color taken, game already started) and every roster change is re-broadcast to all connected devices.

### The tradeoff

The main tradeoff of this serverless design: the host's browser tab *is* the server. If the host closes the tab, the room dies — that's why the guest session has an `onHostDisconnected` hook to show the "host left" state rather than hanging.

## Development

```
npm install
npm run dev       # start dev server
npm run lint      # lint
npm run build     # type-check + production build
npm run preview   # preview production build
```
