/* global React, MapBackdrop */
const NS = window.KarttamasterDesignSystem_3ae2ca;
const { IconButton, Button, RouteTab, ProgressBar, SignMarker, MarkerListItem, CheckInButton, DriveBanner, StatusBadge, Card } = NS;
const { useState } = React;

// The volunteer's assigned segment — their slice of the 55km route.
const SEGMENT = {
  name: 'Pohjoislenkki',
  range: '12,0 – 23,8 km',
  markers: [
    { id: 1, glyph: '→', hue: 'var(--marker-right)', type: 'right', name: 'Nuoli oikealle', km: '12,4 km', status: 'asetettu', x: 38, y: 30, bearing: 40 },
    { id: 2, glyph: '!', hue: 'var(--marker-up-r)', type: 'up_r', name: 'Varo hyppy', km: '14,1 km', status: 'asetettu', x: 56, y: 26, bearing: 0 },
    { id: 3, glyph: '←', hue: 'var(--marker-left)', type: 'left', name: 'Nuoli vasemmalle', km: '17,8 km', status: 'suunniteltu', x: 64, y: 48, bearing: 200 },
    { id: 4, glyph: '→', hue: 'var(--marker-right)', type: 'right', name: 'Risteys oikealle', km: '20,2 km', status: 'suunniteltu', x: 48, y: 62, bearing: 120 },
    { id: 5, glyph: '↰', hue: 'var(--marker-up-l)', type: 'up_l', name: 'Huolto 22 km', km: '22,0 km', status: 'suunniteltu', x: 32, y: 52, bearing: 0 },
  ],
};

function Toolbar({ gps, onGps, onMenu }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-1-5)',
      padding: 'var(--pad-toolbar)', background: 'var(--surface-app)', color: 'var(--text-body)',
      borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, position: 'relative', zIndex: 5,
    }}>
      <Button variant={gps ? 'primary' : 'ghost'} size="md" onClick={onGps} iconLeft="📍"
        style={gps ? { background: 'var(--gps-active)', color: '#fff' } : {}}>GPS</Button>
      <div style={{ flex: 1 }} />
      <IconButton label="Valikko" onClick={onMenu}>⋯</IconButton>
    </div>
  );
}

function SegmentView({ markers, onPick }) {
  const done = markers.filter(m => m.status !== 'suunniteltu').length;
  return (
    <div style={{
      background: 'var(--surface-app)', borderBottom: '1px solid var(--border-subtle)',
      padding: '8px 12px', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text-body)' }}>{SEGMENT.name}</span>
        <span style={{ fontSize: 'var(--text-meta)', color: 'var(--text-muted)' }}>{SEGMENT.range}</span>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-meta)', color: 'var(--confirm)', fontWeight: 700 }}>{done}/{markers.length}</span>
      </div>
      <div style={{ maxHeight: '128px', overflowY: 'auto', margin: '0 -12px' }}>
        {markers.map(m => (
          <MarkerListItem key={m.id} glyph={m.glyph} hue={m.hue} name={m.name} km={m.km} status={m.status}
            onClick={() => onPick(m)} style={{ padding: '8px 12px' }} />
        ))}
      </div>
    </div>
  );
}

function MapArea({ markers, onPick }) {
  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <MapBackdrop />
      {/* zoom control */}
      <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-sm)', overflow: 'hidden', boxShadow: 'var(--shadow-marker)' }}>
        <button style={zoomBtn}>+</button>
        <button style={{ ...zoomBtn, borderTop: '1px solid #ddd' }}>−</button>
      </div>
      {markers.map(m => (
        <div key={m.id} onClick={() => onPick(m)}
          style={{ position: 'absolute', left: `${m.x}%`, top: `${m.y}%`, transform: 'translate(-50%, -100%)', cursor: 'pointer' }}>
          <SignMarker type={m.type} glyph={m.glyph} status={m.status} bearing={m.bearing} size={0.85} />
        </div>
      ))}
      {/* own GPS position */}
      <div style={{ position: 'absolute', left: '44%', top: '40%', width: 16, height: 16, borderRadius: '50%', background: 'var(--gps-active)', border: '3px solid #fff', boxShadow: '0 0 0 6px rgba(29,78,216,0.2), var(--shadow-marker)', transform: 'translate(-50%,-50%)' }} />
    </div>
  );
}
const zoomBtn = { width: 36, height: 36, background: '#fff', border: 'none', color: '#333', fontSize: 18, cursor: 'pointer', fontWeight: 700 };

function RouteBar({ drive, near }) {
  return (
    <div style={{
      background: 'var(--surface-app)', color: 'var(--text-body)', padding: '8px 12px 10px',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)', boxShadow: 'var(--shadow-bar-up)', flexShrink: 0,
    }}>
      {drive ? (
        <DriveBanner distance={near ? '20 m' : '300 m'} label={near ? 'Olet perillä — Risteys oikealle' : 'Seuraava merkki · Nuoli vasemmalle'} direction={near ? '↓' : '→'} near={near} />
      ) : (
        <ProgressBar label="55 km" value={42} detail="2/5" />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <RouteTab label="55 km" color="var(--route-1)" active />
        <div style={{ flex: 1 }} />
        <IconButton label="Edellinen merkki" variant="solid">◀</IconButton>
        <IconButton label="Seuraava merkki" variant="solid">▶</IconButton>
      </div>
    </div>
  );
}

function CheckInModal({ marker, onClose, onConfirm }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'var(--overlay)', backdropFilter: 'var(--blur-overlay)' }} onClick={onClose}>
      <Card elevation="modal" padding="md" style={{ width: '100%', borderRadius: '14px 14px 0 0', display: 'flex', flexDirection: 'column', gap: '14px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SignMarker type={marker.type} glyph={marker.glyph} status={marker.status} size={0.8} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>{marker.name}</div>
            <div style={{ fontSize: 'var(--text-meta)', color: 'var(--text-meta)', marginTop: 2 }}>{marker.km} · 55-reitti</div>
          </div>
          <StatusBadge status={marker.status} />
        </div>
        <CheckInButton
          label={marker.status === 'asetettu' ? 'Merkitse kerätyksi' : 'Merkitse asetetuksi'}
          sub={marker.name}
          onConfirm={onConfirm}
          secondary={[
            { label: 'Ei tarpeen', variant: 'ghost', onClick: onClose },
            { label: 'Lisäsin toisen', variant: 'secondary', onClick: onClose },
          ]}
        />
      </Card>
    </div>
  );
}

function VolunteerApp() {
  const [markers, setMarkers] = useState(SEGMENT.markers);
  const [gps, setGps] = useState(false);
  const [modal, setModal] = useState(null);
  const drive = gps;

  const confirm = () => {
    setMarkers(ms => ms.map(m => m.id === modal.id ? { ...m, status: m.status === 'asetettu' ? 'keratty' : 'asetettu' } : m));
    setModal(null);
  };

  return (
    <div data-theme="dark" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', background: 'var(--surface-app)', fontFamily: 'var(--font-ui)' }}>
      <Toolbar gps={gps} onGps={() => setGps(g => !g)} onMenu={() => {}} />
      {!drive && <SegmentView markers={markers} onPick={setModal} />}
      <MapArea markers={markers} onPick={setModal} />
      <RouteBar drive={drive} near={false} />
      {modal && <CheckInModal marker={modal} onClose={() => setModal(null)} onConfirm={confirm} />}
    </div>
  );
}
window.VolunteerApp = VolunteerApp;
