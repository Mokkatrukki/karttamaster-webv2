/* global React, MapBackdropOrg */
const NS = window.KarttamasterDesignSystem_3ae2ca;
const { IconButton, Button, RouteTab, ProgressBar, SignMarker, MarkerListItem, StatusBadge, Card, Input } = NS;
const { useState } = React;

const SIGN_LIBRARY = [
  { glyph: '→', hue: 'var(--marker-right)', type: 'right', name: 'Nuoli oikealle' },
  { glyph: '←', hue: 'var(--marker-left)', type: 'left', name: 'Nuoli vasemmalle' },
  { glyph: '↱', hue: 'var(--marker-up-r)', type: 'up_r', name: 'Tuleva oikealle' },
  { glyph: '↰', hue: 'var(--marker-up-l)', type: 'up_l', name: 'Tuleva vasemmalle' },
  { glyph: '!', hue: 'var(--marker-up-r)', type: 'up_r', name: 'Varo hyppy' },
  { glyph: 'H', hue: 'var(--marker-left)', type: 'left', name: 'Huolto 25 km' },
];

const SEGMENTS = [
  { id: 1, name: 'Pohjoislenkki', km: '12,0 – 23,8 km', who: 'Anni K.', color: 'var(--route-1)' },
  { id: 2, name: 'Salmiperän silmukka', km: '23,8 – 38,0 km', who: 'Jukka P.', color: 'var(--route-3)' },
  { id: 3, name: 'Itäharju', km: '38,0 – 51,2 km', who: '', color: 'var(--route-4)' },
];

const MAP_MARKERS = [
  { id: 1, glyph: '→', type: 'right', status: 'asetettu', x: 30, y: 34, bearing: 30 },
  { id: 2, glyph: '!', type: 'up_r', status: 'asetettu', x: 44, y: 28, bearing: 0 },
  { id: 3, glyph: '←', type: 'left', status: 'tarkistettu', x: 58, y: 30, bearing: 200 },
  { id: 4, glyph: '→', type: 'right', status: 'suunniteltu', x: 64, y: 46, bearing: 120 },
  { id: 5, glyph: '↰', type: 'up_l', status: 'suunniteltu', x: 52, y: 58, bearing: 0 },
  { id: 6, glyph: '→', type: 'right', status: 'kerätty', x: 38, y: 56, bearing: 90 },
  { id: 7, glyph: 'H', type: 'left', status: 'asetettu', x: 46, y: 44, bearing: 0 },
];

function Toolbar({ placeMode, onAddSign, onMenu }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-1-5)',
      padding: 'var(--pad-toolbar)', background: 'var(--surface-app)', color: 'var(--text-body)',
      borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, position: 'relative', zIndex: 30,
    }}>
      <Button variant={placeMode ? 'danger' : 'primary'} onClick={onAddSign} iconLeft={placeMode ? '✕' : '＋'}
        style={placeMode ? { background: 'var(--danger)', color: '#fff' } : {}}>
        {placeMode ? 'Peruuta' : 'Merkki'}
      </Button>
      {placeMode && <span style={{ fontSize: 'var(--text-meta)', color: 'var(--amber-300)', whiteSpace: 'nowrap' }}>Klikkaa karttaa asettaaksesi</span>}
      <Button variant="ghost" iconLeft="📍">GPS</Button>
      <Button variant="primary" style={{ background: 'var(--accent)' }}>Järjestäjä</Button>
      <div style={{ flex: 1 }} />
      <Button variant="ghost" size="sm">Kartta</Button>
      <IconButton label="Valikko" onClick={onMenu}>⋯</IconButton>
    </div>
  );
}

function StatusOverview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 14px', background: 'var(--surface-app)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, zIndex: 20 }}>
      <ProgressBar label="35 km" value={100} detail="40/40" />
      <ProgressBar label="55 km" value={62} detail="38/61" />
    </div>
  );
}

