export const FEATURE_COLORS = [
  { label: 'Vihreä', value: '#4ade80' },
  { label: 'Sininen', value: '#93c5fd' },
  { label: 'Oranssi', value: '#fbbf24' },
  { label: 'Punainen', value: '#f87171' },
  { label: 'Violetti', value: '#c084fc' },
  { label: 'Turkoosi', value: '#6ee7b7' },
]

let activePickerEl: HTMLElement | null = null

function closePicker(): void {
  activePickerEl?.remove()
  activePickerEl = null
}

export function openFeatureColorPicker(
  anchor: HTMLElement,
  currentColor: string,
  onSelect: (color: string) => void,
): void {
  closePicker()

  const picker = document.createElement('div')
  picker.className = 'feature-color-picker'
  picker.style.cssText = [
    'position:fixed',
    'z-index:4000',
    'background:var(--surface-card)',
    'border:1px solid var(--border-default)',
    'border-radius:10px',
    'box-shadow:0 8px 24px rgba(0,0,0,0.4)',
    'padding:8px',
    'display:grid',
    'grid-template-columns:repeat(3,36px)',
    'gap:6px',
  ].join(';')

  for (const { label, value } of FEATURE_COLORS) {
    const btn = document.createElement('button')
    btn.title = label
    btn.setAttribute('aria-label', label)
    btn.style.cssText = [
      `background:${value}`,
      'width:36px',
      'height:36px',
      'border-radius:6px',
      'border:none',
      'cursor:pointer',
      `outline:${value === currentColor ? '2px solid var(--accent)' : 'none'}`,
      'outline-offset:2px',
      'transition:transform 0.1s',
    ].join(';')
    btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.12)' })
    btn.addEventListener('mouseleave', () => { btn.style.transform = '' })
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      onSelect(value)
      closePicker()
    })
    picker.appendChild(btn)
  }

  document.body.appendChild(picker)
  activePickerEl = picker

  // Position below/above anchor
  const rect = anchor.getBoundingClientRect()
  const pickerH = 36 * 2 + 6 + 16  // approx 2 rows + gaps + padding
  const below = rect.bottom + pickerH < window.innerHeight
  picker.style.left = `${Math.min(rect.left, window.innerWidth - 136)}px`
  picker.style.top = below
    ? `${rect.bottom + 4}px`
    : `${rect.top - pickerH - 4}px`

  // Close on outside click
  const onOutside = (e: MouseEvent) => {
    if (!picker.contains(e.target as Node)) {
      closePicker()
      document.removeEventListener('click', onOutside, true)
    }
  }
  setTimeout(() => document.addEventListener('click', onOutside, true), 0)
}
