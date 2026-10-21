import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL || 'http://localhost:5174/tu-valu/';
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch({ headless: true });
  const page = await browser.newPage({ hasTouch: true });
  await page.goto(base);
  await page.evaluate(async () => {
    const { vGlideSelect } = await import('/tu-valu/src/lib/glideSelect.js');
    document.body.innerHTML = `<div class="student-list" style="width:300px;margin:40px"><button class="picker-item">One <span class="row-checkbox"></span></button><button class="picker-item">Two <span class="row-checkbox"></span></button><button class="picker-item">Three <span class="row-checkbox"></span></button></div><style>.picker-item{display:flex;justify-content:space-between;width:300px;height:60px}.row-checkbox{width:30px;height:30px;display:block}</style>`;
    window.checked = [false, false, false];
    window.opened = 0;
    document.querySelectorAll('.row-checkbox').forEach((el, index) => {
      const value = { group: 'students', checked: false, toggle() {
        this.checked = !this.checked;
        window.checked[index] = this.checked;
        vGlideSelect.updated(el, { value });
      } };
      el.parentElement.addEventListener('click', () => window.opened++);
      vGlideSelect.mounted(el, { value });
    });
  });
  const row = page.locator('.picker-item').first();
  await row.click({ position: { x: 30, y: 30 } });
  assert.equal(await page.evaluate(() => window.opened), 1);
  const bounds = await row.boundingBox();
  await page.mouse.move(bounds.x + 20, bounds.y + 20);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 200, bounds.y + 155, { steps: 10 });
  assert.deepEqual(await page.evaluate(() => window.checked), [true, true, true]);
  await page.mouse.move(bounds.x + 200, bounds.y + 75, { steps: 4 });
  assert.deepEqual(await page.evaluate(() => window.checked), [true, true, false]);
  await page.mouse.up();
  assert.equal(await page.evaluate(() => window.opened), 1);
  // Synthetic touch pointers cover checkbox painting across full row bodies.
  await page.evaluate(() => {
    const checkbox = document.querySelector('.row-checkbox');
    const rect = checkbox.getBoundingClientRect();
    const row = checkbox.parentElement.getBoundingClientRect();
    checkbox.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 8, isPrimary: true, pointerType: 'touch', button: 0, clientX: rect.x + 5, clientY: rect.y + 5 }));
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 8, pointerType: 'touch', clientX: row.x + 30, clientY: row.y + 150 }));
    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 8, pointerType: 'touch' }));
  });
  assert.deepEqual(await page.evaluate(() => window.checked), [false, false, false]);
  await browser.close();
  console.log(`${engine.name()}: row clicks, marquee expansion/contraction, click suppression, and touch deselection passed`);
}
