import type { RouteConfig } from './multi-route'

// T303/V215/B117: reittien KANONINEN lista. Oli aiemmin `src/main.ts`:ssä, mutta main tuo
// mukanaan Leafletin ja DOM:in ∴ huoltoskriptit (bun, ei selainta) eivät voineet importoida
// sitä ja tekivät oman kovakoodatun kopionsa — joka jäi jälkeen kun 6. reitti lisättiin ja
// migraatio ajettiin 5/6 reitillä tuotantoon. Yksi lähde, ei kopioita.
//
// Kaksi tapahtumaa erottuvat värisävyperheellä (SPEC §C, DESIGN §Reitti-/pätkävärit):
// SyöteMTB = viileä/sininen, Syötekylä Gravel Fest = lämmin oranssi-puna. Perheen SISÄLLÄ
// sävyerot (T304/V216) — vaaleusporrastus ei riitä erottamaan.
export const ROUTE_DEFS: Omit<RouteConfig, 'routePoints'>[] = [
  // T304/V216: KAKSI riippumatonta kanavaa. (1) Sävy: perhe erottaa tapahtuman (MTB viileä,
  // Gravel lämmin) & sävyero erottaa reitit perheen SISÄLLÄ (ennen: 3 sinistä samaa sävyä eri
  // vaaleuksilla → katosi auringossa & päällekkäisillä osuuksilla ylempi peitti alemman täysin).
  // (2) Viivakuvio: sama kolmikko molemmissa perheissä (ehjä / pitkä katko / lyhyt katko) ∴
  // JAETULLA OSUUDELLA alla kulkeva reitti paljastuu ylemmän aukoista — ja kuvio luetaan myös
  // akromaattisesti (värisokeus, aurinko, mobiilin autokirkkaus).
  // Luminanssibudjetti (mitattu): viiva vaaleaa karttaa (#F2F0EA) vasten ≥2.5:1 JA reittipillerin
  // tumma teksti (#17221D) väriä vasten ≥3:1 — pilleri renderöi värin TAUSTAKSI (route-bar.ts).
  { id: 'smtb-30',  label: '30 km',  color: '#1D8CB4', dashArray: undefined, event: 'SyöteMTB',    file: '/smtb-2026-30km.gpx' },
  { id: 'smtb-55',  label: '55 km',  color: '#4D6FCB', dashArray: '18 8',    event: 'SyöteMTB',    file: '/smtb-2026-55km.gpx' },
  { id: 'smtb-110-siirtyma', label: '110 km siirtymä', color: '#8C71D6', dashArray: '6 10', event: 'SyöteMTB', file: '/smtb-2026-110km-siirtyma.gpx' },
  { id: 'sgf-62',   label: '62 km',  color: '#A58312', dashArray: undefined, event: 'Gravel Fest', file: '/sgf-2026-62km.gpx' },
  { id: 'sgf-125',  label: '125 km', color: '#E2662A', dashArray: '18 8',    event: 'Gravel Fest', file: '/sgf-2026-125km.gpx' },
  { id: 'sgf-175',  label: '175 km', color: '#C4384A', dashArray: '6 10',     event: 'Gravel Fest', file: '/sgf-2026-175km.gpx' },
]
