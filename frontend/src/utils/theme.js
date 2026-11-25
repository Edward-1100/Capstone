export const THEMES = [
  {id: 'light', label: 'Light'},
  {id: 'dark', label: 'Dark'},
  {id: 'mynt', label: 'Mynt'},
  {id: 'blueprint', label: 'Blueprint'},
  {id: 'candy', label: 'Candy'},
  {id: 'cave', label: 'Cave'},
  {id: 'forest', label: 'Forest'},
  {id: 'notebook', label: 'Notebook'},
];

const STORAGE_KEY = 'theme';

export function getTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (THEMES.some((theme) => theme.id === saved)) {
      return saved;
    }
  } catch (error) {
    return 'dark';
  }

  return 'dark';
}

export function applyTheme(id) {
  for (const theme of THEMES) {
    document.body.classList.remove(theme.id);
  }

  if (id !== 'light') {
    document.body.classList.add(id);
  }

  if (id === 'candy') {
    document.body.classList.add('mynt');
  }
}

export function inkColor(alpha) {
  const raw = getComputedStyle(document.body).getPropertyValue('--text').trim();
  const hex = /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : '#f2f2f2';
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);

  return `rgba(${red},${green},${blue},${alpha})`;
}

export function saveTheme(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch (error) {
    return;
  }
}
