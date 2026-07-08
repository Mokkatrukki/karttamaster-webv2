/* global React */
// Map backdrop — a believable stand-in for the Leaflet/Maanmittauslaitos
// topographic map under the chrome. The real map is third-party; this is a
// stylised forest-topo backdrop with two GPX route loops, so the kit reads as
// the real product without shipping tiles.
function MapBackdrop({ style = {} }) {
  return (
    <svg
      viewBox="0 0 800 700"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', ...style }}
      aria-hidden="true"
    >
      <rect width="800" height="700" fill="#f4f1ea" />
      {/* water bodies */}
      <g fill="#cfe3ef">
        <ellipse cx="120" cy="540" rx="70" ry="34" />
        <ellipse cx="610" cy="610" rx="52" ry="26" />
        <ellipse cx="700" cy="250" rx="30" ry="44" />
        <path d="M40 180 q60 -30 120 10 q70 40 30 80 q-50 30 -110 0 q-60 -40 -40 -90 Z" opacity="0.7" />
      </g>
      {/* streams */}
      <g stroke="#bcd6e6" strokeWidth="2.5" fill="none" opacity="0.8">
        <path d="M0 230 q140 30 250 -10 q120 -40 260 10 q120 40 290 -20" />
        <path d="M150 700 q40 -120 -10 -230" />
      </g>
      {/* contour lines */}
      <g stroke="#d8cdb8" strokeWidth="1.2" fill="none" opacity="0.7">
        <path d="M250 120 q120 40 60 140 q-70 90 60 150 q120 50 40 160" />
        <path d="M330 150 q90 50 40 150 q-40 80 60 140" />
        <path d="M520 200 q80 60 20 160 q-40 90 70 150" />
      </g>
      {/* roads */}
      <g stroke="#cbb8a0" strokeWidth="3" fill="none" opacity="0.6">
        <path d="M0 120 q300 -40 800 60" />
        <path d="M620 0 q-40 350 120 700" />
        <path d="M0 470 q260 60 520 -10 q160 -40 280 30" />
      </g>
      {/* route 55km — violet loop */}
      <path
        d="M210 250 q-70 80 -30 180 q40 90 150 130 q140 50 250 -10 q120 -60 90 -180 q-30 -120 -180 -150 q-150 -30 -270 30 Z"
        fill="none" stroke="#7c3aed" strokeWidth="4.5" strokeLinejoin="round" opacity="0.92"
      />
      {/* route 35km — amber spur */}
      <path
        d="M360 360 q40 -90 150 -70 q90 18 110 90"
        fill="none" stroke="#f59e0b" strokeWidth="4.5" strokeLinecap="round" opacity="0.95"
      />
      {/* place labels */}
      <g fill="#6b7280" fontFamily="var(--font-ui)" fontSize="15" fontStyle="italic">
        <text x="430" y="120">Oksanperä</text>
        <text x="560" y="200">Syötekylä</text>
        <text x="430" y="560">Salmiperä</text>
        <text x="120" y="250">Lakisuo</text>
      </g>
    </svg>
  );
}
window.MapBackdrop = MapBackdrop;
