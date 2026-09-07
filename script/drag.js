(function () {
class BoxDragController {
  constructor(positioner, playground, onMove) {
    this.positioner = positioner;
    this.playground = playground;
    this.onMove = onMove;
    this.offset = { x: 0, y: 0 };
    this.drag = null;
    this.pendingMovement = { x: 0, y: 0 };
    this.moveFrame = null;
    positioner.addEventListener("pointerdown", (event) => this.start(event));
    positioner.addEventListener("pointermove", (event) => this.move(event));
    positioner.addEventListener("pointerup", () => this.end());
    positioner.addEventListener("pointercancel", () => this.end());
    window.addEventListener("resize", () => this.set(this.offset.x, this.offset.y));
  }

  start(event) {
    if (event.button !== 0) return;
    this.positioner.setPointerCapture(event.pointerId);
    this.drag = { startX: event.clientX, startY: event.clientY, originX: this.offset.x, originY: this.offset.y, lastX: event.clientX, lastY: event.clientY };
    this.positioner.classList.add("dragging");
  }

  move(event) {
    if (!this.drag) return;
    this.set(this.drag.originX + event.clientX - this.drag.startX, this.drag.originY + event.clientY - this.drag.startY);
    this.pendingMovement.x += event.clientX - this.drag.lastX;
    this.pendingMovement.y += event.clientY - this.drag.lastY;
    this.drag.lastX = event.clientX;
    this.drag.lastY = event.clientY;
    if (this.moveFrame === null) {
      this.moveFrame = requestAnimationFrame(() => this.flushMovement());
    }
  }

  end() {
    if (this.moveFrame !== null) {
      cancelAnimationFrame(this.moveFrame);
      this.moveFrame = null;
    }
    this.flushMovement();
    this.drag = null;
    this.positioner.classList.remove("dragging");
  }

  flushMovement() {
    this.moveFrame = null;
    const { x, y } = this.pendingMovement;
    this.pendingMovement = { x: 0, y: 0 };
    if (x || y) this.onMove(x, y);
  }

  reset() { this.set(0, 0); }

  set(x, y) {
    const stage = this.playground.getBoundingClientRect();
    const box = this.positioner.getBoundingClientRect();
    const maxX = Math.max(0, (stage.width - box.width) / 2 - 12);
    const maxY = Math.max(0, (stage.height - box.height) / 2 - 12);
    this.offset = { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
    this.positioner.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px)`;
  }
}

window.RandomBoxApp.BoxDragController = BoxDragController;
})();
