(function () {
const MatterApi = window.Matter;

class PaperPhysics {
  constructor(canvas) {
    if (!MatterApi) throw new Error("Matter.js failed to load");
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.engine = MatterApi.Engine.create({ enableSleeping: true });
    this.engine.gravity.y = 1.15;
    this.bodies = [];
    this.paperIds = [];
    this.hiddenPaperId = null;
    this.width = 1;
    this.height = 1;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.enabled = true;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.frame = requestAnimationFrame((time) => this.tick(time));
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nextWidth = Math.round(rect.width);
    const nextHeight = Math.round(rect.height);
    if (nextWidth === this.width && nextHeight === this.height) return;
    this.width = nextWidth;
    this.height = nextHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.rebuild(this.paperIds);
  }

  sync(papers) {
    const ids = papers.map((paper) => paper.id);
    if (ids.join("|") !== this.paperIds.join("|")) this.rebuild(ids);
  }

  setEnabled(enabled) {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.accumulator = 0;
    if (!enabled) {
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      this.frame = null;
      this.context.clearRect(0, 0, this.width, this.height);
      return;
    }
    this.lastTime = performance.now();
    this.frame = requestAnimationFrame((time) => this.tick(time));
  }

  rebuild(ids) {
    this.paperIds = [...ids];
    MatterApi.Composite.clear(this.engine.world, false);
    this.bodies = [];
    const wall = 30;
    const options = { isStatic: true, restitution: 0.1, friction: 0.9 };
    const boundaries = [
      MatterApi.Bodies.rectangle(this.width / 2, this.height + wall / 2 - 3, this.width, wall, options),
      MatterApi.Bodies.rectangle(-wall / 2 + 3, this.height / 2, wall, this.height, options),
      MatterApi.Bodies.rectangle(this.width + wall / 2 - 3, this.height / 2, wall, this.height, options),
      MatterApi.Bodies.rectangle(this.width / 2, -wall / 2 + 3, this.width, wall, options)
    ];
    const radius = Math.max(9, Math.min(18, this.width / 13));
    ids.forEach((id, index) => {
      const columns = Math.max(3, Math.floor(this.width / (radius * 2.4)));
      const x = radius + 8 + (index % columns) * radius * 2.1;
      const y = this.height - radius - 10 - Math.floor(index / columns) * radius * 2.05;
      const body = MatterApi.Bodies.circle(Math.min(x, this.width - radius - 5), Math.max(radius + 5, y), radius, {
        restitution: 0.1,
        friction: 0.4,
        frictionStatic: 0.65,
        frictionAir: 0.035,
        density: 0.006,
        label: id
      });
      MatterApi.Body.rotate(body, Math.random() * Math.PI);
      this.bodies.push(body);
    });
    MatterApi.Composite.add(this.engine.world, [...boundaries, ...this.bodies]);
    if (!this.enabled) this.draw();
  }

  kick(dx = 0, dy = 0, strength = 1, randomized = true) {
    if (!this.enabled) return;
    this.bodies.forEach((body) => {
      MatterApi.Sleeping.set(body, false);
      const randomX = randomized ? (Math.random() - 0.5) * 0.02 * strength : 0;
      const randomY = randomized ? (Math.random() - 0.62) * 0.018 * strength : 0;
      MatterApi.Body.applyForce(body, body.position, {
        x: randomX + Math.max(-0.012, Math.min(0.012, dx * 0.00045)),
        y: randomY + Math.max(-0.012, Math.min(0.012, dy * 0.00045))
      });
      if (randomized) {
        MatterApi.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.5);
      } else {
        const angularVelocity = body.angularVelocity + dx * 0.0025;
        MatterApi.Body.setAngularVelocity(body, Math.max(-0.35, Math.min(0.35, angularVelocity)));
      }
    });
  }

  shake() {
    this.kick((Math.random() - 0.5) * 30, -24, 1.7);
  }

  pick() {
    if (!this.bodies.length) return null;
    const candidates = [...this.bodies].sort((a, b) => a.position.y - b.position.y);
    const topCount = Math.min(3, candidates.length);
    return candidates[Math.floor(Math.random() * topCount)].label;
  }

  hidePaper(id) { this.hiddenPaperId = id; }
  showAllPapers() { this.hiddenPaperId = null; }

  tick(time) {
    if (!this.enabled) return;
    const fixedStep = 1000 / 30;
    const elapsed = Math.max(0, Math.min(250, time - this.lastTime || fixedStep));
    this.lastTime = time;
    this.accumulator = Math.min(this.accumulator + elapsed, fixedStep * 8);
    while (this.accumulator >= fixedStep) {
      MatterApi.Engine.update(this.engine, fixedStep);
      this.accumulator -= fixedStep;
    }
    this.draw();
    this.frame = requestAnimationFrame((next) => this.tick(next));
  }

  draw() {
    const ctx = this.context;
    ctx.clearRect(0, 0, this.width, this.height);
    this.bodies.forEach((body, index) => {
      if (body.label === this.hiddenPaperId) return;
      const radius = body.circleRadius;
      ctx.save();
      ctx.translate(body.position.x, body.position.y);
      ctx.rotate(body.angle);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = index % 3 === 0 ? "rgba(240,235,222,.88)" : "rgba(218,213,201,.86)";
      ctx.strokeStyle = "rgba(108,96,75,.72)";
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-radius * .58, -radius * .18);
      ctx.lineTo(radius * .48, radius * .34);
      ctx.moveTo(-radius * .35, radius * .56);
      ctx.lineTo(radius * .26, -radius * .55);
      ctx.strokeStyle = "rgba(94,82,63,.24)";
      ctx.stroke();
      ctx.restore();
    });
  }
}

window.RandomBoxApp.PaperPhysics = PaperPhysics;
})();
