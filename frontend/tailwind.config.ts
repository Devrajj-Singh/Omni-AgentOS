import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-base': '#212121',
        'bg-surface': '#2A2A2A',
        'bg-raised': '#323232',
        'bg-overlay': '#3A3A3A',
        charcoal: '#1a1b1e',
        'border-subtle': '#2F2F2F',
        'border-default': '#3A3A3A',
        'border-strong': '#4A4A4A',
        'text-primary': '#ECECEC',
        'text-secondary': '#A0A0A0',
        'text-muted': '#6B6B6B',
        'text-disabled': '#4A4A4A',
        accent: '#10A37F',
        'accent-hover': '#1DB88E',
        'accent-subtle': 'rgba(16,163,127,0.12)',
        'accent-primary': '#10A37F',
        'accent-secondary': '#1DB88E',
        'accent-indigo': '#10A37F',
        'accent-violet': '#10A37F',
        'accent-purple': '#10A37F',
        'accent-blue': '#10A37F',
        'accent-cyan': '#10A37F',
        'accent-teal': '#10A37F',
        'status-green': '#34D399',
        'status-red': '#F87171',
        'status-yellow': '#FBBF24',
        slate: {
          700: '#4A4A4A',
          800: '#323232',
          900: '#2A2A2A',
          950: '#212121',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        panel: '12px',
        card: '8px',
        bubble: '12px',
        btn: '8px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,0.4)',
        panel: '0 4px 16px rgba(0,0,0,0.5)',
        input: '0 0 0 3px rgba(16,163,127,0.15)',
      },
    },
  },
  plugins: [],
}

export default config
