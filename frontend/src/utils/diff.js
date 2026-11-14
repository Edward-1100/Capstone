const MAX_CELLS = 4000000;

function tokenize(text) {
  return String(text).match(/\s+|[^\s]+/g) || [];
}

function isSpace(token) {
  return /^\s/.test(token);
}

function prefixLength(first, second) {
  let count = 0;

  while (count < first.length && count < second.length && first[count] === second[count]) {
    count += 1;
  }

  return count;
}

function suffixLength(first, second) {
  let count = 0;

  while (count < first.length && count < second.length && first[first.length - 1 - count] === second[second.length - 1 - count]) {
    count += 1;
  }

  return count;
}

function lcsKept(first, second) {
  const rows = first.length + 1;
  const cols = second.length + 1;
  const table = new Uint32Array(rows * cols);

  for (let i = first.length - 1; i >= 0; i -= 1) {
    for (let j = second.length - 1; j >= 0; j -= 1) {
      table[i * cols + j] = first[i] === second[j] ? table[(i + 1) * cols + j + 1] + 1 : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
    }
  }

  const keptFirst = new Array(first.length).fill(false);
  const keptSecond = new Array(second.length).fill(false);
  let i = 0;
  let j = 0;

  while (i < first.length && j < second.length) {
    if (first[i] === second[j]) {
      keptFirst[i] = true;
      keptSecond[j] = true;
      i += 1;
      j += 1;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return {keptFirst, keptSecond};
}

function neighborChanged(tokens, kept, from, step) {
  let index = from + step;

  while (index >= 0 && index < tokens.length && isSpace(tokens[index])) {
    index += step;
  }

  return index >= 0 && index < tokens.length && !kept[index];
}

function toParts(tokens, kept) {
  const parts = [];

  tokens.forEach((token, index) => {
    const changed = isSpace(token) ? !kept[index] && neighborChanged(tokens, kept, index, -1) && neighborChanged(tokens, kept, index, 1) : !kept[index];
    const last = parts[parts.length - 1];

    if (last && last.changed === changed) {
      last.text += token;
    } else {
      parts.push({text: token, changed});
    }
  });

  return parts;
}

export function diffWords(first, second) {
  const left = tokenize(first);
  const right = tokenize(second);
  const start = prefixLength(left, right);
  const leftRest = left.slice(start);
  const rightRest = right.slice(start);
  const end = suffixLength(leftRest, rightRest);
  const leftMiddle = leftRest.slice(0, leftRest.length - end);
  const rightMiddle = rightRest.slice(0, rightRest.length - end);
  const keptLeft = new Array(left.length).fill(false);
  const keptRight = new Array(right.length).fill(false);

  for (let index = 0; index < start; index += 1) {
    keptLeft[index] = true;
    keptRight[index] = true;
  }

  for (let index = 0; index < end; index += 1) {
    keptLeft[left.length - 1 - index] = true;
    keptRight[right.length - 1 - index] = true;
  }

  if (leftMiddle.length > 0 && rightMiddle.length > 0 && leftMiddle.length * rightMiddle.length <= MAX_CELLS) {
    const result = lcsKept(leftMiddle, rightMiddle);

    result.keptFirst.forEach((value, index) => {
      keptLeft[start + index] = value;
    });

    result.keptSecond.forEach((value, index) => {
      keptRight[start + index] = value;
    });
  }

  return {left: toParts(left, keptLeft), right: toParts(right, keptRight)};
}
