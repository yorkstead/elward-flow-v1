import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await auth())?.user) redirect('/sign-in')
  return children
}
