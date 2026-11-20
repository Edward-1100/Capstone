import { useState } from 'react';
import { listEntriesRequest } from '../api/entries';
import Typeahead from './Typeahead';

export default function EntryPicker({worldId, exclude = [], onPick, placeholder, label}) {
  const [entries, setEntries] = useState(null);

  function load() {
    if (entries !== null) {
      return;
    }

    setEntries([]);
    listEntriesRequest(worldId).then(setEntries).catch(() => setEntries([]));
  }

  const options = (entries || []).filter((entry) => !exclude.includes(entry.id)).map((entry) => ({id: entry.id, label: entry.name}));

  return <Typeahead options={options} onPick={onPick} placeholder={placeholder} label={label} showCount={false} onOpen={load}/>;
}
