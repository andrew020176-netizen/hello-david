(() => {
  const ENDPOINT = "https://wfhgyunfvdyxwtggntpc.supabase.co/functions/v1/hello-david-shared-shop";
  const TOKEN_KEY = "helloDavid.sharedShopToken.v1";
  const itemsList = document.getElementById("itemsList");
  const inputActions = document.querySelector(".input-actions");
  const clearBtn = document.getElementById("clearBtn");

  if (!itemsList || !inputActions) return;

  // Voice-first UI: the old typing/transcript controls have finished their setup
  // by the time this file runs, so remove them from the visible product surface.
  ["voiceToggle", "addBtn", "groceryInput", "speechStatus"].forEach(id => {
    document.getElementById(id)?.remove();
  });

  const micBtn = document.getElementById("micBtn");
  if (micBtn) {
    micBtn.style.minWidth = "170px";
    micBtn.style.minHeight = "52px";
    micBtn.style.fontSize = "18px";
    micBtn.style.fontWeight = "700";
  }

  const shareBtn = document.createElement("button");
  shareBtn.id = "shareShopBtn";
  shareBtn.className = "secondary-btn";
  shareBtn.textContent = "Share shop";
  inputActions.appendChild(shareBtn);

  const shareStatus = document.createElement("div");
  shareStatus.className = "hint";
  shareStatus.style.marginTop = "6px";
  shareStatus.textContent = "";
  inputActions.parentElement?.appendChild(shareStatus);

  const urlToken = new URLSearchParams(window.location.search).get("shop");
  let token = /^[0-9a-fA-F-]{36}$/.test(urlToken || "")
    ? urlToken
    : localStorage.getItem(TOKEN_KEY);
  let applyingRemote = false;
  let saving = false;
  let localDirty = false;
  let saveTimer = null;
  let lastUpdated = null;

  if (token) localStorage.setItem(TOKEN_KEY, token);

  function currentItems() {
    return [...document.querySelectorAll(".item-row")]
      .map(row => {
        const meta = row.querySelector(".item-meta")?.textContent || "";
        const first = meta.split("·")[0]?.trim() || "";
        const isSource = /^(David|Shared shop|Voice|Voice \/ typed|Salmon \+ greens|Burgers|Chicken fajitas)/i.test(first);
        const unit = first && !isSource ? first : "";
        return {
          name: row.querySelector(".item-name")?.value?.trim() || "",
          qty: Number(row.querySelector(".item-qty")?.value || 1),
          unit,
          source: "Shared shop"
        };
      })
      .filter(item => item.name);
  }

  function signature(items) {
    return JSON.stringify((items || []).map(item => ({
      name: String(item?.name || "").trim().toLowerCase(),
      qty: Number(item?.qty ?? item?.quantity ?? 1) || 1,
      unit: String(item?.unit || "").trim().toLowerCase()
    })));
  }

  async function callApi(action, extra = {}) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || "Shared shop request failed.");
    }
    return result;
  }

  function setToken(nextToken) {
    token = nextToken;
    localStorage.setItem(TOKEN_KEY, token);
    const url = new URL(window.location.href);
    url.searchParams.set("shop", token);
    history.replaceState({}, "", url);
    shareBtn.textContent = "Share this shop";
  }

  async function createSharedShop() {
    const result = await callApi("create", { items: currentItems() });
    setToken(result.share_token);
    lastUpdated = result.updated_at || null;
    localDirty = false;
    return token;
  }

  async function saveSharedShop() {
    if (!token || applyingRemote || saving || !localDirty) return;
    saving = true;
    try {
      const result = await callApi("save", { token, items: currentItems() });
      lastUpdated = result.updated_at || lastUpdated;
      localDirty = false;
      shareStatus.textContent = "Shared shop updated.";
    } catch (error) {
      console.error("Shared shop save failed", error);
      shareStatus.textContent = "Couldn't sync the shared shop yet — your list is still saved on this device.";
    } finally {
      saving = false;
    }
  }

  function scheduleSave() {
    if (!token || applyingRemote) return;
    localDirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSharedShop, 700);
  }

  async function applyRemoteItems(items) {
    const incoming = Array.isArray(items) ? items : [];
    if (signature(currentItems()) === signature(incoming)) return;

    applyingRemote = true;
    try {
      if (currentItems().length && clearBtn) clearBtn.click();
      for (const item of incoming) {
        if (typeof window.addOrMerge !== "function") continue;
        window.addOrMerge({
          name: String(item?.name || "").trim(),
          qty: Number(item?.qty ?? item?.quantity ?? 1) || 1,
          unit: item?.unit || "",
          source: "Shared shop"
        });
      }
      if (typeof window.saveState === "function") window.saveState();
      if (typeof window.render === "function") window.render();
      shareStatus.textContent = "Shared shop synced.";
    } finally {
      setTimeout(() => {
        applyingRemote = false;
        localDirty = false;
      }, 100);
    }
  }

  async function loadSharedShop({ quiet = false } = {}) {
    if (!token || saving || localDirty) return;
    try {
      const result = await callApi("get", { token });
      if (!quiet || (result.updated_at && result.updated_at !== lastUpdated)) {
        await applyRemoteItems(result.items || []);
      }
      lastUpdated = result.updated_at || lastUpdated;
      shareBtn.textContent = "Share this shop";
      if (!quiet) shareStatus.textContent = "You're on a shared household shop. Changes sync automatically.";
    } catch (error) {
      console.error("Shared shop load failed", error);
      if (!quiet) shareStatus.textContent = "I couldn't open that shared shop.";
    }
  }

  async function shareShop() {
    shareBtn.disabled = true;
    shareBtn.textContent = "Preparing…";
    try {
      if (!token) await createSharedShop();
      else await saveSharedShop();

      const url = new URL(window.location.href);
      url.searchParams.set("shop", token);
      const link = url.toString();
      const shareData = {
        title: "Hello David shop",
        text: "Add anything you want to our Hello David shop.",
        url: link
      };

      if (navigator.share) {
        await navigator.share(shareData);
        shareStatus.textContent = "Shared. Anything they add will sync back here.";
      } else if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        window.location.href = `sms:?&body=${encodeURIComponent(`${shareData.text} ${link}`)}`;
        shareStatus.textContent = "Opening Messages…";
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        shareStatus.textContent = "Shop link copied — paste it into a text message.";
      } else {
        window.prompt("Copy this shop link", link);
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Share shop failed", error);
        shareStatus.textContent = "Couldn't create the share link. Try again.";
      }
    } finally {
      shareBtn.disabled = false;
      shareBtn.textContent = token ? "Share this shop" : "Share shop";
    }
  }

  shareBtn.addEventListener("click", shareShop);

  const observer = new MutationObserver(() => scheduleSave());
  observer.observe(itemsList, { childList: true, subtree: true });

  document.addEventListener("change", event => {
    if (event.target?.matches?.(".item-name, .item-qty")) scheduleSave();
  });

  if (token) {
    loadSharedShop();
    setInterval(() => loadSharedShop({ quiet: true }), 6000);
  }
})();
