// V132/T202: UI-teema on käyttäjän vapaasti valittavissa (EI roolisidottu).
// Kaksi teemaa: 'light' = Reittimerkki-vaalea (:root, oletus), 'dark' = Kaamos-tumma.
// V5-pattern localStorage-persistenssi (vrt. role.ts), palautuu latauksessa.
const LS_KEY = 'karttamaster-theme'

export type Theme = 'light' | 'dark'

export function getTheme(): Theme {
  try {
    return localStorage.getItem(LS_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function setTheme(t: Theme): void {
  try {
    localStorage.setItem(LS_KEY, t)
  } catch {
    /* ignore — teema silti sovelletaan DOM:iin */
  }
  applyTheme(t)
}

// Asettaa <html data-theme>. 'light' → oletustokenit (:root, ei override-selektoria);
// 'dark' → [data-theme="dark"] Kaamos.
export function applyTheme(t: Theme): void {
  document.documentElement.setAttribute('data-theme', t)
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'light' ? 'dark' : 'light'
  setTheme(next)
  return next
}

// Kutsutaan latauksessa (main.ts) ennen renderiä — estää teemavälkkeen.
export function initTheme(): Theme {
  const t = getTheme()
  applyTheme(t)
  return t
}
