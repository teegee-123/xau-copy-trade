/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#00ff00',
        'primary-dark': '#00cc00',
        'primary-light': '#33ff33',
        background: '#0a0a0a',
        'background-light': '#111111',
        'background-card': '#1a1a1a',
        'border-color': '#333333',
        'text-muted': '#888888',
        'success': '#00ff00',
        'warning': '#ffaa00',
        'error': '#ff4444',
        'info': '#00aaff',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
