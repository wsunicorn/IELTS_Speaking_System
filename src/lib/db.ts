import Dexie, { type EntityTable } from 'dexie'
import type { Session } from '@/types/session'

/**
 * Local-first storage (IndexedDB via Dexie). Schema is designed to map 1:1 to
 * Postgres/Supabase later — see plan section 7 — just add `userId` + a sync
 * layer, no schema rewrite.
 */
export class IeltsSpeakingDB extends Dexie {
  sessions!: EntityTable<Session, 'id'>

  constructor() {
    super('ielts-speaking-ai')
    this.version(1).stores({
      sessions: 'id, createdAt, mode',
    })
  }
}

export const db = new IeltsSpeakingDB()
