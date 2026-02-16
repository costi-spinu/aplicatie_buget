export default function ScreenContainer({ children, centered = false, style = {} }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F2F2F7',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        padding: '20px',
        display: centered ? 'flex' : 'block',
        alignItems: centered ? 'center' : undefined,
        justifyContent: centered ? 'center' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
