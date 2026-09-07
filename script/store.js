(function () {
const { loadData, saveData } = window.RandomBoxApp;

class RandomBoxStore {
  constructor() {
    this.data = loadData();
  }

  get boxes() { return this.data.boxes; }
  get papers() { return this.data.papers; }
  get activeBox() { return this.boxes.find((box) => box.id === this.data.activeBoxId) || null; }
  get activePapers() {
    if (!this.activeBox) return [];
    const ids = new Set(this.activeBox.paperIds);
    return this.papers.filter((paper) => ids.has(paper.id));
  }

  commit() { return saveData(this.data); }
  selectBox(id) { if (this.boxes.some((box) => box.id === id)) this.data.activeBoxId = id; }

  createBox(name, paperIds = []) {
    const box = { id: makeId("box"), name, paperIds: [...new Set(paperIds)] };
    this.boxes.push(box);
    this.data.activeBoxId = box.id;
    return box;
  }

  createPaper(text) {
    const existing = this.papers.find((paper) => paper.text.toLocaleLowerCase() === text.toLocaleLowerCase());
    if (existing) return { paper: existing, existing: true };
    const paper = { id: makeId("paper"), text, createdAt: Date.now() };
    this.papers.push(paper);
    return { paper, existing: false };
  }

  renameActiveBox(name) { if (this.activeBox) this.activeBox.name = name; }

  deleteActiveBox() {
    if (!this.activeBox) return;
    const id = this.activeBox.id;
    this.data.boxes = this.boxes.filter((box) => box.id !== id);
    this.data.activeBoxId = this.data.boxes[0]?.id || null;
  }

  addNewPaper(text) {
    if (!this.activeBox) return null;
    const existing = this.papers.find((paper) => paper.text.toLocaleLowerCase() === text.toLocaleLowerCase());
    if (existing) {
      const alreadyIncluded = this.activeBox.paperIds.includes(existing.id);
      if (!alreadyIncluded) this.activeBox.paperIds.push(existing.id);
      return { paper: existing, existing: true, alreadyIncluded };
    }
    const paper = { id: makeId("paper"), text, createdAt: Date.now() };
    this.papers.push(paper);
    this.activeBox.paperIds.push(paper.id);
    return { paper, existing: false, alreadyIncluded: false };
  }

  addPapersToActive(ids) {
    if (!this.activeBox) return;
    this.activeBox.paperIds.push(...ids.filter((id) => !this.activeBox.paperIds.includes(id)));
  }

  removePaperFromActive(id) {
    if (this.activeBox) this.activeBox.paperIds = this.activeBox.paperIds.filter((paperId) => paperId !== id);
  }

  updatePaper(id, text) {
    const paper = this.papers.find((item) => item.id === id);
    if (paper) paper.text = text;
  }

  deletePaper(id) {
    this.data.papers = this.papers.filter((paper) => paper.id !== id);
    this.boxes.forEach((box) => { box.paperIds = box.paperIds.filter((paperId) => paperId !== id); });
  }

  deleteBoxes(ids) {
    const deleted = new Set(ids);
    this.data.boxes = this.boxes.filter((box) => !deleted.has(box.id));
    if (!this.boxes.some((box) => box.id === this.data.activeBoxId)) this.data.activeBoxId = this.boxes[0]?.id || null;
  }

  deletePapers(ids) {
    const deleted = new Set(ids);
    this.data.papers = this.papers.filter((paper) => !deleted.has(paper.id));
    this.boxes.forEach((box) => { box.paperIds = box.paperIds.filter((id) => !deleted.has(id)); });
  }

  addPapersToBox(boxId, paperIds) {
    const box = this.boxes.find((item) => item.id === boxId);
    if (box) box.paperIds.push(...paperIds.filter((id) => !box.paperIds.includes(id)));
  }

  removePapersFromBox(boxId, paperIds) {
    const box = this.boxes.find((item) => item.id === boxId);
    const removed = new Set(paperIds);
    if (box) box.paperIds = box.paperIds.filter((id) => !removed.has(id));
  }

  addPaperToBoxes(paperId, boxIds) {
    const selected = new Set(boxIds);
    this.boxes.forEach((box) => {
      if (selected.has(box.id) && !box.paperIds.includes(paperId)) box.paperIds.push(paperId);
    });
  }

  removePaperFromBoxes(paperId, boxIds) {
    const selected = new Set(boxIds);
    this.boxes.forEach((box) => {
      if (selected.has(box.id)) box.paperIds = box.paperIds.filter((id) => id !== paperId);
    });
  }
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

window.RandomBoxApp.RandomBoxStore = RandomBoxStore;
})();
