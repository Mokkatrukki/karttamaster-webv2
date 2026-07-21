import './style.css'
import { AuthScreen } from './ui/auth-screen'
import { renderInventory, renderForbidden } from './ui/inventory-page'
import type { InventoryItem } from './logic/inventory'

const content = document.getElementById('inventory-content')!
const logoutBtn = document.getElementById('btn-inventory-logout')!

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/'
})

async function load(): Promise<void> {
  const res = await fetch('/api/inventory')
  if (!res.ok) {
    renderForbidden(content)
    return
  }
  const items = (await res.json()) as InventoryItem[]
  renderInventory(content, items, {
    onAdd: async (fields) => {
      const r = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (r.ok) await load()
      return r.ok
    },
    onEdit: async (id, fields) => {
      const r = await fetch(`/api/inventory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (r.ok) await load()
      return r.ok
    },
    onDelete: async (item) => {
      if (!window.confirm(`Poista "${item.name}"?`)) return
      const r = await fetch(`/api/inventory/${item.id}`, { method: 'DELETE' })
      if (r.ok) await load()
    },
  })
}

const auth = new AuthScreen((result) => {
  // AuthResult.role tyypitetty client-Roleksi (järjestäjä|talkoolainen); runtime voi olla 'admin'.
  const role = result.role as string
  if (role !== 'admin' && role !== 'järjestäjä') {
    renderForbidden(content) // V163: talkoolainen ei näe inventaariota
    return
  }
  void load()
})
void auth.start()
