const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I to avoid ambiguity
const CODE_LENGTH = 6
const ROOM_PEER_PREFIX = 'dots-and-boxes-room-'

export function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return code
}

/** PeerJS peer IDs share a global namespace across all PeerJS users, so room codes are namespaced to avoid collisions with unrelated apps. */
export function roomCodeToPeerId(code: string): string {
  return `${ROOM_PEER_PREFIX}${code}`
}

export function roomLink(code: string): string {
  const url = new URL(location.href)
  url.search = `?room=${code}`
  url.hash = ''
  return url.toString()
}
