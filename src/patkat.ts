import './style.css'
import { renderPatkatPage } from './ui/patkat-page'
import { fetchAllSegments } from './logic/segment-sync'
import { fetchMarkers } from './logic/sync'
import type { Segment } from './logic/segments'
import type { SignMarker } from './logic/types'

const content = document.getElementById('patkat-content')!

async function boot(): Promise<void> {
  // Auth-gate (Model B): ilman voimassa olevaa sessiota → kirjautumiseen.
  // T272 korvaa tämän yleissalasana-loginilla joka palaa /patkat:iin; nyt ohjaa juureen.
  const me = await fetch('/api/auth/me')
  if (!me.ok) {
    window.location.href = '/'
    return
  }
  const { role } = (await me.json()) as { role: string }

  const [faqRes, segRes, markerRes] = await Promise.all([
    fetch('/api/faq').then(r => (r.ok ? r.json() : { markdown: '' })).catch(() => ({ markdown: '' })),
    fetchAllSegments(),
    fetchMarkers(),
  ])

  const faqMarkdown = (faqRes as { markdown?: string }).markdown ?? ''
  const segments: Segment[] = segRes.ok ? segRes.segments : []
  const markers: SignMarker[] = markerRes.ok ? markerRes.markers : []

  renderPatkatPage(content, { faqMarkdown, segments, markers, role })
}

void boot()
