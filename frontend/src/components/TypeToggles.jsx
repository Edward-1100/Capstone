export default function TypeToggles({types, flag, onToggle, renderExtra, renderBelow}) {
  if (types.length === 0) {
    return <p className="muted">No entry types yet</p>;
  }

  return (
    <ul className="type-toggles">
      {types.map((type) => (
        <li key={type.id}>
          <div className="type-toggle-row">
            <label className="check">
              <input type="checkbox" checked={Boolean(type[flag])} onChange={(e) => onToggle(type.id, e.target.checked)}/>
              <span>{type.name}</span>
            </label>

            {renderExtra && renderExtra(type)}
          </div>

          {renderBelow && renderBelow(type)}
        </li>
      ))}
    </ul>
  );
}
