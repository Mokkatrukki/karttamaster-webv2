const LS_KEY = 'karttamaster-role'

export type Role = 'järjestäjä' | 'talkoolainen'

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
