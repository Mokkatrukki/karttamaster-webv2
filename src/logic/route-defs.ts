import type { RouteConfig } from './multi-route'

// T303/V215/B117: reittien KANONINEN lista. Oli aiemmin `src/main.ts`:ssä, mutta main tuo
// mukanaan Leafletin ja DOM:in ∴ huoltoskriptit (bun, ei selainta) eivät voineet importoida
// sitä ja tekivät oman kovakoodatun kopionsa — joka jäi jälkeen kun 6. reitti lisättiin ja
// migraatio ajettiin 5/6 reitillä tuotantoon. Yksi lähde, ei kopioita.
//
// Kaksi tapahtumaa erottuvat värisävyperheellä (SPEC §C, DESIGN §Reitti-/pätkävärit):
// SyöteMTB = viileä/sininen, Syötekylä Gravel Fest = lämmin oranssi-puna.
export const ROUTE_DEFS: Omit<RouteConfig, 'routePoints'>[] = [
  { id: 'smtb-30',  label: '30 km',  color: '#4C97D6', event: 'SyöteMTB',    file: '/smtb-2026-30km.gpx' },
  { id: 'smtb-55',  label: '55 km',  color: '#2F6FB0', event: 'SyöteMTB',    file: '/smtb-2026-55km.gpx' },
  { id: 'smtb-110-siirtyma', label: '110 km siirtymä', color: '#1E5A8F', event: 'SyöteMTB', file: '/smtb-2026-110km-siirtyma.gpx' },
  { id: 'sgf-62',   label: '62 km',  color: '#E9A13B', event: 'Gravel Fest', file: '/sgf-2026-62km.gpx' },
  { id: 'sgf-125',  label: '125 km', color: '#E2662A', event: 'Gravel Fest', file: '/sgf-2026-125km.gpx' },
  { id: 'sgf-175',  label: '175 km', color: '#C4384A', event: 'Gravel Fest', file: '/sgf-2026-175km.gpx' },
]
