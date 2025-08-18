/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // New redesign color tokens
        navy: '#1F3380',
        'navy-30': 'rgba(31, 51, 128, 0.30)',
        orange: '#FF6A00',
        text: '#0F172A',
        muted: '#64748B',
        stroke: '#E9EDF3',
        bg: '#FFFFFF',
        page: '#F8FAFC',
        
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        brand: {
          blue: '#1E3A8A',
          blue50: '#EAF0FF',
          orange: '#FF7A00',
        },
        ui: {
          bg: '#F6F7FB',
          card: '#FFFFFF',
          cardAlt: '#F2F4F7',
          border: '#E5E7EB',
          text: '#0F172A',
          textSub: '#475569',
          tick: '#CBD5E1',
        },
        // Enhanced contrast colors
        contrast: {
          'light-bg': '#ffffff',
          'light-text': '#0f172a',
          'light-text-muted': '#475569',
          'dark-bg': '#1e293b',
          'dark-text': '#ffffff',
          'dark-text-muted': '#cbd5e1',
        },
      },
      fontFamily: {
        sans: ['Inter', 'DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s infinite',
        // New redesign animations
        'hairline-reveal': 'hairlineReveal 0.18s ease-out',
        'count-up': 'countUp 0.6s ease-out',
        'tick-stagger': 'tickStagger 0.24s ease-out',
        'chart-reveal': 'chartReveal 0.24s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        // New redesign keyframes
        hairlineReveal: {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        tickStagger: {
          '0%': { opacity: '0', transform: 'scaleY(0)' },
          '100%': { opacity: '1', transform: 'scaleY(1)' },
        },
        chartReveal: {
          '0%': { clipPath: 'inset(0 100% 0 0)' },
          '100%': { clipPath: 'inset(0 0% 0 0)' },
        },
      },
      // Enhanced text color utilities for better contrast
      textColor: {
        'auto-light': 'var(--text-on-light)',
        'auto-dark': 'var(--text-on-dark)',
        'auto-muted-light': 'var(--text-muted-on-light)',
        'auto-muted-dark': 'var(--text-muted-on-dark)',
      },
      boxShadow: {
        'soft': '0 2px 15px 0 rgba(0, 0, 0, 0.1)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [],
  // Add safelist for dynamic classes
  safelist: [
    'text-contrast-light',
    'text-contrast-dark',
    'text-contrast-muted-light',
    'text-contrast-muted-dark',
    'text-on-light',
    'text-on-dark',
    'text-muted-on-light',
    'text-muted-on-dark',
    'bg-light',
    'bg-light-alt',
    'bg-dark',
    'bg-dark-alt',
  ],
}; 