(function () {
const elements = {
  appShell: $(".app-shell"), mainContent: $(".main-content"), menuToggle: $("#menuToggle"), boxList: $("#boxList"),
  activeBoxName: $("#activeBoxName"), activeBoxMeta: $("#activeBoxMeta"),
  randomBox: $("#randomBox"), boxPositioner: $("#boxPositioner"), playground: $("#playground"),
  noBoxState: $("#noBoxState"), emptyState: $("#emptyState"), drawButton: $("#drawButton"),
  drawButtonLabel: $("#drawButtonLabel"), drawButtonHint: $("#drawButtonHint"),
  addPaperButton: $("#addPaperButton"), quickAddPaper: $("#quickAddPaper"), quickAddLabel: $("#quickAddLabel"),
  deleteBoxButton: $("#deleteBoxButton"), libraryCount: $("#libraryCount"),
  paperDialog: $("#paperDialog"), paperForm: $("#paperForm"), newPaperText: $("#newPaperText"),
  paperCharCount: $("#paperCharCount"), paperFormError: $("#paperFormError"), newPaperPanel: $("#newPaperPanel"),
  existingPaperPanel: $("#existingPaperPanel"), newPaperTab: $("#newPaperTab"), existingPaperTab: $("#existingPaperTab"),
  existingPaperList: $("#existingPaperList"), paperSubmitButton: $("#paperSubmitButton"), boxDialog: $("#boxDialog"),
  boxForm: $("#boxForm"), boxNameInput: $("#boxNameInput"), boxFormError: $("#boxFormError"),
  boxPaperChooser: $("#boxPaperChooser"), boxPaperList: $("#boxPaperList"), boxDialogTitle: $("#boxDialogTitle"),
  boxDialogEyebrow: $("#boxDialogEyebrow"), boxSubmitButton: $("#boxSubmitButton"), libraryDialog: $("#libraryDialog"),
  libraryList: $("#libraryList"), resultDialog: $("#resultDialog"), resultPaper: $("#resultPaper"),
  resultBoxName: $("#resultBoxName"), confirmDialog: $("#confirmDialog"), confirmTitle: $("#confirmTitle"),
  confirmMessage: $("#confirmMessage"), toast: $("#toast"), physicsCanvas: $("#physicsCanvas"),
  drawnPaperAnimation: $("#drawnPaperAnimation"), capacityDialog: $("#capacityDialog"),
  capacityTitle: $("#capacityTitle"), capacityMessage: $("#capacityMessage")
};

let toastTimer;

function renderApp(store, physics) {
  const box = store.activeBox;
  const papers = store.activePapers;
  elements.boxList.innerHTML = store.boxes.length ? store.boxes.map((item) => {
    const active = item.id === box?.id;
    return `<button class="box-list-item${active ? " active" : ""}" type="button" data-box-id="${item.id}" aria-current="${active ? "true" : "false"}">
      <span class="box-list-copy"><strong>${escapeHtml(item.name)}</strong><small>${item.paperIds.length ? "Ready to draw" : "Needs papers"}</small></span>
      <span class="box-count">${item.paperIds.length}</span>
    </button>`;
  }).join("") : '<div class="box-list-empty">No boxes yet<br>Use + above to create one</div>';
  elements.libraryCount.textContent = `${store.papers.length} paper${store.papers.length === 1 ? "" : "s"}`;
  elements.mainContent.classList.toggle("no-active-box", !box);
  elements.noBoxState.hidden = Boolean(box);
  elements.playground.hidden = !box;
  document.querySelector(".control-dock").hidden = !box;
  elements.deleteBoxButton.disabled = !box;
  elements.quickAddLabel.textContent = box ? "Add paper" : "Create box";
  if (!box) {
    elements.activeBoxName.textContent = "No boxes yet";
    elements.activeBoxMeta.textContent = "Create a box to get started";
    physics.sync([]);
    return;
  }
  elements.activeBoxName.textContent = box.name;
  elements.activeBoxMeta.textContent = `${papers.length} paper${papers.length === 1 ? "" : "s"}`;
  const physicsEnabled = papers.length < 17;
  physics.setEnabled(physicsEnabled);
  elements.drawButtonLabel.textContent = physicsEnabled ? "Shake and draw" : "Random pick";
  elements.drawButtonHint.textContent = physicsEnabled ? "Every paper has an equal chance" : "Physics paused for performance";
  elements.drawButton.disabled = papers.length === 0;
  elements.emptyState.hidden = papers.length !== 0;
  physics.sync(physicsEnabled ? papers : papers.slice(0, 17));
}

function renderPaperChoices(target, papers, selectedIds = []) {
  const selected = new Set(selectedIds);
  target.innerHTML = papers.length ? papers.map((paper) => `
    <label class="selection-item"><input type="checkbox" value="${paper.id}"${selected.has(paper.id) ? " checked" : ""}><span>${escapeHtml(paper.text)}</span></label>
  `).join("") : '<div class="selection-empty">No papers available</div>';
}

function renderLibrary(store) {
  elements.libraryList.innerHTML = store.papers.length ? store.papers.map((paper) => {
    const usage = store.boxes.filter((box) => box.paperIds.includes(paper.id)).length;
    return `<article class="library-item" data-paper-id="${paper.id}">
      <div class="library-item-copy"><strong>${escapeHtml(paper.text)}</strong><small>In ${usage} box${usage === 1 ? "" : "es"}</small></div>
      <div class="library-actions"><button class="edit-paper" type="button" aria-label="Edit paper" title="Edit paper">✎</button><button class="delete-paper" type="button" aria-label="Delete paper" title="Delete from all boxes">×</button></div>
    </article>`;
  }).join("") : '<div class="library-empty">No papers yet. Create a box, then add a paper.</div>';
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  elements.toast.classList.remove("show");
  requestAnimationFrame(() => elements.toast.classList.add("show"));
  toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 2300);
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function $(selector) { return document.querySelector(selector); }

Object.assign(window.RandomBoxApp, { elements, renderApp, renderLibrary, renderPaperChoices, showToast });
})();
