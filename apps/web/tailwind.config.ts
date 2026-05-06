import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      colors: {
        crimson: {
          DEFAULT: '#A50000',
          hover: '#C0392B',
          bg: '#FFF8F8',
        },
        dark: {
          900: '#0A0A0A',
          800: '#111111',
          700: '#1A1A1A',
          600: '#242424',
          500: '#2E2E2E',
        },
      },
    },
  },
  plugins: [],
  darkMode: ['class', '[data-theme="dark"]'],
}

export default config
