// Zentro Gaming Theme Configuration

export const THEME = {
  colors: {
    primary: '#FF6A00',      // Deep orange
    background: '#0B0B0C',   // Rich black
    text: '#EDEDED',         // Off-white  
    gray: '#1A1A1D',         // Subtle gray
  },
  
  gradients: {
    primary: 'linear-gradient(135deg, #FF6A00, #FF7F1A)',
    surface: 'linear-gradient(180deg, #1A1A1D, #0F0F10)',
    glow: 'radial-gradient(circle, rgba(255, 106, 0, 0.15), transparent)',
  },
  
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem', 
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
  },
  
  borderRadius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
  },
  
  breakpoints: {
    sm: '640px',
    md: '768px', 
    lg: '1024px',
    xl: '1280px',
  }
} as const;

export const ANIMATIONS = {
  duration: {
    fast: '0.2s',
    normal: '0.3s', 
    slow: '0.4s',
  },
  
  easing: {
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  }
} as const;