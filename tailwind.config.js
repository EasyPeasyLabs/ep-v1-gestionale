/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--theme-50)',
          100: 'var(--theme-100)',
          200: 'var(--theme-200)',
          300: 'var(--theme-300)',
          400: 'var(--theme-400)',
          500: 'var(--theme-500)',
          600: 'var(--theme-600)',
          700: 'var(--theme-700)',
          800: 'var(--theme-800)',
          900: 'var(--theme-900)',
          DEFAULT: 'var(--md-primary)',
        },
        'bg-light': 'var(--md-bg-light)',
        gray: { 50: '#F6F8FA', 100: '#F3F4F6', 200: '#E5E7EB', 300: '#D1D5DB', 400: '#9CA3AF', 500: '#6B7280', 600: '#4B5563', 700: '#374151', 800: '#1F2937', 900: '#111827' },
        indigo: { 
          50: '#F2F2F5', 
          100: '#E6E6EA', 
          200: '#CDCDD6',
          300: '#B1B1BF',
          400: '#8E8E9F',
          500: '#3C3C52', 
          600: '#323244', 
          700: '#282836',
          800: '#1E1E29',
          900: '#14141B'
        },
        'ep-blue': {
          50: '#F2F2F5',
          100: '#E6E6EA',
          200: '#CDCDD6',
          300: '#B1B1BF',
          400: '#8E8E9F',
          500: '#3C3C52',
          600: '#323244',
          700: '#282836',
          800: '#1E1E29',
          900: '#14141B'
        },
        amber: { 50: '#FFFAEB', 100: '#FEF3C7', 400: '#FFBF00', 500: '#F59E0B' },
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      animation: { 'neon-pulse': 'neon-pulse 2s infinite' },
      keyframes: { 'neon-pulse': { '0%, 100%': { boxShadow: 'inset 0 0 0 4px #FACC15' }, '50%': { boxShadow: 'inset 0 0 15px 4px #CCFF00' } } }
    }
  }
}
