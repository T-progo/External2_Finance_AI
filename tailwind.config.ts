import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f7ff',
          100: '#bae7ff',
          200: '#91d5ff',
          300: '#69c0ff',
          400: '#40a9ff',
          500: '#1890ff', // Base azul
          600: '#096dd9',
          700: '#0050b3',
          800: '#003a8c',
          900: '#002766',
        },
        admin: {
          DEFAULT: '#0050b3', // Azul oscuro Admin
          light: '#40a9ff',
        },
        asesor: {
          DEFAULT: '#52c41a', // Verde Asesor
          light: '#95de64',
        },
        cliente: {
          DEFAULT: '#13c2c2', // Celeste Cliente
          light: '#5cdbd3',
        },
        success: '#52c41a',
        warning: '#faad14',
        error: '#f5222d',
        info: '#1890ff',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
