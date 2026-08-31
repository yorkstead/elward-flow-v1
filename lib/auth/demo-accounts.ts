export interface DemoPersona {
  id: string
  name: string
  email: string
  role: string
  description: string
  icon: 'Shield' | 'Cpu' | 'CheckCircle2' | 'Truck'
}

export const DEMO_PASSWORD = 'DemoPassword2026!'

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: 'admin',
    name: 'Elena Vance',
    email: 'admin@ellwood.test',
    role: 'Operations Manager',
    description:
      'Full operational visibility, intake approval, releases, and settings',
    icon: 'Shield',
  },
  {
    id: 'cnc',
    name: 'Marcus Cole',
    email: 'cnc.lead@ellwood.test',
    role: 'Shop Floor & CNC Lead',
    description:
      'Station dispatch, CNC tables, capacity board, and machine downtime',
    icon: 'Cpu',
  },
  {
    id: 'qc',
    name: 'Sarah Jenkins',
    email: 'qc.lead@ellwood.test',
    role: 'Quality Assurance Lead',
    description:
      'Inspections, hold blocking, non-conformance logging, and remake orders',
    icon: 'CheckCircle2',
  },
  {
    id: 'shipping',
    name: 'David Ortiz',
    email: 'shipping.lead@ellwood.test',
    role: 'Logistics & Shipping',
    description:
      'Pallet planning, stacking limits, trailer loading, and dispatch',
    icon: 'Truck',
  },
]
