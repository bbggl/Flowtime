/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'light-bg': '#FAFAFE',
        'dark-bg': '#0F172A',
        'light-card': '#FFFFFF',
        'dark-card': '#1E293B',
        'light-text': '#1E1B4B',
        'dark-text': '#F1F5F9',
        'light-text-secondary': '#7C7AA8',
        'dark-text-secondary': '#94A3B8',
        'primary': '#8B5CF6',
        'primary-dark': '#A78BFA',
        'accent': '#F59E0B',
        'accent-dark': '#FBBF24',
        'light-border': '#E4E2F4',
        'dark-border': '#334155',
      },
    },
  },
  plugins: [],
}
