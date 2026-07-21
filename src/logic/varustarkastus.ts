// T258/R2 (talkoolais-redesign): talkoolaisen varustarkastus — "otin nämä" checkoff.
// CLIENT-ONLY (localStorage per pätkä), henkilökohtainen valmisteluapu — EI backend, EI jaettu
// (talkoolaisen oma "otinko tavarat mukaan"). Peilaa inventaario-undon client-only-linjaa (V172,
// V180). Pätkäkohtainen avain; reload säilyttää. PUHDAS logiikka → Vitest-pure (localStorage-mock).

const KEY_PREFIX = 'karttamaster-varustarkastus-'

function storageKey(segId: string): string {
  return KEY_PREFIX + segId
}

// T262/V182: jaettu checkoff-label-avainmuoto. Inline-varustelista (SegmentEquipment) JA
// EquipmentModal käyttävät SAMOJA avaimia → varustarkastus-tila täsmää kummastakin näkymästä.
// Auto = merkkityyppi (`sign:<type>`), manuaali = ei-tyhjä nimi (`item:<nimi>`).
export function checkKeyForType(type: string): string {
  return 'sign:' + type
}
export function checkKeyForItem(name: string): string {
  return 'item:' + name.trim()
}

// Lataa checkatut label-avaimet pätkälle. Virhe/puuttuva → tyhjä (turvallinen oletus, V14-henki).
export function loadChecked(segId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(segId))
    if (!raw) return new Set()
    const arr: unknown = JSON.parse(raw)
    return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === 'string')) : new Set()
  } catch {
    return new Set()
  }
}

// Aseta yhden label-avaimen checkoff-tila, persistoi, palauta uusi joukko.
export function setChecked(segId: string, label: string, on: boolean): Set<string> {
  const s = loadChecked(segId)
  if (on) s.add(label)
  else s.delete(label)
  try {
    localStorage.setItem(storageKey(segId), JSON.stringify([...s]))
  } catch {
    /* ignore — checkoff on ei-kriittinen valmisteluapu */
  }
  return s
}

// Edistymä: montako annetuista labeleista on checkattu.
export function checkProgress(checked: Set<string>, labels: string[]): { done: number; total: number } {
  const total = labels.length
  const done = labels.filter((l) => checked.has(l)).length
  return { done, total }
}
