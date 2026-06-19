import { getRole, setRole } from '../logic/role'
import type { Role } from '../logic/role'

export class RoleSelector {
  private role: Role

  constructor(
    private readonly btn: HTMLButtonElement,
    private readonly onChange?: (role: Role) => void,
    lockedRole?: Role,
  ) {
    this.role = lockedRole ?? getRole()
    if (lockedRole !== undefined) {
      btn.hidden = true
      this.updateBtn()
      this.onChange?.(this.role)
      return
    }
    this.updateBtn()
    this.onChange?.(this.role)
    btn.addEventListener('click', () => {
      this.role = this.role === 'järjestäjä' ? 'talkoolainen' : 'järjestäjä'
      setRole(this.role)
      this.updateBtn()
      this.onChange?.(this.role)
    })
  }

  getRole(): Role { return this.role }

  private updateBtn(): void {
    this.btn.textContent = this.role === 'järjestäjä' ? 'Järjestäjä' : 'Talkoolainen'
    this.btn.dataset.role = this.role
    this.btn.classList.toggle('role-active', this.role === 'talkoolainen')
  }
}
