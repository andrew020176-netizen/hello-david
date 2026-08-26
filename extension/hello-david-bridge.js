(() => {
  const ROOT = document.documentElement;
  ROOT.dataset.helloDavidWooliesHelper = 'ready';
  window.dispatchEvent(new Event('hello-david-woolies-helper-ready'));

  function sendStatus(message) {
    ROOT.dataset.helloDavidWooliesStatus = message || '';
    window.dispatchEvent(new Event('hello-david-woolies-status'));
  }

  window.addEventListener('hello-david-send-to-woolies', () => {
    try {
      const raw = ROOT.dataset.helloDavidShop || '[]';
      const items = JSON.parse(raw);
      if (!Array.isArray(items) || !items.length) {
        sendStatus('There is nothing in the shop yet.');
        return;
      }

      sendStatus('Opening Woolies and building your cart…');
      chrome.runtime.sendMessage({ type: 'START_WOOLIES', items }, response => {
        if (chrome.runtime.lastError) {
          sendStatus('The Woolies helper could not start. Reload this page and try again.');
          return;
        }
        if (!response?.ok) sendStatus(response?.error || 'The Woolies helper could not start.');
      });
    } catch (error) {
      console.error('Hello David Woolies bridge failed', error);
      sendStatus('The Woolies helper could not read this shop.');
    }
  });
})();
