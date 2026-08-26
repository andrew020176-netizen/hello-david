(() => {
  const out = document.getElementById("basketResults");
  const notice = document.querySelector(".notice");

  function liveOnlyBasket() {
    if (!out) return;
    out.innerHTML = "";
    const itemCount = document.querySelectorAll(".item-row").length;
    if (!itemCount) {
      out.innerHTML = '<div class="empty-state">Add some groceries and David will compare live prices.</div>';
      if (notice) notice.textContent = "Add an item and David will compare live prices.";
      return;
    }
    if (notice) notice.textContent = "Finding reliable matches and live prices…";
  }

  window.renderBasket = liveOnlyBasket;
  liveOnlyBasket();
})();