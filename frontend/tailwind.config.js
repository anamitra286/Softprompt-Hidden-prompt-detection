/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#05070d',
          900: '#0a0f1a',
          850: '#0e1524',
          800: '#131c2e',
          700: '#1c2740',
        },
        neon: {
          DEFAULT: '#22d3ee',
          soft: '#67e8f9',
          lime: '#a3e635',
          warn: '#fbbf24',
          bad: '#f87171',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px -6px rgba(34, 211, 238, 0.45)',
      },
    },
  },
  plugins: [],
}
