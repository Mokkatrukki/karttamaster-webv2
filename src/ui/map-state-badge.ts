export type MapStatus = 'luonnos' | 'hyväksytty'

// Approval concept removed — all markers are always visible to all authenticated users.
// Stubs kept for interface compatibility.
export class MapStateBadge {
  constructor(_toolbar: HTMLElement, _role: string) {}
  async refresh(): Promise<void> {}
  update(_status: MapStatus): void {}
}

export function showMapNotReadyBanner(): void {}
