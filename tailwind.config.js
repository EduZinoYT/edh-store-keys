/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#e11d48',
        'primary-dark': '#9f1239',
        'primary-light': '#fb7185',
        surface: '#0f0f0f',
        'surface-2': '#1a1a1a',
        'surface-3': '#242424',
        'surface-4': '#2e2e2e',
        border: '#333333',
        'border-light': '#444444',
        muted: '#888888',
        foreground: '#f5f5f5',
        'foreground-muted': '#aaaaaa',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-red': 'pulseRed 2s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulseRed: { '0%,100%': { boxShadow: '0 0 0 0 rgba(225,29,72,0.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(225,29,72,0)' } },
      },
    },
  },
  plugins: [],
}
