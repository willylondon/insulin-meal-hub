import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/import\s*\{[\s\S]*?\}\s*from '\.\/meal-rules\.js';/, '');
function harness() {
    const heading = { attributes: {}, setAttribute(k, v) { this.attributes[k] = v; }, focus() { this.focused = true; } };
    const classes = () => ({ add() {}, remove() {} });
    const pane = { hidden: true, classList: classes(), querySelector: () => heading };
    const button = { dataset: { tab: 'settings' }, classList: classes(), setAttribute() {}, removeAttribute() {}, addEventListener(_, fn) { this.click = fn; } };
    const context = { DEFAULT_SETTINGS: {}, document: { readyState: 'loading', addEventListener() {},
        querySelectorAll(selector) { return selector === '.nav-btn' ? [button] : [pane]; },
        getElementById(id) { return id === 'tab-settings' ? pane : { scrollTo() {} }; },
    } };
    vm.runInNewContext(source + '\nglobalThis.subject = { bindNav, nutritionText };', context);
    return { ...context.subject, button, pane, heading };
}
test('section navigation moves focus to the newly visible heading', () => {
    const h = harness(); h.bindNav(); h.button.click();
    assert.equal(h.pane.hidden, false);
    assert.equal(h.heading.attributes.tabindex, '-1');
    assert.equal(h.heading.focused, true);
});
test('nutrition display never presents caller-supplied verification as fact', () => {
    const h = harness();
    const text = h.nutritionText({ source: 'curated', nutrition: { verified: true, source: 'claimed review', calories: 400, carbs: 20, protein: 30, fiber: 5 } });
    assert.match(text, /not verified/);
    assert.match(text, /Not used for recipe filtering/);
    assert.ok(!text.includes('claimed review'));
    assert.match(h.nutritionText({ nutrition: null }), /not been checked/);
});
