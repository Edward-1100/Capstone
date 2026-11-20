import { defaultSettings } from '../../utils/graph';
import OptionList from './OptionList';

function apply(list, ids, add) {
  const rest = list.filter((item) => !ids.includes(item));

  return add ? rest.concat(ids) : rest;
}

function Check({label, checked, onChange}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}/>
      {label}
    </label>
  );
}

export default function GraphControls({id, data, settings, onChange}) {
  const typeName = new Map(data.types.map((type) => [type.id, type.name]));
  const hasUntyped = data.nodes.some((node) => !node.typeId);

  const typeOptions = data.types.map((type) => ({id: type.id, label: type.name}));

  if (hasUntyped) {
    typeOptions.push({id: 'none', label: 'No type'});
  }

  const fieldOptions = data.fields.map((field) => ({id: field.id, label: `${field.name} (${typeName.get(field.typeId) || 'type'})`}));
  const colourOptions = [{id: 'type', label: 'Entry type'}, {id: 'tag', label: 'Tag'}].concat(fieldOptions.map((option) => ({id: `field:${option.id}`, label: option.label})), [{id: 'none', label: 'One colour'}]);
  const colour = colourOptions.find((option) => option.id === settings.colorBy);

  function set(patch) {
    onChange(Object.assign({}, settings, patch));
  }

  return (
    <aside id={id} className="graph-panel map-glass" aria-label="Graph settings">
      <div className="graph-panel-head">
        <h2>Graph settings</h2>
      </div>

      <div className="graph-panel-body">
        <section>
          <h3>Connect Entries By:</h3>

          <Check label="Entry type" checked={settings.groupTypes} onChange={(value) => set({groupTypes: value})}/>
          <Check label="Tags" checked={settings.groupTags} onChange={(value) => set({groupTags: value})}/>
          <Check label="Relationship type" checked={settings.groupRelationships} onChange={(value) => set({groupRelationships: value})}/>

          {fieldOptions.length > 0 && (
            <OptionList label="Custom fields" options={fieldOptions} isChecked={(optionId) => settings.groupFields.includes(optionId)} onChange={(ids, add) => set({groupFields: apply(settings.groupFields, ids, add)})}/>
          )}
        </section>

        <section>
          <h3>Colour by</h3>

          <OptionList label={colour ? colour.label : 'Entry type'} options={colourOptions} single isChecked={(optionId) => settings.colorBy === optionId} onChange={(ids) => set({colorBy: ids[0]})}/>
        </section>

        <section>
          <h3>Show</h3>

          <OptionList label="Entry types" options={typeOptions} isChecked={(optionId) => !settings.hiddenTypes.includes(optionId)} onChange={(ids, show) => set({hiddenTypes: apply(settings.hiddenTypes, ids, !show)})}/>

          <OptionList label="Relationship types" options={data.relationshipTypes.map((type) => ({id: type.id, label: type.name}))} isChecked={(optionId) => !settings.hiddenRelationships.includes(optionId)} onChange={(ids, show) => set({hiddenRelationships: apply(settings.hiddenRelationships, ids, !show)})}/>

          {data.tags.length > 0 && (
            <OptionList label="By tag" options={data.tags.map((tag) => ({id: tag.id, label: tag.name}))} isChecked={(optionId) => settings.onlyTags.includes(optionId)} onChange={(ids, add) => set({onlyTags: apply(settings.onlyTags, ids, add)})}/>
          )}

          <Check label="Hide entries with no relationships" checked={settings.hideUnconnected} onChange={(value) => set({hideUnconnected: value})}/>
          <Check label="Entry names" checked={settings.labels} onChange={(value) => set({labels: value})}/>
          <Check label="Group names" checked={settings.groupLabels} onChange={(value) => set({groupLabels: value})}/>
        </section>

        <button type="button" onClick={() => onChange(Object.assign(defaultSettings(), {panel: true}))}>Reset to defaults</button>

        <label className="graph-range">
          Pull strength
          <input type="range" min="0" max="1" step="0.05" value={settings.strength} onChange={(e) => set({strength: Number(e.target.value)})}/>
        </label>
      </div>
    </aside>
  );
}
