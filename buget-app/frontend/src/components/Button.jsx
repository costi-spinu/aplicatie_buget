export default function Button({
  children,
  variant = 'primary',
  fullWidth = false,
  style = {},
  ...props
}) {
  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)',
      color: 'white',
      boxShadow: '0 10px 25px rgba(10,132,255,0.3)',
    },
    subtle: {
      background: '#EEF2FF',
      color: '#0A84FF',
      boxShadow: 'none',
    },
    danger: {
      background: '#FF3B30',
      color: 'white',
      boxShadow: '0 10px 25px rgba(255,59,48,0.25)',
    },
  };

  return (
    <button
      {...props}
      style={{
        border: 'none',
        borderRadius: '16px',
        padding: '14px 16px',
        cursor: 'pointer',
        width: fullWidth ? '100%' : 'auto',
        fontSize: '16px',
        fontWeight: 600,
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}
