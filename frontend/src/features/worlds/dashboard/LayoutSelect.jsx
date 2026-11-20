const LAYOUTS = [
  {value: 'image', label: 'Image'},
  {value: 'text', label: 'Small image'},
  {value: 'side', label: 'Side by side'},
  {value: 'plain', label: 'Text only'},
  {value: 'title', label: 'Title only'},
];

export default function LayoutSelect({kind, value, onChange}) {
  return (
    <label className="spot-layout">
      Layout
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {LAYOUTS.map((item) => <option key={item.value} value={item.value}>{item.value === 'plain' && kind === 'pinned' ? 'Notes only' : item.label}</option>)}
      </select>
    </label>
  );
}
