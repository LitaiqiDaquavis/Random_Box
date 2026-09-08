(function () {
class ManagementController {
  constructor({ store, dialog, view, tabs, title, onCommit, onAddBox, onAddPaper, onConfirm }) {
    this.store = store;
    this.dialog = dialog;
    this.view = view;
    this.tabs = tabs;
    this.title = title;
    this.onCommit = onCommit;
    this.onAddBox = onAddBox;
    this.onAddPaper = onAddPaper;
    this.onConfirm = onConfirm;
    this.mode = "boxes";
    this.detail = null;
    this.relationMode = null;
    this.selected = new Set();
    this.deletionMode = false;
    this.editing = false;
    tabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-management-tab]");
      if (button) this.setMode(button.dataset.managementTab);
    });
    view.addEventListener("click", (event) => this.handleClick(event));
    view.addEventListener("change", (event) => this.handleChange(event));
  }

  open(mode = this.mode) {
    this.mode = mode;
    this.detail = null;
    this.relationMode = null;
    this.selected.clear();
    this.deletionMode = false;
    this.editing = false;
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
  }

  close() { if (this.dialog.open) this.dialog.close(); }

  refresh() {
    if (!this.dialog.open) return;
    if (this.detail && !this.currentDetailItem()) this.detail = null;
    this.render();
  }

  setMode(mode) {
    this.mode = mode;
    this.detail = null;
    this.relationMode = null;
    this.selected.clear();
    this.deletionMode = false;
    this.editing = false;
    this.render();
  }

  render() {
    this.tabs.hidden = Boolean(this.detail);
    this.tabs.classList.toggle("papers-active", this.mode === "papers");
    this.tabs.querySelectorAll("[data-management-tab]").forEach((button) => {
      const active = button.dataset.managementTab === this.mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    if (this.detail) this.renderDetail();
    else this.renderOverview();
  }

  renderOverview() {
    const isBoxes = this.mode === "boxes";
    const items = isBoxes ? this.store.boxes : this.store.papers;
    this.title.textContent = isBoxes ? "Manage boxes" : "Manage papers";
    const singular = isBoxes ? "box" : "paper";
    const plural = isBoxes ? "boxes" : "papers";
    const rows = items.map((item) => {
      const meta = isBoxes
        ? countLabel(item.paperIds.length, "paper", "papers")
        : `In ${countLabel(this.store.boxes.filter((box) => box.paperIds.includes(item.id)).length, "box", "boxes")}`;
      return `<article class="management-row${this.deletionMode ? ` selection-row${this.selected.has(item.id) ? " selected" : ""}` : ""}" data-manage-id="${item.id}">
        <label class="management-check" title="Select ${singular}"><input type="checkbox" data-select-item="${item.id}"${this.selected.has(item.id) ? " checked" : ""}><span class="sr-only">Select ${escapeText(item.name || item.text)}</span></label>
        <button class="management-open" type="button" data-open-detail="${item.id}"><strong>${escapeText(item.name || item.text)}</strong><small>${meta}</small></button>
        <span class="management-arrow" aria-hidden="true">›</span>
      </article>`;
    }).join("");
    this.view.innerHTML = `
      <div class="management-toolbar">
        <div class="management-toolbar-copy"><strong>${countLabel(items.length, singular, plural)}</strong><small>${this.deletionMode ? "Click anywhere on a row to select it" : "Click a name to view details"}</small></div>
        <div class="management-toolbar-actions">
          ${this.deletionMode ? '<button class="secondary-button" type="button" data-management-action="cancel-delete">Cancel</button>' : `<button class="primary-button" type="button" data-management-action="add">+ Add ${singular}</button>`}
          <button class="danger-button" type="button" data-management-action="delete"${this.deletionMode && !this.selected.size ? " disabled" : ""}>${this.deletionMode ? `Delete selected (${this.selected.size})` : "Delete"}</button>
        </div>
      </div>
      ${items.length ? `<div class="management-list">${rows}</div>` : `<div class="management-empty">No ${plural} yet<br>Click “Add ${singular}” to create one</div>`}`;
  }

  renderDetail() {
    const item = this.currentDetailItem();
    if (!item) { this.detail = null; this.renderOverview(); return; }
    const isBox = this.mode === "boxes";
    this.title.textContent = isBox ? "Box details" : "Paper details";
    const related = isBox
      ? this.store.papers.filter((paper) => item.paperIds.includes(paper.id))
      : this.store.boxes.filter((box) => box.paperIds.includes(item.id));
    const relationSingular = isBox ? "paper" : "box";
    const relationPlural = isBox ? "papers" : "boxes";
    const rows = related.map((relatedItem) => `
      <article class="management-row${this.deletionMode ? ` selection-row${this.selected.has(relatedItem.id) ? " selected" : ""}` : ""}" data-relation-id="${relatedItem.id}">
        <label class="management-check"><input type="checkbox" data-select-relation="${relatedItem.id}"${this.selected.has(relatedItem.id) ? " checked" : ""}><span class="sr-only">Select ${escapeText(relatedItem.name || relatedItem.text)}</span></label>
        <div class="management-open"><strong>${escapeText(relatedItem.name || relatedItem.text)}</strong><small>${isBox ? "Paper library content" : countLabel(relatedItem.paperIds.length, "paper", "papers")}</small></div>
        <span></span>
      </article>`).join("");
    this.view.innerHTML = `
      <div class="management-toolbar detail-toolbar">
        <button class="secondary-button back-button" type="button" data-management-action="back" aria-label="Back">‹</button>
        <div class="management-toolbar-copy"><strong>${escapeText(item.name || item.text)}</strong><small>${isBox ? `${countLabel(related.length, "paper", "papers")} in this box` : `In ${countLabel(related.length, "box", "boxes")}`}</small></div>
        ${this.editing ? "" : '<button class="secondary-button detail-edit-button" type="button" data-management-action="edit">Edit</button>'}
      </div>
      ${this.editing ? this.renderEditPanel(item, isBox) : ""}
      ${this.relationMode ? this.renderRelationPanel(item, isBox) : ""}
      <div class="detail-list-heading"><span>Included ${relationPlural}</span><span>${related.length}</span></div>
      <div class="management-toolbar-actions detail-actions">
        ${this.deletionMode
          ? '<button class="secondary-button" type="button" data-management-action="cancel-delete">Cancel</button>'
          : `<button class="primary-button" type="button" data-management-action="add-relation">+ ${isBox ? "Add paper" : "Add to box"}</button>`}
        <button class="danger-button" type="button" data-management-action="remove-relation"${this.deletionMode && !this.selected.size ? " disabled" : ""}>${this.deletionMode ? `Remove selected (${this.selected.size})` : "Remove"}</button>
      </div>
      ${related.length ? `<div class="management-list">${rows}</div>` : `<div class="management-empty">No related ${relationPlural}</div>`}`;
  }

  renderRelationPanel(item, isBox) {
    const existing = new Set(isBox ? item.paperIds : this.store.boxes.filter((box) => box.paperIds.includes(item.id)).map((box) => box.id));
    const available = (isBox ? this.store.papers : this.store.boxes).filter((entry) => !existing.has(entry.id));
    const singular = isBox ? "paper" : "box";
    const plural = isBox ? "papers" : "boxes";
    return `<div class="relation-panel">
      <div class="relation-panel-header"><strong>Select ${plural} to add</strong><span class="eyebrow">Multiple allowed</span></div>
      <div class="relation-options">${available.length ? available.map((entry) => `<label class="relation-option"><input type="checkbox" data-add-relation="${entry.id}"><span>${escapeText(entry.name || entry.text)}</span></label>`).join("") : `<div class="selection-empty">No ${plural} available</div>`}</div>
      <div class="relation-panel-actions"><button class="secondary-button" type="button" data-management-action="cancel-relation">Cancel</button><button class="primary-button" type="button" data-management-action="confirm-relation"${available.length ? "" : " disabled"}>Add selected</button></div>
    </div>`;
  }

  renderEditPanel(item, isBox) {
    return `<div class="management-edit-panel">
      <label class="field-label" for="managementEditValue">${isBox ? "Box name" : "Paper content"}</label>
      <textarea id="managementEditValue" class="management-edit-input${isBox ? " single-line" : ""}" data-edit-value maxlength="${isBox ? 30 : 120}" rows="${isBox ? 1 : 3}">${escapeText(item.name || item.text)}</textarea>
      <p class="management-edit-error" role="alert"></p>
      <div class="relation-panel-actions"><button class="secondary-button" type="button" data-management-action="cancel-edit">Cancel</button><button class="primary-button" type="button" data-management-action="save-edit">Save</button></div>
    </div>`;
  }

  currentDetailItem() {
    const items = this.mode === "boxes" ? this.store.boxes : this.store.papers;
    return items.find((item) => item.id === this.detail) || null;
  }

  handleChange(event) {
    const input = event.target.closest("[data-select-item], [data-select-relation]");
    if (!input || !this.deletionMode) return;
    const id = input.dataset.selectItem || input.dataset.selectRelation;
    if (input.checked) this.selected.add(id);
    else this.selected.delete(id);
    input.closest(".management-row")?.classList.toggle("selected", input.checked);
    this.updateSelectionControls();
  }

  handleClick(event) {
    const selectionRow = event.target.closest("[data-manage-id], [data-relation-id]");
    if (this.deletionMode && selectionRow) {
      if (event.target.matches("input[data-select-item], input[data-select-relation]")) return;
      event.preventDefault();
      const id = selectionRow.dataset.manageId || selectionRow.dataset.relationId;
      const selected = !this.selected.has(id);
      if (selected) this.selected.add(id); else this.selected.delete(id);
      selectionRow.classList.toggle("selected", selected);
      const input = selectionRow.querySelector("[data-select-item], [data-select-relation]");
      if (input) input.checked = selected;
      this.updateSelectionControls();
      return;
    }
    const detailButton = event.target.closest("[data-open-detail]");
    if (detailButton) {
      this.detail = detailButton.dataset.openDetail;
      this.selected.clear();
      this.relationMode = null;
      this.deletionMode = false;
      this.editing = false;
      this.render();
      return;
    }
    const action = event.target.closest("[data-management-action]")?.dataset.managementAction;
    if (!action) return;
    if (action === "add") return this.mode === "boxes" ? this.onAddBox() : this.onAddPaper();
    if (action === "cancel-delete") { this.deletionMode = false; this.selected.clear(); return this.render(); }
    if (action === "back") { this.detail = null; this.relationMode = null; this.editing = false; this.deletionMode = false; this.selected.clear(); return this.render(); }
    if (action === "edit") { this.editing = true; this.relationMode = null; return this.render(); }
    if (action === "cancel-edit") { this.editing = false; return this.render(); }
    if (action === "save-edit") return this.saveEdit();
    if (action === "add-relation") { this.relationMode = "add"; return this.render(); }
    if (action === "cancel-relation") { this.relationMode = null; return this.render(); }
    if (action === "confirm-relation") return this.addRelations();
    if (action === "remove-relation") {
      if (!this.deletionMode) { this.deletionMode = true; this.relationMode = null; this.editing = false; this.selected.clear(); return this.render(); }
      return this.removeRelations();
    }
    if (action === "delete") {
      if (!this.deletionMode) { this.deletionMode = true; this.selected.clear(); return this.render(); }
      return this.deleteSelected();
    }
  }

  deleteSelected() {
    if (!this.selected.size) return;
    const ids = [...this.selected];
    const isBoxes = this.mode === "boxes";
    this.onConfirm(`Delete selected ${isBoxes ? "boxes" : "papers"}?`, isBoxes
      ? `${countLabel(ids.length, "box", "boxes")} will be deleted. Their papers will remain in the library.`
      : `${countLabel(ids.length, "paper", "papers")} will be deleted and removed from every box.`, () => {
        if (isBoxes) this.store.deleteBoxes(ids); else this.store.deletePapers(ids);
        this.selected.clear();
        this.deletionMode = false;
        this.onCommit(`Deleted ${countLabel(ids.length, isBoxes ? "box" : "paper", isBoxes ? "boxes" : "papers")}`);
      });
  }

  updateSelectionControls() {
    const action = this.detail ? "remove-relation" : "delete";
    const button = this.view.querySelector(`[data-management-action="${action}"]`);
    if (!button) return;
    button.disabled = this.selected.size === 0;
    button.textContent = `${this.detail ? "Remove" : "Delete"} selected (${this.selected.size})`;
  }

  saveEdit() {
    const item = this.currentDetailItem();
    const input = this.view.querySelector("[data-edit-value]");
    if (!item || !input) return;
    const limit = this.mode === "boxes" ? 30 : 120;
    const value = input.value.trim().slice(0, limit);
    if (!value) {
      this.view.querySelector(".management-edit-error").textContent = this.mode === "boxes" ? "Box name cannot be empty" : "Paper content cannot be empty";
      input.focus();
      return;
    }
    if (this.mode === "boxes") this.store.renameBox(item.id, value);
    else this.store.updatePaper(item.id, value);
    this.editing = false;
    this.onCommit(this.mode === "boxes" ? "Box name updated" : "Paper updated");
  }

  addRelations() {
    const ids = [...this.view.querySelectorAll("[data-add-relation]:checked")].map((input) => input.dataset.addRelation);
    if (!ids.length) return;
    if (this.mode === "boxes") this.store.addPapersToBox(this.detail, ids);
    else this.store.addPaperToBoxes(this.detail, ids);
    this.relationMode = null;
    this.onCommit(`Added ${countLabel(ids.length, "item", "items")}`);
  }

  removeRelations() {
    if (!this.selected.size) return;
    const ids = [...this.selected];
    if (this.mode === "boxes") this.store.removePapersFromBox(this.detail, ids);
    else this.store.removePaperFromBoxes(this.detail, ids);
    this.selected.clear();
    this.deletionMode = false;
    this.onCommit(`Removed ${countLabel(ids.length, "item", "items")}`);
  }
}

function escapeText(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function countLabel(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

window.RandomBoxApp.ManagementController = ManagementController;
})();
