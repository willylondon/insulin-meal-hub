// Writes meals-for-sheet.csv from meals.json, in the column layout the
// Google Sheet uses, so the sheet can be refreshed from the canonical dataset (not clinically reviewed).
// Usage: node scripts/export-sheet-csv.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { csvCell } from '../meal-rules.js';

const { meals } = JSON.parse(readFileSync(new URL('../meals.json', import.meta.url)));
const header = ['Meal ID', 'Meal Name', 'Type', 'Prep Time', 'Servings', 'Difficulty', 'Ingredients', 'Instructions', 'Tags', 'Safety Notes'];
const rows = meals.map(m => [
    m.id, m.name, m.type, m.prepTime, m.servings, m.difficulty,
    m.ingredients.map(i => `• ${i}`).join('\n'),
    m.instructions.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    m.tags.join(', '),
    m.safetyNotes.join('\n'),
]);
const csv = [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
writeFileSync(new URL('../meals-for-sheet.csv', import.meta.url), csv);
console.log(`Wrote ${rows.length} meals to meals-for-sheet.csv`);
