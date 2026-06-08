export type Role = 'admin' | 'järjestäjä' | 'talkoolainen'

export interface SessionData {
  id: string
  user_id: string | null
  talkoolainen_code: string | null
  role: Role
  display_name: string | null
  expires_at: string
}

export interface User {
  id: string
  username: string
  password_hash: string
  role: Role
  invite_token: string | null
  display_name: string | null
  created_at: string
}
