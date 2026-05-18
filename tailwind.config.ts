import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Tower palette
        'night-deep': '#0a0e27',
        'night-mid': '#1a1a2e',
        'night-glow': '#2a2548',
        'tower-gold': '#fbbf24',
        'tower-cream': '#f5f0e6',
      },
    },
  },
  plugins: [],
}

export default config
