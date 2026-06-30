export function openFeatureColorPicker(
  anchor: HTMLElement,
  currentColor: string,
  onSelect: (color: string) => void,
): void {
  const input = document.createElement('input')
  input.type = 'color'
  input.value = currentColor
  input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:0;height:0'
  document.body.appendChild(input)

  input.addEventListener('input', () => {
    anchor.style.background = input.value
  })
  input.addEventListener('change', () => {
    onSelect(input.value)
    input.remove()
  })
  input.addEventListener('blur', () => input.remove())
  input.click()
}
