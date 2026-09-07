(function () {
const STORAGE_KEY = "random-box-local-v1";

function loadData() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed || !Array.isArray(parsed.boxes) || !Array.isArray(parsed.papers)) return emptyData();
    parsed.boxes.forEach((box) => {
      box.paperIds = Array.isArray(box.paperIds) ? [...new Set(box.paperIds)] : [];
    });
    if (!parsed.boxes.some((box) => box.id === parsed.activeBoxId)) {
      parsed.activeBoxId = parsed.boxes[0]?.id || null;
    }
    return parsed;
  } catch {
    return emptyData();
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function emptyData() {
  return { boxes: [], papers: [], activeBoxId: null };
}

window.RandomBoxApp = Object.assign(window.RandomBoxApp || {}, { loadData, saveData });
})();
