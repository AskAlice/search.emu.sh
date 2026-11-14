export type Cat = 'web' | 'answer' | 'network' | 'money' | 'media' | 'dev' | 'bang' | 'entity'
export type Item = {
  cat: Cat
  kind: string
  title: string
  tag: string
  icon: string
  value: string
  sub?: string
  big?: string
  text?: string
  art?: string
  poster?: boolean
  swatch?: string
  spark?: number[]
  rows?: Array<[string, string]>
  url?: string | null
  fill?: boolean
}
export type Bang = { name: string; aliases: string[]; url: string; description: string }
export type Os = 'macos' | 'linux' | 'windows'
export type InstallPlan = { list: string; install: string; restore: string; backups: string; note: string; unsupported: string }

export const SEARCH: string
export const SQL: string
export const ICON: Record<Cat, string>
export const ART: Record<string, string>
export const CAT_LABEL: Record<Cat, string>
export const DEFAULT_BANGS: Bang[]
export const BROWSERS: Array<[id: string, label: string]>
export const EXAMPLES: Array<{ cat: Cat; title: string; items: Array<[query: string, description: string]> }>
export function suggest(input: string, bangs?: Bang[]): Item[]
export function loadBangs(): Bang[]
/** Validates then persists. Throws an Error carrying `.index` of the offending bang. */
export function saveBangs(list: Bang[]): Bang[]
export function validateBangs(list: unknown): Bang[]
export function installPlan(options: { os: Os; browser: string; profile: string }): InstallPlan
export function host(url: string): string
