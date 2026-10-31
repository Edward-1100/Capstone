export default function TagSwatch({color}) {
  if (!color) {
    return null;
  }

  return <span aria-hidden="true" style={{display: 'inline-block', width: '0.8em', height: '0.8em', background: color}}></span>;
}
