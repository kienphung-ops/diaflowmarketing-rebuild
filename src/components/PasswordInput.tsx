'use client'

/**
 * Reusable password input with a built-in show / hide toggle.
 *
 * Drop-in replacement for the bare `<input type="password" />` used
 * across login, signup, the in-page SignupModal, and reset-password
 * — eye-icon button on the right toggles between `type="password"`
 * and `type="text"` so users can verify what they're typing without
 * having to paste it elsewhere.
 *
 * Defaults to the same Tailwind chrome the existing forms use
 * (`bg-night-deep`, `border-white/10`, etc.). Override via
 * `className` if a caller needs a different look.
 */

import { useState, type ComponentPropsWithoutRef } from 'react'

// Inherit native input props (autoComplete, minLength, required,
// autoFocus, placeholder, name, …) except `type` — we control it.
type InputProps = Omit<ComponentPropsWithoutRef<'input'>, 'type'>

interface Props extends InputProps {
  /** Optional override for the input's class list. Defaults to the
   *  same chrome the auth forms already use. The right padding is
   *  added regardless so the toggle button has room. */
  className?: string
}

const DEFAULT_CLASSES =
  'w-full px-3 py-2 rounded-md bg-night-deep border border-white/10 focus:border-tower-gold focus:outline-none text-sm'

export function PasswordInput({ className, ...rest }: Props) {
  const [visible, setVisible] = useState(false)
  // Always reserve room on the right for the toggle button regardless
  // of the override className — otherwise long passwords would slide
  // under the eye icon.
  const inputClassName = `${className ?? DEFAULT_CLASSES} pr-10`
  return (
    <div className="relative">
      <input
        {...rest}
        type={visible ? 'text' : 'password'}
        className={inputClassName}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        // `tabIndex={-1}` keeps the toggle out of the natural tab
        // order so Tab moves from the password field to the submit
        // button, not into this eye icon.
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-tower-cream/55 hover:text-tower-cream hover:bg-white/5 transition"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

/** Outline eye — shown when the password is hidden. */
function EyeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/** Eye with a slash — shown when the password is visible. */
function EyeOffIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.77 19.77 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.77 19.77 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
