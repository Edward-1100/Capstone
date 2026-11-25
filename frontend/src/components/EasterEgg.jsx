import { useEffect, useState } from 'react';

const STORAGE_KEY = 'egg';
const SHOW = 'stay strong';
const HIDE = ['dissonance', 'rupture'];

function readActive() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on';
  } catch (error) {
    return false;
  }
}

function writeActive(on) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch (error) {
    return;
  }
}

function isMynt() {
  return document.body.classList.contains('mynt') && !document.body.classList.contains('candy');
}

export default function EasterEgg() {
  const [active, setActive] = useState(readActive);
  const [mynt, setMynt] = useState(isMynt);

  useEffect(() => {
    let typed = '';

    function handleKey(event) {
      const target = event.target;
      const tag = target && target.tagName ? target.tagName.toLowerCase() : '';

      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) {
        return;
      }

      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (target && target.isContentEditable)) {
        typed = '';

        return;
      }

      typed = (typed + event.key.toLowerCase()).slice(-20);

      if (HIDE.some((word) => typed.endsWith(word))) {
        writeActive(false);
        setActive(false);
        typed = '';
      } else if (typed.endsWith(SHOW) && isMynt()) {
        writeActive(true);
        setActive(true);
        typed = '';
      }
    }

    document.addEventListener('keydown', handleKey);

    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    const watcher = new MutationObserver(() => setMynt(isMynt()));

    watcher.observe(document.body, {attributes: true, attributeFilter: ['class']});

    return () => watcher.disconnect();
  }, []);

  if (!active || !mynt) {
    return null;
  }

  return <img className="egg" src="/stay-strong.gif" alt=""/>;
}
