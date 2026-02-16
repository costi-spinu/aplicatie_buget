export default function Separator({ margin = '24px 0', color = '#E5E5EA' }) {
  return (
    <div
      style={{
        height: '1px',
        width: '100%',
        background: color,
        margin,
      }}
    />
  );
}
