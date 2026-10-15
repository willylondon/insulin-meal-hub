import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safetyIssues } from '../meal-rules.js';

const recipe = (ingredients, instructions = ['Mix and serve.']) => ({ name: 'Test recipe', ingredients, instructions });
const rejected = (ingredients, instructions) => assert.ok(safetyIssues(recipe(ingredients, instructions)).length > 0);
const accepted = (ingredients, instructions) => assert.deepEqual(safetyIssues(recipe(ingredients, instructions)), []);

test('ackee: canned product and unrelated fresh herbs are accepted', () => {
    accepted(['1 cup commercially canned ackee, drained', 'Fresh thyme'], ['Warm the canned ackee with fresh thyme.']);
    accepted(['1 can of ackee, drained']);
    accepted(['Ackee (commercially canned), drained']);
});

test('ackee: raw, uncanned, home-canned and alternatives fail closed', () => {
    for (const ingredient of ['uncanned ackee', 'not canned ackee', 'home-canned ackee', 'fresh ackee or canned ackee', 'ackee (fresh or canned)', 'ackee and canned tomatoes', '1 cup ackee']) {
        rejected([ingredient], ['Warm through.']);
    }
    rejected(['canned ackee'], ['If fresh, boil until tender.']);
    rejected(['canned ackee'], ['Use fresh ackee instead.']);
});

test('poultry: cooked modifiers must be affirmative and adjacent to the poultry', () => {
    accepted(['fully cooked chicken', 'fresh greens']);
    accepted(['½ cup cooked chicken, shredded']);
    for (const ingredient of ['uncooked chicken', 'not cooked chicken', 'not fully cooked chicken', 'partially cooked chicken', 'par-cooked chicken', 'raw chicken and cooked rice', 'chicken, cook before serving']) {
        rejected([ingredient]);
    }
    accepted(['uncooked turkey'], ['Cook until the thickest part reaches 165°F (74°C).']);
});

test('poultry: oven temperatures, negated endpoints and contradictory units are not safety endpoints', () => {
    for (const instruction of ['Preheat oven to 165°F.', 'Cook chicken at 165°F.', 'Do not cook to 165°F.', 'Cook to 145°F instead of 165°F.', 'Cook until it reaches 1165°F.', 'Cook until it reaches 165°F (63°C).', 'Cook until it reaches 74°F.', 'Cook until it reaches 164°F.']) {
        rejected(['chicken breast'], [instruction]);
    }
    accepted(['chicken breast'], ['Cook until a thermometer reads 165°F.']);
    accepted(['turkey breast'], ['Cook until the centre reaches 74°C.']);
});

test('reheated poultry and poultry egg dishes require 165°F, including previously cooked poultry', () => {
    rejected(['cooked chicken', 'eggs'], ['Bake until a thermometer in the centre reads 160°F (71°C).']);
    rejected(['cooked chicken'], ['Reheat until warm.']);
    accepted(['cooked chicken', 'eggs'], ['Bake until a thermometer in the centre reads 165°F (74°C).']);
});

test('ground meats require 160°F, while ground poultry requires 165°F', () => {
    for (const ingredient of ['ground pork', 'minced beef', 'beef meatballs', 'pork sausage']) {
        rejected([ingredient], ['Cook until the centre reaches 145°F (63°C).', 'Rest 3 minutes.']);
        accepted([ingredient], ['Cook until the centre reaches 160°F (71°C).']);
    }
    rejected(['ground turkey'], ['Cook until the centre reaches 160°F (71°C).']);
    accepted(['ground turkey'], ['Cook until the centre reaches 165°F (74°C).']);
});

test('whole meat cuts need a food endpoint and an affirmative rest of at least three minutes', () => {
    for (const ingredient of ['pork loin', 'beef steak', 'lamb chops', 'goat meat', 'oxtail']) {
        rejected([ingredient], ['Cook until the centre reaches 145°F (63°C).']);
        rejected([ingredient], ['Cook until the centre reaches 145°F.', 'Rest 2 minutes.']);
        rejected([ingredient], ['Cook until the centre reaches 145°F.', 'Do not rest 3 minutes.']);
        accepted([ingredient], ['Cook until the centre reaches 145°F (63°C).', 'Rest at least 3 minutes before slicing.']);
    }
});

test('raw and salt fish need a food endpoint, canned fish does not', () => {
    for (const ingredient of ['salmon fillet', 'snapper', 'saltfish soaked overnight', 'tuna steak']) {
        rejected([ingredient], ['Warm through.']);
        rejected([ingredient], ['Preheat oven to 145°F.']);
        accepted([ingredient], ['Cook until a thermometer in the fish reads 145°F (63°C).']);
    }
    accepted(['1 can sardines in oil']);
    accepted(['1 can tuna in water, drained']);
    accepted(['canned salmon']);
});

test('seasonings and vegetarian meals do not trigger meat endpoint requirements', () => {
    accepted(['ground black pepper', 'minced onion', 'chicken broth', 'fish sauce', 'tofu']);
    // A broth mention must not hide raw flesh in the same ingredient line.
    rejected(['raw chicken with chicken broth'], ['Simmer briefly.']);
});

test('a food temperature for another ingredient cannot satisfy the poultry or fish requirement', () => {
    rejected(['raw chicken', 'salmon'], ['Cook chicken until it reaches 165°F.', 'Warm salmon briefly.']);
    rejected(['raw chicken', 'salmon'], ['Cook salmon until it reaches 165°F.', 'Warm chicken briefly.']);
    accepted(['raw chicken', 'salmon'], ['Cook chicken until its internal temperature reaches 165°F.', 'Cook salmon until its internal temperature reaches 145°F.']);
});

test('ambiguous short rest ranges and negated rest instructions fail closed', () => {
    rejected(['pork loin'], ['Cook until the centre reaches 145°F.', 'Rest 1–3 minutes.']);
    rejected(['pork loin'], ['Cook until the centre reaches 145°F.', 'Rest 1 minute, not 3 minutes.']);
});
