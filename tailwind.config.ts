import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Tower palette — `tower-gold` was retired in favour of a
        // purple primary that matches the YOU marker + glow effects.
        // The class name is kept (`bg-tower-gold`, `text-tower-gold`,
        // etc.) so existing markup doesn't need a rename.
        'night-deep': '#0a0e27',
        'night-mid': '#1a1a2e',
        'night-glow': '#2a2548',
        'tower-gold': '#a855f7',
        'tower-cream': '#f5f0e6',
      },
      keyframes: {
        // Soft pop-in for onboarding modals — used by ModalShell so the
        // card feels like it lands on the character rather than
        // appearing instantly. Mirrors the "delay → character → modal"
        // sequence owned by TowerLanding.client.
        'onboarding-pop': {
          '0%':   { opacity: '0', transform: 'translateY(8px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0)   scale(1)' },
        },
        // Mia morph — emoji breathes inside its ring while the
        // specializing loader runs.
        'morph-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%':      { transform: 'scale(1.08)' },
        },
        // Mia morph — progress bar fills + resets so the user sees the
        // ~2s specializing beat as continuous motion.
        'morph-progress': {
          '0%':   { width: '5%' },
          '100%': { width: '92%' },
        },
        // Bottom-nav attention pulse — soft glow throb on the button
        // body. Used post-onboarding to draw the eye to the Tower slot.
        'nav-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(168, 117, 255, 0.55)' },
          '50%':      { boxShadow: '0 0 0 8px rgba(168, 117, 255, 0)' },
        },
        // Bottom-nav attention pulse — expanding ring overlay. Pairs
        // with `nav-pulse` for a stacked "tap me" cue.
        'nav-pulse-ring': {
          '0%':   { transform: 'scale(1)',    opacity: '0.9' },
          '100%': { transform: 'scale(1.35)', opacity: '0'   },
        },
        // Bouncing arrow above the Tower button — vertical bob so the
        // "Tap here" label + ↓ feel like they're physically pointing.
        'nav-arrow-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(6px)' },
        },
        // Spin-wheel credit increment cue — the balance text briefly
        // pops (scale + brighter glow) when the user's credit goes up.
        // Pairs with `credit-rise` (floating amount) to give the user
        // a clear "your balance went up by X" without a modal popup.
        'credit-bump': {
          '0%':   { transform: 'scale(1)',    textShadow: '0 0 0 rgba(168, 117, 255, 0)' },
          '30%':  { transform: 'scale(1.35)', textShadow: '0 0 18px rgba(168, 117, 255, 0.75)' },
          '100%': { transform: 'scale(1)',    textShadow: '0 0 0 rgba(168, 117, 255, 0)' },
        },
        // Floating "+$X" reward indicator — rises above the balance
        // row and fades out over 3 s. Game-style credit pop instead
        // of the old centred sparkle panel. Fade-in fast so the
        // number is readable, then drift up + fade slowly.
        'credit-rise': {
          '0%':   { opacity: '0', transform: 'translate(-50%, 6px)   scale(0.85)' },
          '15%':  { opacity: '1', transform: 'translate(-50%, -8px)  scale(1.08)' },
          '30%':  { opacity: '1', transform: 'translate(-50%, -22px) scale(1)' },
          '100%': { opacity: '0', transform: 'translate(-50%, -64px) scale(0.95)' },
        },
        // Continuous wheel spin during the API-roundtrip "free" phase.
        // Single 0→360° rotation per iteration with infinite repeat
        // keeps the browser's animation pipeline interpolating real
        // angles (not the short-path matrix decomposition you get when
        // a CSS transition sees `rotate(0)` and `rotate(43200deg)` as
        // identical matrices and barely moves). The wheel takes the
        // explicit angle interpolation between keyframes, so it
        // visually rotates at a smooth 2 turns / sec.
        'wheel-freespin': {
          'from': { transform: 'rotate(0deg)' },
          'to':   { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'onboarding-pop':     'onboarding-pop 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        'morph-pulse':        'morph-pulse 1.4s ease-in-out infinite',
        'morph-progress':     'morph-progress 2s ease-out infinite',
        'nav-pulse':          'nav-pulse 1.6s ease-in-out infinite',
        'nav-pulse-ring':     'nav-pulse-ring 1.6s ease-out infinite',
        'nav-arrow-bounce':   'nav-arrow-bounce 1s ease-in-out infinite',
        'credit-bump':        'credit-bump 900ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'credit-rise':        'credit-rise 3000ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards',
        'wheel-freespin':     'wheel-freespin 500ms linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
