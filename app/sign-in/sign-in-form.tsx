import { AuthError } from 'next-auth'
import { redirect, unstable_rethrow } from 'next/navigation'
import { signIn } from '@/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SignInForm({
  invalidCredentials,
}: {
  invalidCredentials: boolean
}) {
  async function authenticate(formData: FormData) {
    'use server'
    try {
      await signIn('credentials', {
        ...Object.fromEntries(formData),
        redirectTo: '/dashboard',
      })
    } catch (error) {
      if (error instanceof AuthError) redirect('/sign-in?error=credentials')
      unstable_rethrow(error)
    }
  }

  return (
    <form action={authenticate} className="mt-8 space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={12}
          required
        />
      </div>
      {invalidCredentials ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          Email or password is incorrect.
        </p>
      ) : null}
      <Button type="submit" className="min-h-12 w-full">
        Sign in
      </Button>
    </form>
  )
}
