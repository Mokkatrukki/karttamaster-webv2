/**
 * T469/V356 (B203) — näkyvyys ⊥ ole valmius.
 *
 * `#btn-list` on staattisessa HTML:ssä ∴ se on näkyvä heti. Sen kuuntelija syntyy `wireMarkers`issa
 * joka ajetaan KAHDEN `await`in (`wireAreas`, `wireSegments`) jälkeen ∴ nappi oli painettavissa
 * koko verkkohaun ajan & painallus katosi täysin (V337: hiljaisuus ⊥ ole neutraali vastaus).
 *
 * Vika löytyi t415:n kaatumisesta: testi odotti napin NÄKYVYYTTÄ & klikkasi heti. Se oli oikeassa
 * — nappi oli näkyvä. Väärässä oli nappi.
 *
 * Tämä vahti mittaa TILAA ⊥ ajoitusta: `disabled` ennen valmiutta, `enabled` sen jälkeen. Ajoitusta
 * mittaava testi olisi sama kilpajuoksu toisin päin.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja, mockMarkers } from './helpers/auth'

test.use({ viewport: { width: 1280, height: 720 } })

test('V356 — "Kaikki merkit" on disabled kunnes kuuntelija on kytketty', async ({ page }) => {
  // Hidasta pätkähaku: se on yksi niistä `await`eista joiden takana kytkentä on ∴ ikkuna kasvaa
  // mitattavaksi. Sama tilanne kuin metsässä huonolla yhteydellä, ⊥ keinotekoinen erikoistapaus.
  await mockAuthAsJarjestaja(page)
  await mockMarkers(page, [])
  await page.route(/\/api\/segments(\?|$)/, async route => {
    await new Promise(r => setTimeout(r, 1500))
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.goto('/')

  // Nappi on ruudulla mutta EI painettavissa — käyttäjä näkee että se ⊥ ole vielä valmis.
  const btn = page.locator('#btn-list')
  await expect(btn).toBeVisible()
  await expect(btn).toBeDisabled()

  // Kytkennän jälkeen se aukeaa & toimii. `click()` odottaa `enabled`ia itsestään ∴ testin ⊥
  // tarvitse tietää MILLOIN — se on juuri se tieto jota kilpajuoksu vaati.
  await expect(btn).toBeEnabled({ timeout: 15000 })
  await btn.click()
  await expect(page.locator('#marker-overview')).toBeVisible()
})
