import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderAdminUsers, renderForbidden } from '../src/ui/admin-page'
import type { AdminUser, AdminPageCallbacks } from '../src/ui/admin-page'

function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'u1',
    username: 'testi-jarjestaja',
    role: 'järjestäjä',
    display_name: 'Testi Järjestäjä',
    created_at: '2026-07-01T10:00:00.000Z',
    is_active: 1,
    invite_token: null,
    ...overrides,
  }
}

function makeCallbacks(): AdminPageCallbacks {
  return {
    onToggleActive: vi.fn(),
    onInvite: vi.fn(),
    onCopyInvite: vi.fn(),
  }
}

describe('T122: AdminPage renderAdminUsers', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
  })

  test('renders table with a row per user', () => {
    const users = [makeUser({ id: 'u1' }), makeUser({ id: 'u2', username: 'toinen' })]
    renderAdminUsers(container, users, makeCallbacks())
    const rows = container.querySelectorAll('.admin-user-row')
    expect(rows.length).toBe(2)
    expect(container.textContent).toContain('Testi Järjestäjä')
    expect(container.textContent).toContain('toinen')
  })

  test('renders empty state when no users', () => {
    renderAdminUsers(container, [], makeCallbacks())
    expect(container.querySelector('.admin-users-empty')).toBeTruthy()
  })

  test('active user shows "Aktiivinen" status + "Deaktivoi" button', () => {
    renderAdminUsers(container, [makeUser({ is_active: 1 })], makeCallbacks())
    expect(container.querySelector('.admin-user-status.active')!.textContent).toBe('Aktiivinen')
    expect(container.querySelector('.admin-toggle-active-btn')!.textContent).toBe('Deaktivoi')
  })

  test('deactivated user shows "Deaktivoitu" status + "Aktivoi" button', () => {
    renderAdminUsers(container, [makeUser({ is_active: 0 })], makeCallbacks())
    expect(container.querySelector('.admin-user-status.inactive')!.textContent).toBe('Deaktivoitu')
    expect(container.querySelector('.admin-toggle-active-btn')!.textContent).toBe('Aktivoi')
  })

  test('clicking deactivate/activate button calls onToggleActive with the user', () => {
    const callbacks = makeCallbacks()
    const user = makeUser({ id: 'u1', is_active: 1 })
    renderAdminUsers(container, [user], callbacks)
    ;(container.querySelector('.admin-toggle-active-btn') as HTMLButtonElement).click()
    expect(callbacks.onToggleActive).toHaveBeenCalledWith(user)
  })

  test('clicking "Kutsu uusi järjestäjä" calls onInvite', () => {
    const callbacks = makeCallbacks()
    renderAdminUsers(container, [], callbacks)
    ;(container.querySelector('#btn-admin-invite') as HTMLButtonElement).click()
    expect(callbacks.onInvite).toHaveBeenCalledTimes(1)
  })

  test('copy-invite button only rendered when invite_token present', () => {
    const callbacks = makeCallbacks()
    renderAdminUsers(container, [makeUser({ invite_token: null })], callbacks)
    expect(container.querySelector('.admin-copy-invite-btn')).toBeFalsy()

    renderAdminUsers(container, [makeUser({ invite_token: 'tok-123' })], callbacks)
    const btn = container.querySelector('.admin-copy-invite-btn') as HTMLButtonElement
    expect(btn).toBeTruthy()
    btn.click()
    expect(callbacks.onCopyInvite).toHaveBeenCalledWith(expect.objectContaining({ invite_token: 'tok-123' }))
  })

  test('renderForbidden shows message and no table', () => {
    renderForbidden(container)
    expect(container.textContent).toContain('admin-käyttäjille')
    expect(container.querySelector('.admin-users-table')).toBeFalsy()
  })
})
