const LS_KEY = 'karttamaster-role'

export type Role = 'järjestäjä' | 'talkoolainen'

// B193/V346: LAYOUT-ROOLEJA ON KAKSI, TILIROOLEJA KOLME — `admin` saa järjestäjän näkymän.
// Kartta (`app/role-view.ts`) & hub (`patkat.ts`) tarvitsevat saman kartan ∴ se asuu logiikassa
// eikä `src/app/`:ssa: hubin entrypoint ⊥ voi importata `role-view`iä (se vetäisi mukanaan
// `AuthScreen`in, `SnapshotPanel`in & `GpkgControls`in koko karttapuolen bundlen).
export function layoutRole(accountRole: string): Role {
  return accountRole === 'talkoolainen' ? 'talkoolainen' : 'järjestäjä'
}

export function getRole(): Role {
  return localStorage.getItem(LS_KEY) === 'talkoolainen' ? 'talkoolainen' : 'järjestäjä'
}

export function setRole(r: Role): void {
  localStorage.setItem(LS_KEY, r)
}

export function toggleRole(): Role {
  const next: Role = getRole() === 'järjestäjä' ? 'talkoolainen' : 'järjestäjä'
  setRole(next)
  return next
}
