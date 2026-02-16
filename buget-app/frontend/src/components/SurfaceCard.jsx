export default function SurfaceCard({ children, style = {} }) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: '22px',
        padding: '20px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
