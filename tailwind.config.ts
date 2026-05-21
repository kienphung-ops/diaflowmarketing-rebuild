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
      },
      animation: {
        'onboarding-pop': 'onboarding-pop 240ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}

export default config
