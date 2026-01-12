import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        '3xl': '2560px',
      },
      gridTemplateColumns: {
        '8': 'repeat(8, minmax(0, 1fr))',
      },
      colors: {
        'dark-bg': '#0a0a1e',
        'neon-cyan': '#00ffff',
        'neon-pink': '#ff10f0',
        'neon-purple': '#b537f2',
        'neon-green': '#39ff14',
        'neon-yellow': '#ffff00',
      }
    },
  },
  plugins: [],
}
export default config
