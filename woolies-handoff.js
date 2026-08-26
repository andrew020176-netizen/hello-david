(() => {
  const actions = document.querySelector('.voice-first-actions');
  if (!actions) return;

  const style = document.createElement('style');
  style.textContent = `
    .technical-only { display: none !important; }
    .voice-first-actions { align-items: center; }
    .voice-primary { padding: 14px 22px; font-weight: 700; }
    .woolies-btn { background: #0b7a35; color: #fff; border-color: #0b7a35; font-weight: 700; }
    .woolies-handoff-note { margin-top: 9px; font-size: 12px; color: var(--muted); line-height: 1.4; }
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'sendToWooliesBtn';
  btn.className = 'secondary-btn woolies-btn';
  btn.textContent = 'Send to Woolies';
  actions.appendChild(btn);

  const note = document.createElement('div');
  note.className = 'woolies-handoff-note';
  actions.parentElement?.appendChild(note);

  function currentItems() {
    return [...document.querySelectorAll('.item-row')].map(row => {
      const name = row.querySelector('.item-name')?.value?.trim() || '';
      const qty = Number(row.querySelector('.item-qty')?.value || 1);
      const meta = row.querySelector('.item-meta')?.textContent || '';
      const unit = meta.split('·')[0]?.trim() || '';
      return { name, qty, unit };
    }).filter(item => item.name);
  }

  function helperReady() {
    return document.documentElement.dataset.helloDavidWooliesHelper === 'ready';
  }

  function resetButton() {
    btn.disabled = false;
    btn.textContent = 'Send to Woolies';
  }

  window.addEventListener('hello-david-woolies-helper-ready', () => {
    note.textContent = '';
  });

  window.addEventListener('hello-david-woolies-status', () => {
    note.textContent = document.documentElement.dataset.helloDavidWooliesStatus || '';
    if (/could not|nothing/i.test(note.textContent)) resetButton();
  });

  btn.addEventListener('click', () => {
    const items = currentItems();
    if (!items.length) {
      note.textContent = 'Add something to the shop first.';
      return;
    }

    if (!helperReady()) {
      note.textContent = 'The desktop Woolies helper is not installed in this browser yet.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Building Woolies cart…';
    note.textContent = 'Opening Woolies and matching your products. No copying or pasting.';

    document.documentElement.dataset.helloDavidShop = JSON.stringify(items);
    window.dispatchEvent(new Event('hello-david-send-to-woolies'));

    setTimeout(resetButton, 6000);
  });
})();
