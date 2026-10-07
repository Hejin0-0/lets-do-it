// The campaign (its words: CAMPAIGN in ui/words.ts): S1 → S2 → S3 on the real 1917 calendar of the
// coast front, each result bending the next battle's British starting numbers — Strandfest won puts
// a shell more into Hush, Hush won a candle more into the Sluice (lost: one fewer). Progress is a
// per-viewer convenience in localStorage; any read or write may fail (a private window), so it is
// never load-bearing.
import { readStored, removeStored, writeStored } from '@lid/storage'
import type { ScenarioId } from '../contract/types.ts'

export const CHAPTERS: readonly ScenarioId[] = ['s1', 's2', 's3']

export interface Campaign { chapter: number; won: boolean[] }

const KEY = 'ink-iron:campaign'

export function loadCampaign(): Campaign | null {
  return readStored(KEY, (text) => {
    const c = JSON.parse(text ?? 'null') as Campaign | null
    return c && Number.isInteger(c.chapter) && c.chapter >= 0 && c.chapter < CHAPTERS.length && Array.isArray(c.won) ? c : null
  }, null)
}

export function saveCampaign(c: Campaign | null): void {
  // no storage: the campaign still runs, it is only not remembered
  if (c) writeStored(KEY, JSON.stringify(c))
  else removeStored(KEY)
}

/** The bend the previous chapter's result puts on this one (British side). */
export function campaignMods(c: Campaign): { he: number; morale: number } {
  const prev = c.won[c.chapter - 1]
  if (prev === undefined) return { he: 0, morale: 0 }
  const d = prev ? 1 : -1
  return c.chapter === 1 ? { he: d, morale: 0 } : { he: 0, morale: d }
}
