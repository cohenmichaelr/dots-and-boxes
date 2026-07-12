import { connectAsGuest } from './peerConnection'
import type { BoardSize } from '../game/types'
import type { GuestToHostMessage, HostToGuestMessage, LobbyInfo, OnlineGameSession, StatePayload, WirePlayer } from './protocol'

export interface GuestSession extends OnlineGameSession {
  onLobbyUpdate(cb: (lobby: LobbyInfo) => void): void
  onGameStarted(cb: (boardSize: BoardSize, players: WirePlayer[]) => void): void
  onRoomError(cb: (message: string) => void): void
  onHostDisconnected(cb: () => void): void
}

export function joinRoom(code: string, name: string, color: string): Promise<GuestSession> {
  return connectAsGuest(code).then(
    ({ peer, connection }) =>
      new Promise<GuestSession>((resolve, reject) => {
        let settled = false
        let lobbyCb: ((lobby: LobbyInfo) => void) | null = null
        let gameStartedCb: ((boardSize: BoardSize, players: WirePlayer[]) => void) | null = null
        let stateCb: ((payload: StatePayload) => void) | null = null
        let roomErrorCb: ((message: string) => void) | null = null
        let hostDisconnectedCb: (() => void) | null = null

        function send(message: GuestToHostMessage): void {
          connection.send(message)
        }

        function handleMessage(raw: unknown): void {
          const message = raw as HostToGuestMessage

          if (!settled) {
            if (message.type !== 'joinAck') return
            settled = true
            if (!message.ok) {
              connection.close()
              peer.destroy()
              reject(new Error(message.error))
              return
            }
            const localPlayerId = message.playerId
            resolve({
              localPlayerId,
              onLobbyUpdate(cb) {
                lobbyCb = cb
              },
              onGameStarted(cb) {
                gameStartedCb = cb
              },
              onState(cb) {
                stateCb = cb
              },
              onRoomError(cb) {
                roomErrorCb = cb
              },
              onHostDisconnected(cb) {
                hostDisconnectedCb = cb
              },
              submitMove(edgeId) {
                send({ type: 'move', edgeId })
              },
              destroy() {
                connection.close()
                peer.destroy()
              },
            })
            return
          }

          switch (message.type) {
            case 'lobbyUpdate':
              lobbyCb?.({ boardSize: message.boardSize, aiPlayers: message.aiPlayers, participants: message.participants })
              break
            case 'gameStarted':
              gameStartedCb?.(message.boardSize, message.players)
              break
            case 'state':
              stateCb?.({
                drawnEdges: message.drawnEdges,
                boxOwners: message.boxOwners,
                players: message.players,
                currentPlayerIndex: message.currentPlayerIndex,
                status: message.status,
                winnerIds: message.winnerIds,
                lastMove: message.lastMove,
              })
              break
            case 'roomError':
              roomErrorCb?.(message.message)
              break
          }
        }

        connection.on('data', handleMessage)
        connection.on('close', () => {
          if (settled) hostDisconnectedCb?.()
          else reject(new Error('Connection to the host closed before joining finished.'))
        })

        send({ type: 'join', name, color })
      }),
  )
}
