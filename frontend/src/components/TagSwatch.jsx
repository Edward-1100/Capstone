export default function TagSwatch({color}) {
  if (!color) {
    return null;
  }

  return <span className="swatch" aria-hidden="true" style={{backgroundColor: color}}></span>;
}
