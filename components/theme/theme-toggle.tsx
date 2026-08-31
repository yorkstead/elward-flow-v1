'use client'

import * as React from 'react'
import { Sun, Moon, Laptop, Check } from 'lucide-react'
import { useTheme, type Theme } from './theme-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  className?: string
  align?: 'start' | 'center' | 'end'
  variant?: 'default' | 'ghost' | 'outline'
  showLabel?: boolean
}

const emptySubscribe = () => () => {}

function useIsMounted() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}

export function ThemeToggle({
  className,
  align = 'end',
  variant = 'ghost',
  showLabel = false,
}: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const mounted = useIsMounted()

  const currentIcon = !mounted ? (
    <Laptop className="h-4 w-4 shrink-0" />
  ) : theme === 'system' ? (
    <Laptop className="h-4 w-4 shrink-0 text-amber-400" />
  ) : resolvedTheme === 'dark' ? (
    <Moon className="h-4 w-4 shrink-0 text-sky-400" />
  ) : (
    <Sun className="h-4 w-4 shrink-0 text-amber-500" />
  )

  const themeLabel = !mounted
    ? 'Theme'
    : theme === 'system'
      ? `System (${resolvedTheme})`
      : theme === 'dark'
        ? 'Dark'
        : 'Light'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={variant}
            size={showLabel ? 'default' : 'icon'}
            className={cn(
              'relative h-9 rounded-md transition-colors',
              showLabel ? 'gap-2 px-3' : 'w-9',
              className,
            )}
            aria-label={`Select theme, current: ${themeLabel}`}
            title={`Select theme, current: ${themeLabel}`}
          >
            {currentIcon}
            {showLabel && (
              <span className="text-xs font-medium">{themeLabel}</span>
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        }
      />
      <DropdownMenuContent align={align} className="min-w-36">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className={cn(
            'flex cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-xs',
            theme === 'light' && 'text-brand-blue font-semibold',
          )}
        >
          <div className="flex items-center gap-2">
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            <span>Light</span>
          </div>
          {theme === 'light' && <Check className="h-3.5 w-3.5" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className={cn(
            'flex cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-xs',
            theme === 'dark' && 'text-brand-blue font-semibold',
          )}
        >
          <div className="flex items-center gap-2">
            <Moon className="h-3.5 w-3.5 text-sky-400" />
            <span>Dark</span>
          </div>
          {theme === 'dark' && <Check className="h-3.5 w-3.5" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className={cn(
            'flex cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-xs',
            theme === 'system' && 'text-brand-blue font-semibold',
          )}
        >
          <div className="flex items-center gap-2">
            <Laptop className="h-3.5 w-3.5 text-slate-400" />
            <span>System</span>
          </div>
          {theme === 'system' && <Check className="h-3.5 w-3.5" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ThemeSegmentedControl({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const mounted = useIsMounted()

  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: <Sun className="h-3.5 w-3.5" />,
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: <Moon className="h-3.5 w-3.5" />,
    },
    {
      value: 'system',
      label: 'System',
      icon: <Laptop className="h-3.5 w-3.5" />,
    },
  ]

  return (
    <div
      role="radiogroup"
      aria-label="Theme preference"
      className={cn(
        'bg-muted text-muted-foreground inline-flex items-center rounded-lg p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const isSelected = mounted
          ? theme === option.value
          : option.value === 'system'
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => setTheme(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all select-none',
              isSelected
                ? 'bg-card text-foreground shadow-xs'
                : 'hover:text-foreground text-muted-foreground',
            )}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
