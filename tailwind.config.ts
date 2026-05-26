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
      },
      animation: {
        'onboarding-pop':     'onboarding-pop 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        'morph-pulse':        'morph-pulse 1.4s ease-in-out infinite',
        'morph-progress':     'morph-progress 2s ease-out infinite',
        'nav-pulse':          'nav-pulse 1.6s ease-in-out infinite',
        'nav-pulse-ring':     'nav-pulse-ring 1.6s ease-out infinite',
        'nav-arrow-bounce':   'nav-arrow-bounce 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
