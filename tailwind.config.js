/** @type {import('tailwindcss').Config} */
export default {
  content: ['./*.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Vibrant gradient colors
        vibrant: {
          pink: '#FF006E',
          purple: '#8338EC',
          blue: '#0096FF',
          green: '#00DC82',
          orange: '#FF8C00',
          yellow: '#FFD600',
        },
        // Dark mode colors
        dark: {
          bg: '#0A0A0B',
          surface: '#141416',
          elevated: '#1C1C1F',
          border: 'rgba(255, 255, 255, 0.08)',
        },
        // Legacy colors for compatibility
        brand: {
          blue: '#0070F3',
          purple: '#8B5CF6',
          teal: '#06B6D4',
          orange: '#F97316',
          white: '#FFFFFF',
        },
        gray: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        success: '#00DC82',
        warning: '#FF8C00',
        error: '#FF006E',
        info: '#0096FF',
      },
      backgroundImage: {
        // Gradient definitions
        'gradient-neon': 'linear-gradient(135deg, #FF006E, #8338EC, #3B82F6)',
        'gradient-cyber': 'linear-gradient(90deg, #F97316, #EC4899, #8B5CF6)',
        'gradient-ocean': 'linear-gradient(45deg, #06B6D4, #3B82F6, #8B5CF6)',
        'gradient-spectrum':
          'linear-gradient(180deg, #FF006E, #FF8C00, #FFD600, #00DC82, #0096FF, #8338EC)',
        'gradient-midnight': 'linear-gradient(to bottom, #0F172A, #1E293B, #312E81)',
        'gradient-radial-pink':
          'radial-gradient(circle at center, rgba(255, 0, 110, 0.3), transparent 70%)',
        'gradient-radial-blue':
          'radial-gradient(circle at center, rgba(0, 150, 255, 0.3), transparent 70%)',
      },
      boxShadow: {
        'glow-pink': '0 0 40px rgba(255, 0, 110, 0.5)',
        'glow-blue': '0 0 40px rgba(59, 130, 246, 0.5)',
        'glow-purple': '0 0 40px rgba(139, 92, 246, 0.5)',
        'glow-green': '0 0 40px rgba(0, 220, 130, 0.5)',
        'inner-glow': 'inset 0 0 20px rgba(255, 255, 255, 0.1)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.1)',
        'glass-hover': '0 12px 48px rgba(0, 0, 0, 0.15)',
      },
      backdropBlur: {
        xs: '4px',
        glass: '10px',
        heavy: '20px',
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['Menlo', 'Monaco', 'Consolas', 'Courier New', 'monospace'],
      },
      fontSize: {
        h1: ['36px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        h2: ['24px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        h3: ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.5' }],
        code: ['13px', { lineHeight: '1.4' }],
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        6: '24px',
        8: '32px',
        12: '48px',
        16: '64px',
        24: '96px',
        32: '128px',
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0, 0, 0, 0.1)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        turbo: '0 1px 3px rgba(0, 112, 243, 0.1)',
        'turbo-hover': '0 4px 6px -1px rgba(0, 112, 243, 0.15)',
      },
      transitionDuration: {
        fast: '200ms',
        default: '300ms',
      },
      transitionTimingFunction: {
        default: 'ease-in-out',
      },
      maxWidth: {
        container: '1280px',
      },
      animation: {
        'fade-in': 'fadeIn 300ms ease-out',
        'slide-up': 'slideUp 300ms ease-out',
        'gradient-shift': 'gradientShift 5s ease-in-out infinite',
        'hue-rotate': 'hueRotate 10s linear infinite',
        float: 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: {
            opacity: '0',
            transform: 'translateY(10px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        slideUp: {
          from: {
            transform: 'translateY(20px)',
            opacity: '0',
          },
          to: {
            transform: 'translateY(0)',
            opacity: '1',
          },
        },
        gradientShift: {
          '0%, 100%': {
            'background-position': '0% 50%',
          },
          '50%': {
            'background-position': '100% 50%',
          },
        },
        hueRotate: {
          '100%': {
            filter: 'hue-rotate(360deg)',
          },
        },
        float: {
          '0%, 100%': {
            transform: 'translateY(0)',
          },
          '50%': {
            transform: 'translateY(-20px)',
          },
        },
        pulseGlow: {
          '0%, 100%': {
            opacity: '1',
          },
          '50%': {
            opacity: '0.5',
          },
        },
        shimmer: {
          '100%': {
            transform: 'translateX(100%)',
          },
        },
        scaleIn: {
          from: {
            transform: 'scale(0.9)',
            opacity: '0',
          },
          to: {
            transform: 'scale(1)',
            opacity: '1',
          },
        },
        glowPulse: {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(255, 0, 110, 0.5)',
          },
          '50%': {
            boxShadow: '0 0 40px rgba(255, 0, 110, 0.8)',
          },
        },
      },
    },
  },
  plugins: [],
};
