import fs from 'node:fs'
import path from 'node:path'

// Manually parse and assign .env.production.local BEFORE loading any application modules
const envPath = path.resolve(process.cwd(), '.env.production.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      process.env[key] = val
    }
  }
}

process.env.ALLOW_DEMO_SEED = 'true'

async function run() {
  console.log(
    'Running demo seed with database:',
    process.env.DATABASE_URL?.split('@')[1] || 'configured DB',
  )
  try {
    // Dynamic import ensures DB pool connects with the loaded DATABASE_URL
    const { seedShowcaseRelease } = await import('./seed-showcase-release')
    await seedShowcaseRelease(true)
    console.log('Demo showcase seed completed successfully!')
    process.exit(0)
  } catch (err) {
    console.error('Error seeding demo data:', err)
    process.exit(1)
  }
}

run()
