export default function FixToText({
  text,
  maxWidth = '100%',
  fontSize = '16px',
  weight = 500,
  color = '#111827',
  align = 'left',
}) {
  return (
    <span
      title={text}
      style={{
        display: 'block',
        maxWidth,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        fontSize,
        fontWeight: weight,
        color,
        textAlign: align,
      }}
    >
      {text}
    </span>
  );
}
