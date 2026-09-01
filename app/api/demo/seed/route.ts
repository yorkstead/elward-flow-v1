import { NextResponse } from 'next/server'
import { seedShowcaseRelease } from '@/scripts/seed-showcase-release'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60s for full multi-release seeding

export async function POST() {
  try {
    process.env.ALLOW_DEMO_SEED = 'true'
    console.log('Initiating demo showcase seeding via API endpoint...')
    await seedShowcaseRelease(false)

    return NextResponse.json({
      success: true,
      message:
        'Demo database successfully seeded with 7 multi-job releases, panel marks, inventory items, QC holds, pallet plans, shipments, and 4 demo personas.',
      personas: [
        { name: 'Elena Vance', email: 'admin@ellwood.test', role: 'Operations Manager' },
        { name: 'Marcus Cole', email: 'cnc.lead@ellwood.test', role: 'Shop Floor & CNC Lead' },
        { name: 'Sarah Jenkins', email: 'qc.lead@ellwood.test', role: 'Quality Assurance Lead' },
        { name: 'David Ortiz', email: 'shipping.lead@ellwood.test', role: 'Logistics & Shipping' },
      ],
    })
  } catch (error) {
    console.error('Demo database seeding error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown seeding error',
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    description: 'Endpoint to seed/reset the demo database with showcase data.',
    method: 'POST',
  })
}
