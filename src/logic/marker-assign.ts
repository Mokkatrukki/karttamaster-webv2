export const FAR_FROM_ROUTE_M = 500

export function ensureRouteIds(routeIds: string[], fallbackId: string): string[] {
  return routeIds.length > 0 ? routeIds : [fallbackId]
}
