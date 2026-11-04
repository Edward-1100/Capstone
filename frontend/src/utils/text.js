export function countLabel(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}