function LeftPanel({ open, onToggle }) {
  return (
    <div style={{
      width: open ? '300px' : '0px', flexShrink: 0, background: 'var(--surface-app)',
      borderRight: open ? '1px solid var(--border-subtle)' : 'none', overflow: 'hidden',
      transition: 'width var(--dur-base) var(--ease)', position: 'relative', zIndex: 15,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ width: '300px', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
        {/* Sign library */}
        <section style={panelSection}>
          <h3 style={panelHead}>Merkkikirjasto</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {SIGN_LIBRARY.map((s, i) => (
              <button key={i} style={libBtn}>
                <span style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', background: s.hue, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{s.glyph}</span>
                <span style={{ fontSize: 'var(--text-sm)', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              </button>
            ))}
          </div>
        </section>
        {/* Segment assignment */}
        <section style={panelSection}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={panelHead}>Pätkäjako</h3>
            <Button variant="secondary" size="sm">Luo uusi</Button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            {SEGMENTS.map(s => (
              <div key={s.id} style={segRow}>
                <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: s.color }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-body)' }}>{s.name}</div>
                  <div style={{ fontSize: 'var(--text-meta)', color: 'var(--text-muted)' }}>{s.km}</div>
                </div>
                {s.who
                  ? <StatusBadge status="asetettu">{s.who}</StatusBadge>
                  : <span style={{ fontSize: 'var(--text-meta)', color: 'var(--text-meta)' }}>jakamaton</span>}
              </div>
            ))}
          </div>
        </section>
      </div>
      <button onClick={onToggle} aria-label="Sulje paneeli" style={collapseTab}>◀</button>
    </div>
  );
}
const panelSection = { padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' };
const panelHead = { margin: 0, fontSize: 'var(--text-meta)', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 700 };
const libBtn = { display: 'flex', alignItems: 'center', gap: '8px', minHeight: 'var(--touch-min)', padding: '6px 8px', background: 'var(--field-tint)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-body)', cursor: 'pointer', fontFamily: 'var(--font-ui)' };
const segRow = { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: 'var(--field-tint)', borderRadius: 'var(--radius-sm)' };
const collapseTab = { position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)', width: 22, height: 52, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRight: 'none', borderRadius: '8px 0 0 8px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 };

function MapArea({ placeMode }) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden', cursor: placeMode ? 'crosshair' : 'default' }}>
      <MapBackdropOrg />
      <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-sm)', overflow: 'hidden', boxShadow: 'var(--shadow-marker)' }}>
        <button style={zoomBtn}>+</button>
        <button style={{ ...zoomBtn, borderTop: '1px solid #ddd' }}>−</button>
      </div>
      <div style={{ position: 'absolute', top: 12, right: 12 }}>
        <span style={{ fontSize: 'var(--text-meta)', fontWeight: 700, letterSpacing: '0.06em', padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.18)', color: 'var(--amber-300)', border: '1px solid rgba(245,158,11,0.3)' }}>LUONNOS</span>
      </div>
      {MAP_MARKERS.map(m => (
        <div key={m.id} style={{ position: 'absolute', left: `${m.x}%`, top: `${m.y}%`, transform: 'translate(-50%,-100%)' }}>
          <SignMarker type={m.type} glyph={m.glyph} status={m.status} bearing={m.bearing} />
        </div>
      ))}
    </div>
  );
}
const zoomBtn = { width: 36, height: 36, background: '#fff', border: 'none', color: '#333', fontSize: 18, cursor: 'pointer', fontWeight: 700 };

function RouteBar() {
  return (
    <div style={{ background: 'var(--surface-app)', color: 'var(--text-body)', padding: '8px 14px 10px', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', boxShadow: 'var(--shadow-bar-up)', flexShrink: 0, zIndex: 20 }}>
      <RouteTab label="35 km" color="var(--route-2)" active />
      <RouteTab label="55 km" color="var(--route-1)" />
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginLeft: '8px', fontVariantNumeric: 'tabular-nums' }}>0,00 / 34,1 km</span>
      <div style={{ flex: 1 }} />
      <IconButton label="Edellinen" variant="solid">◀</IconButton>
      <IconButton label="Seuraava" variant="solid">▶</IconButton>
    </div>
  );
}

function OrganizerApp() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [placeMode, setPlaceMode] = useState(false);

  return (
    <div data-theme="dark" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface-app)', fontFamily: 'var(--font-ui)' }}>
      <Toolbar placeMode={placeMode} onAddSign={() => setPlaceMode(p => !p)} onMenu={() => setPanelOpen(o => !o)} />
      <StatusOverview />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <LeftPanel open={panelOpen} onToggle={() => setPanelOpen(false)} />
        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!panelOpen && (
            <button onClick={() => setPanelOpen(true)} aria-label="Avaa paneeli"
              style={{ position: 'absolute', top: '50%', left: 0, transform: 'translateY(-50%)', zIndex: 12, width: 22, height: 52, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderLeft: 'none', borderRadius: '0 8px 8px 0', color: 'var(--text-muted)', cursor: 'pointer' }}>▶</button>
          )}
          <MapArea placeMode={placeMode} />
        </div>
      </div>
      <RouteBar />
    </div>
  );
}
window.OrganizerApp = OrganizerApp;
