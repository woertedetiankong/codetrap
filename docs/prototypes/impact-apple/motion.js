// A critically damped spring, retargeted from its current presentation value.
// Input stays available during motion; dragging carries velocity into settling.
export function createSheet(dialog, reducedMotion) {
  let position = 0, velocity = 0, target = 0, frame = 0, last = 0;
  let closing = false, opener = null, dragging = null;
  const mobile = () => matchMedia('(max-width: 760px)').matches;
  const extent = () => mobile() ? dialog.offsetHeight : dialog.offsetWidth;
  const paint = () => {
    dialog.style.transform = `translate${mobile() ? 'Y' : 'X'}(${position}px)`;
    dialog.style.setProperty('--dim', String(.2 * Math.max(0, 1 - position / Math.max(1, extent()))));
  };
  function finish() {
    if (!closing) return;
    dialog.close(); closing = false;
    if (opener?.isConnected) opener.focus({preventScroll:true});
  }
  function tick(now) {
    const dt = Math.min((now - last) / 1000 || .016, .04); last = now;
    const omega = 2 * Math.PI / .34, delta = position - target;
    const beta = velocity + omega * delta, decay = Math.exp(-omega * dt);
    position = target + (delta + beta * dt) * decay;
    velocity = (velocity - omega * beta * dt) * decay;
    paint();
    if (Math.abs(position - target) < .35 && Math.abs(velocity) < 3) {
      position = target; velocity = 0; paint(); frame = 0; finish();
    } else frame = requestAnimationFrame(tick);
  }
  function settle(next, close = false) {
    cancelAnimationFrame(frame); closing = close; target = next;
    if (reducedMotion()) {position = next; velocity = 0; paint(); finish(); return;}
    last = performance.now(); frame = requestAnimationFrame(tick);
  }
  function close() {if (dialog.open) settle(extent() + 10, true);}
  function show(title, html) {
    const wasOpen = dialog.open;
    dialog.querySelector('#sheet-title').textContent = title;
    dialog.querySelector('#sheet-content').innerHTML = html;
    if (!wasOpen) {
      opener = document.activeElement;
      dialog.showModal(); position = extent() + 10; velocity = 0;
    }
    closing = false; paint(); settle(0);
    (dialog.querySelector('.sheet-content input:not([type=checkbox])') || dialog.querySelector('button'))?.focus({preventScroll:true});
  }
  dialog.addEventListener('cancel', e => {e.preventDefault(); close();});
  dialog.addEventListener('click', e => {if (e.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) close();
  }});
  const handle = dialog.querySelector('[data-sheet-drag]');
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    cancelAnimationFrame(frame); frame = 0; closing = false;
    const axis = mobile() ? 'clientY' : 'clientX';
    dragging = {id:e.pointerId, axis, start:e[axis], origin:position, samples:[[performance.now(),position]]};
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', e => {
    if (!dragging || e.pointerId !== dragging.id) return;
    const raw = dragging.origin + e[dragging.axis] - dragging.start;
    position = raw < 0 ? raw * .12 : raw;
    const now = performance.now(); dragging.samples.push([now,position]);
    dragging.samples = dragging.samples.filter(([time]) => now - time <= 80);
    paint();
  });
  function release(e, cancelled = false) {
    if (!dragging || e.pointerId !== dragging.id) return;
    const now = performance.now(), samples = dragging.samples.filter(([time]) => now - time <= 80);
    const first = samples[0], end = samples.at(-1);
    velocity = first && end && end[0] > first[0] ? (end[1] - first[1]) / (end[0] - first[0]) * 1000 : 0;
    dragging = null;
    const projected = position + (velocity / 1000) * .994 / (1 - .994);
    const dismiss = !cancelled && projected > extent() * .35;
    settle(dismiss ? extent() + 10 : 0, dismiss);
  }
  handle.addEventListener('pointerup', e => release(e));
  handle.addEventListener('pointercancel', e => release(e,true));
  window.addEventListener('resize', () => {if (dialog.open && !dragging) settle(closing ? extent() + 10 : 0, closing);});
  return {show,close};
}
