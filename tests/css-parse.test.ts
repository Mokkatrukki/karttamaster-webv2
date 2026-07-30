import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import postcss from 'postcss'

// Löytyi T400–T404:n mergessä: konfliktin ratkaisu nielaisi YHDEN sulkevan `}`:n
// (git katkaisi hunkin kesken sääntöä) → `Unclosed block` → koko sovellus ei renderöi.
// Vitest ⊥ katso CSS:ää & `tsc` ⊥ tunne sitä ∴ 1984 vihreää testiä & puhdas kääntäjä
// lupasivat ehjän buildin. Vika löytyi vasta Playwrightista 7 min päästä.
//
// Tämä on halvin mahdollinen vahti: parsi jokainen CSS-tiedosto. ⊥ tyylitarkistus,
// ⊥ lintteri — pelkkä "onko tämä syntaktisesti CSS:ää". Millisekunteja, & se erottaa
// rikkinäisen buildin ehjästä ennen kuin selain ehtii avata.
const CSS_FILES = ['src/style.css', 'src/audit-log.css', 'src/name-prompt.css']

describe('CSS-tiedostot parsiutuvat (merge-vahti)', () => {
  for (const file of CSS_FILES) {
    it(`${file} on syntaktisesti kelvollista CSS:ää`, () => {
      const src = readFileSync(file, 'utf8')
      expect(() => postcss.parse(src, { from: file })).not.toThrow()
    })

    it(`${file}: aaltosulut tasapainossa (⊥ orpoa lohkoa)`, () => {
      const src = readFileSync(file, 'utf8')
      // Karkea mutta ristiriidaton lisävahti: postcss korjaa hiljaa joitain tapauksia,
      // laskuri ⊥ korjaa mitään. Konfliktin jälki näkyy tässä heti.
      expect(countChar(src, '{')).toBe(countChar(src, '}'))
    })
  }

  it('⊥ merge-konfliktimerkkejä CSS:ssä', () => {
    for (const file of CSS_FILES) {
      const src = readFileSync(file, 'utf8')
      expect(src).not.toMatch(/^<{7} |^={7}$|^>{7} /m)
    }
  })
})

function countChar(s: string, ch: string): number {
  let n = 0
  for (const c of s) if (c === ch) n++
  return n
}
