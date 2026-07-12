import Peer, { type DataConnection } from 'peerjs'
import { generateRoomCode, roomCodeToPeerId } from './roomCode'

const CONNECT_TIMEOUT_MS = 10000
const MAX_ID_COLLISION_RETRIES = 5

function openPeer(peerId?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = peerId ? new Peer(peerId) : new Peer()
    const onOpen = () => {
      peer.off('error', onError)
      resolve(peer)
    }
    const onError = (error: { type: string }) => {
      peer.off('open', onOpen)
      reject(error)
    }
    peer.once('open', onOpen)
    peer.once('error', onError)
  })
}

/** Opens a host Peer registered under the given room code, retrying with a fresh code on rare ID collisions. */
export async function createHostPeer(): Promise<{ peer: Peer; code: string }> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ID_COLLISION_RETRIES; attempt++) {
    const code = generateRoomCode()
    try {
      const peer = await openPeer(roomCodeToPeerId(code))
      return { peer, code }
    } catch (error) {
      lastError = error
      if ((error as { type?: string }).type !== 'unavailable-id') throw error
    }
  }
  throw lastError
}

/** Connects as a guest to the host registered under the given room code. */
export async function connectAsGuest(code: string): Promise<{ peer: Peer; connection: DataConnection }> {
  const peer = await openPeer()
  const connection = peer.connect(roomCodeToPeerId(code), { reliable: true })

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      peer.destroy()
      reject(new Error('Could not reach that room. The link may be wrong, or the host may be offline.'))
    }, CONNECT_TIMEOUT_MS)

    const onOpen = () => {
      cleanup()
      resolve({ peer, connection })
    }
    const onError = () => {
      cleanup()
      peer.destroy()
      reject(new Error('Could not reach that room. The link may be wrong, or the host may be offline.'))
    }
    const cleanup = () => {
      clearTimeout(timeout)
      connection.off('open', onOpen)
      peer.off('error', onError)
    }

    connection.once('open', onOpen)
    peer.once('error', onError)
  })
}

export function sendMessage(connection: DataConnection, message: unknown): void {
  connection.send(message)
}

export type { DataConnection }
export type { default as Peer } from 'peerjs'
