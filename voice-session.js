(() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = document.getElementById("micBtn");
  const input = document.getElementById("groceryInput");

  if (!micBtn || !SpeechRecognition) return;

  let sessionActive = false;
  let recognitionRunning = false;
  let restartTimer = null;

  const recognition = new SpeechRecognition();
  recognition.lang = "en-AU";
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;

  function showStatus(message) {
    const status = document.getElementById("speechStatus");
    if (status) status.textContent = message;
  }

  function updateButton() {
    micBtn.textContent = sessionActive ? "⏹ Stop listening" : "🎙 Speak";
    micBtn.setAttribute("aria-pressed", String(sessionActive));
  }

  function startRecognition() {
    if (!sessionActive || recognitionRunning) return;
    clearTimeout(restartTimer);
    try {
      recognition.start();
    } catch {
      restartTimer = setTimeout(startRecognition, 350);
    }
  }

  function startSession() {
    sessionActive = true;
    updateButton();
    showStatus("Listening continuously… walk around and talk. Tap Stop listening when you're done.");
    startRecognition();
  }

  function stopSession() {
    sessionActive = false;
    clearTimeout(restartTimer);
    updateButton();
    showStatus("Stopped listening. Your shop is saved on this device.");
    try {
      if (recognitionRunning) recognition.stop();
    } catch {}
  }

  // Capture the click before the prototype's original one-shot mic handler sees it.
  micBtn.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (sessionActive) stopSession();
    else startSession();
  }, true);

  recognition.onstart = () => {
    recognitionRunning = true;
    updateButton();
    showStatus("Listening continuously… pauses are fine.");
  };

  recognition.onresult = event => {
    let interim = "";
    const finals = [];

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.trim();
      if (!transcript) continue;
      if (event.results[i].isFinal) finals.push(transcript);
      else interim += (interim ? " " : "") + transcript;
    }

    if (interim && input) input.value = interim;

    finals.forEach(transcript => {
      if (input) input.value = transcript;
      showStatus(`Heard: “${transcript}” · still listening…`);
      if (typeof window.addText === "function") window.addText(transcript);
      else if (typeof addText === "function") addText(transcript);
    });

    if (sessionActive && !finals.length && interim) {
      showStatus(`Listening… “${interim}”`);
    }
  };

  recognition.onerror = event => {
    recognitionRunning = false;

    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      sessionActive = false;
      updateButton();
      showStatus("Microphone access is blocked. Allow microphone access in the browser, then try again.");
      return;
    }

    if (event.error === "audio-capture") {
      sessionActive = false;
      updateButton();
      showStatus("I can't access the microphone. Check your microphone and try again.");
      return;
    }

    // Chrome commonly reports no-speech when the user pauses. Keep the session alive.
    if (sessionActive) {
      showStatus("Still listening… take your time.");
    }
  };

  recognition.onend = () => {
    recognitionRunning = false;
    if (sessionActive) {
      showStatus("Still listening…");
      restartTimer = setTimeout(startRecognition, 250);
    } else {
      updateButton();
    }
  };

  window.addEventListener("beforeunload", () => {
    sessionActive = false;
    try { recognition.abort(); } catch {}
  });

  updateButton();
})();
