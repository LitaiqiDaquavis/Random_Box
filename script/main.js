(function () {
const { RandomBoxStore, PaperPhysics, BoxDragController, ManagementController, elements, renderApp, renderLibrary, renderPaperChoices, showToast } = window.RandomBoxApp;

const store = new RandomBoxStore();
const physics = new PaperPhysics(elements.physicsCanvas);
const dragController = new BoxDragController(elements.boxPositioner, elements.playground, (dx, dy) => physics.kick(dx, dy, 0.75, false));
let paperDialogMode = "new";
let boxDialogMode = "create";
let drawnPaperId = null;
let confirmAction = null;
let drawing = false;
let reopenManagement = false;
let manager;
let pendingCapacityNotice = null;
let knownBoxCounts = new Map(store.boxes.map((box) => [box.id, box.paperIds.length]));

function refresh() {
  renderApp(store, physics);
  if (manager) manager.refresh();
}

function commit(message) {
  const capacityNotice = detectCapacityNotice();
  if (!store.commit()) showToast("Could not save locally. Check this browser's storage permissions.");
  else if (message) showToast(message);
  refresh();
  if (capacityNotice) {
    pendingCapacityNotice = capacityNotice;
    setTimeout(presentCapacityNotice, 0);
  }
}

function detectCapacityNotice() {
  let notice = null;
  store.boxes.forEach((box) => {
    const previous = knownBoxCounts.get(box.id) || 0;
    const current = box.paperIds.length;
    if (current > previous && previous < 17 && current >= 17) notice = "disabled";
    else if (!notice && current > previous && previous < 15 && current >= 15) notice = "warning";
  });
  knownBoxCounts = new Map(store.boxes.map((box) => [box.id, box.paperIds.length]));
  return notice;
}

function presentCapacityNotice() {
  if (!pendingCapacityNotice || elements.capacityDialog.open) return;
  const disabled = pendingCapacityNotice === "disabled";
  pendingCapacityNotice = null;
  elements.capacityTitle.textContent = disabled ? "Physics paused" : "Many papers";
  elements.capacityMessage.textContent = disabled
    ? "This box now has 17 or more papers. Physics was turned off automatically to protect performance."
    : "This box now contains many papers. Physics may slow down, so consider removing some papers.";
  elements.capacityDialog.showModal();
}

function setPaperTab(mode) {
  paperDialogMode = mode;
  const isNew = mode === "new";
  elements.newPaperTab.classList.toggle("active", isNew);
  elements.existingPaperTab.classList.toggle("active", !isNew);
  elements.newPaperTab.setAttribute("aria-selected", String(isNew));
  elements.existingPaperTab.setAttribute("aria-selected", String(!isNew));
  elements.newPaperPanel.hidden = !isNew;
  elements.existingPaperPanel.hidden = isNew;
  elements.paperSubmitButton.textContent = isNew ? "Create and add" : "Add selected papers";
  elements.paperFormError.textContent = "";
  if (!isNew) {
    const included = new Set(store.activeBox?.paperIds || []);
    renderPaperChoices(elements.existingPaperList, store.papers.filter((paper) => !included.has(paper.id)));
  }
}

function openPaperDialog(mode = "new") {
  if (mode !== "library" && !store.activeBox) { openBoxDialog("create"); return; }
  elements.paperForm.reset();
  elements.newPaperText.value = "";
  elements.paperCharCount.textContent = "0 / 120";
  setPaperTab("new");
  paperDialogMode = mode;
  document.querySelector("#paperDialog .modal-header .eyebrow").textContent = mode === "library" ? "Add to paper library" : "Add to current box";
  document.querySelector("#paperDialog .modal-header h2").textContent = mode === "library" ? "New paper" : "Add paper";
  document.querySelector("#paperDialog .tabs").hidden = mode === "library";
  elements.paperSubmitButton.textContent = mode === "library" ? "Add to library" : "Create and add";
  elements.paperDialog.showModal();
  elements.newPaperText.focus();
}

function submitPaper(event) {
  event.preventDefault();
  if (paperDialogMode === "library") {
    const text = elements.newPaperText.value.trim();
    if (!text) { elements.paperFormError.textContent = "Write the paper content first"; return; }
    const result = store.createPaper(text);
    if (result.existing) { elements.paperFormError.textContent = "A paper with the same content already exists"; return; }
    commit("New paper added to the library");
  } else if (paperDialogMode === "new") {
    if (!store.activeBox) return;
    const text = elements.newPaperText.value.trim();
    if (!text) { elements.paperFormError.textContent = "Write the paper content first"; return; }
    const result = store.addNewPaper(text);
    if (result.alreadyIncluded) { elements.paperFormError.textContent = "This paper is already in the current box"; return; }
    commit(result.existing ? "Existing paper added to the current box" : "New paper added to the box");
  } else {
    const ids = [...elements.existingPaperList.querySelectorAll("input:checked")].map((input) => input.value);
    if (!ids.length) { elements.paperFormError.textContent = "Select at least one paper"; return; }
    store.addPapersToActive(ids);
    commit(`Added ${ids.length} paper${ids.length === 1 ? "" : "s"}`);
  }
  elements.paperDialog.close();
  if (paperDialogMode !== "library") physics.kick(0, -18, 1.1);
}

function openBoxDialog(mode) {
  boxDialogMode = mode;
  elements.boxForm.reset();
  elements.boxFormError.textContent = "";
  const editing = mode === "rename";
  elements.boxDialogTitle.textContent = editing ? "Rename box" : "Create box";
  elements.boxDialogEyebrow.textContent = editing ? "Current box" : "New box";
  elements.boxSubmitButton.textContent = editing ? "Save name" : "Create box";
  elements.boxPaperChooser.hidden = editing;
  elements.boxNameInput.value = editing ? (store.activeBox?.name || "") : "";
  if (!editing) renderPaperChoices(elements.boxPaperList, store.papers);
  elements.boxDialog.showModal();
  elements.boxNameInput.focus();
  elements.boxNameInput.select();
}

function submitBox(event) {
  event.preventDefault();
  const name = elements.boxNameInput.value.trim();
  if (!name) { elements.boxFormError.textContent = "Enter a box name"; return; }
  if (boxDialogMode === "rename") {
    store.renameActiveBox(name);
    commit("Box name updated");
  } else {
    const ids = [...elements.boxPaperList.querySelectorAll("input:checked")].map((input) => input.value);
    store.createBox(name, ids);
    dragController.reset();
    commit("New box created");
  }
  elements.boxDialog.close();
}

function reopenManagerIfNeeded() {
  if (!reopenManagement) return;
  reopenManagement = false;
  setTimeout(() => manager.open(manager.mode), 0);
}

function askConfirm(title, message, action) {
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  confirmAction = action;
  elements.confirmDialog.showModal();
}

function deleteActiveBox() {
  const box = store.activeBox;
  if (!box) return;
  askConfirm("Delete current box?", `“${box.name}” will be deleted. Its papers will remain in the paper library.`, () => {
    store.deleteActiveBox();
    dragController.reset();
    commit("Box deleted");
  });
}

function editPaper(id) {
  const paper = store.papers.find((item) => item.id === id);
  if (!paper) return;
  const next = window.prompt("Edit paper content", paper.text);
  if (next === null) return;
  const text = next.trim().slice(0, 120);
  if (!text) { showToast("Paper content cannot be empty"); return; }
  store.updatePaper(id, text);
  commit("Paper updated");
  renderLibrary(store);
}

function deletePaper(id) {
  const paper = store.papers.find((item) => item.id === id);
  if (!paper) return;
  askConfirm("Delete this paper?", `“${paper.text}” will be removed from the library and every box.`, () => {
    store.deletePaper(id);
    commit("Paper deleted");
    renderLibrary(store);
  });
}

async function drawPaper() {
  if (!store.activePapers.length || drawing) return;
  if (store.activePapers.length >= 17) {
    const paper = store.activePapers[Math.floor(Math.random() * store.activePapers.length)];
    drawnPaperId = paper.id;
    elements.resultPaper.textContent = paper.text;
    elements.resultBoxName.textContent = `From “${store.activeBox.name}”`;
    elements.resultDialog.showModal();
    return;
  }
  drawing = true;
  elements.appShell.classList.add("is-drawing");
  elements.randomBox.classList.add("shaking");
  elements.drawButton.disabled = true;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timing = reducedMotion ? { shake: 140, lid: 90, lift: 120, close: 90, unfold: 140 } : { shake: 760, lid: 390, lift: 580, close: 380, unfold: 640 };
  let count = 0;
  const shakeTimer = setInterval(() => {
    physics.shake();
    count += 1;
    if (count >= 7) clearInterval(shakeTimer);
  }, reducedMotion ? 18 : 95);

  await wait(timing.shake);
  clearInterval(shakeTimer);
  elements.randomBox.classList.remove("shaking");
  elements.randomBox.classList.add("lid-open");

  const pickedId = physics.pick();
  const paper = store.activePapers.find((item) => item.id === pickedId) || store.activePapers[Math.floor(Math.random() * store.activePapers.length)];
  drawnPaperId = paper.id;
  physics.hidePaper(paper.id);
  await wait(timing.lid);

  const stageRect = elements.playground.getBoundingClientRect();
  const boxRect = elements.randomBox.getBoundingClientRect();
  const animation = elements.drawnPaperAnimation;
  animation.style.left = `${boxRect.left - stageRect.left + boxRect.width / 2}px`;
  animation.style.top = `${boxRect.top - stageRect.top + boxRect.height * 0.58}px`;
  animation.className = "drawn-paper-animation active";
  void animation.offsetWidth;
  animation.classList.add("lifting");
  await wait(timing.lift);

  elements.randomBox.classList.remove("lid-open");
  await wait(timing.close);
  animation.style.left = `${stageRect.width / 2}px`;
  animation.style.top = `${stageRect.height / 2}px`;
  animation.classList.add("unfolding");
  await wait(timing.unfold);

  elements.resultPaper.textContent = paper.text;
  elements.resultBoxName.textContent = `From “${store.activeBox.name}”`;
  animation.className = "drawn-paper-animation";
  animation.removeAttribute("style");
  elements.resultDialog.showModal();
  elements.drawButton.disabled = false;
  elements.appShell.classList.remove("is-drawing");
  drawing = false;
}

function returnDrawnPaper() {
  drawnPaperId = null;
  physics.showAllPapers();
  if (elements.resultDialog.open) elements.resultDialog.close();
  physics.kick(0, -8, 0.5);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

manager = new ManagementController({
  store,
  dialog: document.querySelector("#managementDialog"),
  view: document.querySelector("#managementView"),
  tabs: document.querySelector("#managementTabs"),
  title: document.querySelector("#managementTitle"),
  onCommit: commit,
  onAddBox: () => {
    reopenManagement = true;
    manager.close();
    openBoxDialog("create");
  },
  onAddPaper: () => {
    reopenManagement = true;
    manager.close();
    openPaperDialog("library");
  },
  onConfirm: askConfirm
});

elements.menuToggle.addEventListener("click", () => {
  const collapsed = elements.appShell.classList.toggle("sidebar-collapsed");
  elements.menuToggle.setAttribute("aria-expanded", String(!collapsed));
  elements.menuToggle.setAttribute("aria-label", collapsed ? "Expand menu" : "Collapse menu");
  const sidebar = document.querySelector("#sidebar");
  sidebar.setAttribute("aria-hidden", String(collapsed));
  sidebar.inert = collapsed;
});
document.querySelector("#manageButton").addEventListener("click", () => manager.open());
document.querySelector("#closeManagementButton").addEventListener("click", () => manager.close());
document.querySelector("#managementDialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) manager.close(); });
elements.boxList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-box-id]");
  if (!button) return;
  store.selectBox(button.dataset.boxId);
  dragController.reset();
  commit();
});
document.querySelector("#addBoxButton").addEventListener("click", () => openBoxDialog("create"));
document.querySelector("#createFirstBoxButton").addEventListener("click", () => openBoxDialog("create"));
elements.deleteBoxButton.addEventListener("click", deleteActiveBox);
elements.addPaperButton.addEventListener("click", () => openPaperDialog());
elements.quickAddPaper.addEventListener("click", () => store.activeBox ? openPaperDialog() : openBoxDialog("create"));
elements.newPaperTab.addEventListener("click", () => setPaperTab("new"));
elements.existingPaperTab.addEventListener("click", () => setPaperTab("existing"));
elements.newPaperText.addEventListener("input", () => { elements.paperCharCount.textContent = `${elements.newPaperText.value.length} / 120`; });
elements.paperForm.addEventListener("submit", submitPaper);
elements.boxForm.addEventListener("submit", submitBox);
elements.drawButton.addEventListener("click", drawPaper);
document.querySelector("#openLibraryButton").addEventListener("click", () => { renderLibrary(store); elements.libraryDialog.showModal(); });
elements.libraryList.addEventListener("click", (event) => {
  const item = event.target.closest("[data-paper-id]");
  if (!item) return;
  if (event.target.closest(".edit-paper")) editPaper(item.dataset.paperId);
  if (event.target.closest(".delete-paper")) deletePaper(item.dataset.paperId);
});
document.querySelector("#returnResultButton").addEventListener("click", returnDrawnPaper);
elements.resultDialog.addEventListener("cancel", (event) => { event.preventDefault(); returnDrawnPaper(); });
document.querySelector("#confirmCancel").addEventListener("click", () => { confirmAction = null; elements.confirmDialog.close(); });
document.querySelector("#confirmAccept").addEventListener("click", () => {
  const action = confirmAction;
  confirmAction = null;
  elements.confirmDialog.close();
  if (action) action();
});
document.querySelector("#capacityAccept").addEventListener("click", () => elements.capacityDialog.close());
document.querySelectorAll(".close-dialog").forEach((button) => button.addEventListener("click", () => elements.paperDialog.close()));
document.querySelectorAll(".close-box-dialog").forEach((button) => button.addEventListener("click", () => elements.boxDialog.close()));
document.querySelectorAll(".close-library-dialog").forEach((button) => button.addEventListener("click", () => elements.libraryDialog.close()));
elements.paperDialog.addEventListener("close", reopenManagerIfNeeded);
elements.boxDialog.addEventListener("close", reopenManagerIfNeeded);
[elements.paperDialog, elements.boxDialog, elements.libraryDialog, elements.confirmDialog, elements.capacityDialog].forEach((dialog) => {
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
});

refresh();
})();
