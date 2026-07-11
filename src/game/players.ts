import type { Player, PlayerSetupConfig } from './types'

export const DEFAULT_COLORS: string[] = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b']

export function createPlayers(configs: PlayerSetupConfig[]): Player[] {
  return configs.map((config, index) => ({
    id: index,
    name: config.name,
    type: config.type,
    difficulty: config.difficulty,
    color: config.color,
    score: 0,
  }))
}
