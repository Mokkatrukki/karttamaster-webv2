import fs from 'fs/promises'
import path from 'path'

export default async function globalSetup() {
  if (!process.env.SCREENSHOTS) return
  const dir = path.resolve('screenshots')
  await fs.rm(dir, { recursive: true, force: true })
  await fs.mkdir(dir, { recursive: true })
}
