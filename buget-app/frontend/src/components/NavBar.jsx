export default function NavBar({ onBack }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid #E5E5EA',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: '#0A84FF',
          fontSize: '17px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '28px', marginRight: '4px', lineHeight: 1 }}>‹</span>
        Înapoi
      </button>
    </div>
  );
}
