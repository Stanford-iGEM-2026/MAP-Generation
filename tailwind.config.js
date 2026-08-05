/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './node_modules/streamdown/dist/**/*.{js,mjs}',
  ],
  safelist: ['w-6', 'w-7', 'w-8', 'w-9', 'w-10', 'w-11', 'w-12'],
  theme: {
    extend: {
      screens: {
        desktop: '936px',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'monospace'],
        'dm-sans': ['DM Sans', 'sans-serif'],
        'kumbh-sans': ['Kumbh Sans', 'sans-serif'],
      },
      colors: {
        // Soft navy / sky palette — cute blues throughout the UI
        'adam-bg-dark': '#101A2C',
        'adam-background-light': '#EAF4FF',
        'adam-bg-secondary-dark': '#17243A',
        'adam-bg-light': '#DCEBFF',
        'adam-bg-secondary-light': '#E8F3FF',
        'adam-blue': '#7EC8FF',
        'adam-blue-dark': '#5BB4F5',
        'adam-text-primary': '#EAF4FF',
        'adam-text-secondary': '#9BB4D0',
        'adam-text-tertiary': '#6E8AA8',
        'secondary-tan': '#DCEBFF',
        'background-color': '#101A2C',
        'white-16%': 'rgba(126, 200, 255, 0.16)',
        'white-700': '#C5DBF2',
        'white-500': '#9BB4D0',
        'adam-background-1': '#17243A',
        'adam-background-2': '#101A2C',
        'adam-neutral-950': '#0B1424',
        'adam-neutral-900': '#121F35',
        'adam-neutral-800': '#1E304C',
        'adam-neutral-700': '#2A4060',
        'adam-neutral-500': '#4A6A8C',
        'adam-neutral-400': '#6E8AA8',
        'adam-neutral-300': '#9BB4D0',
        'adam-neutral-200': '#B4CDE6',
        'adam-neutral-100': '#C5DBF2',
        'adam-neutral-50': '#EAF4FF',
        'adam-neutral-10': '#F3F9FF',
        'adam-neutral-0': '#F8FBFF',
        pink: '#A8DCFF',
        'sidebar-color': '#17243A',
        'bg-gray': 'rgba(16, 26, 44, 1)',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'dot-bounce-1': {
          '0%, 80%, 100%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(-8px)' },
        },
        'dot-bounce-2': {
          '0%, 20%, 100%': { transform: 'translateY(0)' },
          '60%': { transform: 'translateY(-8px)' },
        },
        'dot-bounce-3': {
          '0%, 40%, 100%': { transform: 'translateY(0)' },
          '80%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'dot-bounce-1': 'dot-bounce-1 1.0s infinite ease-in-out',
        'dot-bounce-2': 'dot-bounce-2 1.0s infinite ease-in-out',
        'dot-bounce-3': 'dot-bounce-3 1.0s infinite ease-in-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
