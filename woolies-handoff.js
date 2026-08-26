(() => {
  const actions = document.querySelector('.voice-first-actions');
  if (!actions) return;

  const OLIVE_LINK = 'https://woolworths.app.link/olive-services-page?icmpid=sm-july-olive-ce-multimedia-cards-1-tile-1%3Aadd-to-cart-wk-05';

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

  function buildPrompt(items) {
    const lines = items.map(item => {
      const qty = Number.isFinite(item.qty) && item.qty > 0 ? item.qty : 1;
      const unit = item.unit ? ` ${item.unit}` : '';
      return `- ${qty}${unit} ${item.name}`.replace(/\s+/g, ' ').trim();
    });

    return [
      'Please add the following groceries to my Woolworths cart.',
      'Use my usual product where that is obvious. Preserve the quantities and pack sizes exactly.',
      'If I have said cheapest or on special, choose a sensible value option. Do not check out.',
      '',
      ...lines
    ].join('\n');
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }

  btn.addEventListener('click', async () => {
    const items = currentItems();
    if (!items.length) {
      note.textContent = 'Add something to the shop first.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Opening Woolies…';

    try {
      const prompt = buildPrompt(items);
      await copyText(prompt);
      note.textContent = 'Your list is copied. In Olive, paste it and tap send — Olive can add the products to your Woolies cart.';

      setTimeout(() => {
        window.location.href = OLIVE_LINK;
      }, 350);
    } catch (error) {
      console.error('Woolies handoff failed', error);
      note.textContent = 'Could not copy the list. Try again.';
      btn.disabled = false;
      btn.textContent = 'Send to Woolies';
    }
  });
})();
