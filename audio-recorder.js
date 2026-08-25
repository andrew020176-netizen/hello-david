(() => {
  const ENDPOINT = "https://oobquipkeobfnotyynjr.supabase.co/functions/v1/hello-david-process-audio";
  const micBtn = document.getElementById("micBtn");
  const input = document.getElementById("groceryInput");
  const status = document.getElementById("speechStatus");

  if (!micBtn) return;

  let stream = null;
  let recorder = null;
  let chunks = [];
  let recording = false;
  let startedAt = 0;
  let timer = null;

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function setButton(label, disabled = false) {
    micBtn.textContent = label;
    micBtn.disabled = disabled;
    micBtn.setAttribute("aria-pressed", String(recording));
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  function updateRecordingStatus() {
    if (!recording) return;
    const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    setStatus(`Recording ${formatTime(seconds)} — walk around and talk normally. Tap Stop when you're finished.`);
  }

  function preferredMimeType() {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4"
    ];
    return candidates.find(type => window.MediaRecorder?.isTypeSupported?.(type)) || "";
  }

  function extensionFor(type) {
    if (type.includes("ogg")) return "ogg";
    if (type.includes("mp4")) return "m4a";
    return "webm";
  }

  function currentShop() {
    return [...document.querySelectorAll(".item-row")].map(row => ({
      name: row.querySelector(".item-name")?.value || "",
      quantity: Number(row.querySelector(".item-qty")?.value || 1),
      detail: row.querySelector(".item-meta")?.textContent || ""
    })).filter(item => item.name);
  }

  function applyActions(actions) {
    let changed = false;

    for (const name of actions?.remove || []) {
      if (typeof window.removeByName === "function") {
        changed = window.removeByName(String(name).toLowerCase().trim()) || changed;
      }
    }

    for (const item of actions?.add || []) {
      const name = String(item?.name || "").trim();
      if (!name || typeof window.addOrMerge !== "function") continue;
      window.addOrMerge({
        name,
        qty: Number(item?.quantity) || 1,
        unit: item?.unit || "",
        source: "David · voice"
      });
      changed = true;
    }

    for (const meal of actions?.meals || []) {
      if (typeof window.addMeal === "function") {
        window.addMeal(meal, { silent: true });
        changed = true;
      }
    }

    if (changed) {
      if (typeof window.saveState === "function") window.saveState();
      if (typeof window.render === "function") window.render();
    }
  }

  async function processAudio(blob, mimeType) {
    setButton("Sorting…", true);
    setStatus("David is listening back and sorting the shop…");

    const form = new FormData();
    form.append("audio", blob, `hello-david-${Date.now()}.${extensionFor(mimeType)}`);
    form.append("existingShop", JSON.stringify(currentShop()));

    const response = await fetch(ENDPOINT, {
      method: "POST",
      body: form
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || "I couldn't process that recording.");
    }

    if (input) input.value = result.transcript || "";
    applyActions(result.actions || {});

    const reply = result?.actions?.response || "Done — I've updated the shop.";
    setStatus(`Heard: “${result.transcript}” · ${reply}`);
    if (typeof window.say === "function") window.say(reply);
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setStatus("Audio recording isn't supported in this browser. Try Chrome or Edge, or type your list.");
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const mimeType = preferredMimeType();
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunks = [];

      recorder.addEventListener("dataavailable", event => {
        if (event.data?.size) chunks.push(event.data);
      });

      recorder.addEventListener("stop", async () => {
        clearInterval(timer);
        timer = null;
        recording = false;
        setButton("🎙 Speak", true);

        const actualType = recorder?.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: actualType });
        chunks = [];

        stream?.getTracks().forEach(track => track.stop());
        stream = null;

        if (!blob.size) {
          setButton("🎙 Speak", false);
          setStatus("That recording was empty. Try again.");
          return;
        }

        try {
          await processAudio(blob, actualType);
        } catch (error) {
          console.error("Hello David audio error", error);
          setStatus(error instanceof Error ? error.message : "I couldn't process that recording. Try again.");
        } finally {
          setButton("🎙 Speak", false);
        }
      });

      recorder.start(1000);
      recording = true;
      startedAt = Date.now();
      setButton("⏹ Stop recording", false);
      updateRecordingStatus();
      timer = setInterval(updateRecordingStatus, 1000);
    } catch (error) {
      console.error("Microphone start failed", error);
      stream?.getTracks().forEach(track => track.stop());
      stream = null;
      recording = false;
      setButton("🎙 Speak", false);
      setStatus("I couldn't access the microphone. Allow microphone access for hellodavid.com.au, then try again.");
    }
  }

  function stopRecording() {
    if (!recording || !recorder) return;
    recording = false;
    setButton("Finishing…", true);
    setStatus("Finishing the recording…");
    try {
      recorder.stop();
    } catch (error) {
      console.error(error);
      setButton("🎙 Speak", false);
    }
  }

  // Capture before the old browser-speech prototype handler.
  micBtn.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (recording) stopRecording();
    else startRecording();
  }, true);

  setButton("🎙 Speak", false);
  setStatus("Tap Speak, walk around and talk for as long as you need, then tap Stop recording. David will sort it afterwards.");
})();
