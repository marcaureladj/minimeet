/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'minimeet-background': '#F8F9FA',
        'minimeet-surface': '#FFFFFF',
        'minimeet-primary': '#2563EB',
        'minimeet-primary-hover': '#1D4ED8',
        'minimeet-secondary-accent': '#8B5CF6',
        'minimeet-dark-panel': '#1F2937',
        'minimeet-dark-panel-text': '#F9FAFB',
        'minimeet-text-primary': '#111827',
        'minimeet-text-secondary': '#4B5563',
        'minimeet-text-muted': '#9CA3AF',
        'minimeet-text-on-dark': '#FFFFFF',
        'minimeet-border': '#E5E7EB',
        'minimeet-success': '#10B981',
        'minimeet-error': '#EF4444',
        'minimeet-warning': '#F59E0B',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      },
      animation: {
        'spin': 'spin 1s linear infinite',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
} 