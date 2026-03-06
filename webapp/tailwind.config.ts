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
        'dark-bg': 'var(--bg-dark)',
        'neon-cyan': 'var(--neon-cyan)',
        'neon-pink': 'var(--neon-pink)',
        'neon-purple': 'var(--neon-purple)',
        'neon-green': 'var(--neon-green)',
        'neon-yellow': 'var(--neon-yellow)',
        'status-error': 'var(--status-error)',
        'status-warning': 'var(--status-warning)',
        'status-success': 'var(--status-success)',
        'status-info': 'var(--status-info)',
      }
    },
  },
  plugins: [],
}
export default config
