export function countLabel(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

export function editorsLabel(editors) {
  const names = editors.map((editor) => editor.username);

  if (names.length === 1) {
    return `${names[0]} is editing this entry`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are editing this entry`;
  }

  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]} are editing this entry`;
}
