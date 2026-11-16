// Reads meals-for-sheet.csv, validates every row through normalizeMeal and
// safetyIssues, and updates both meals.json and BUILT_IN_MEALS in meal-rules.js.
// Usage: node scripts/sync-sheet-csv.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { normalizeMeal, safetyIssues } from '../meal-rules.js';

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            row.push(field);
            field = '';
        } else if (ch === '\r' || ch === '\n') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(field);
            field = '';
            if (row.some(cell => cell.trim() !== '')) rows.push(row);
            row = [];
        } else {
            field += ch;
        }
    }
    if (field !== '' || row.length > 0) {
        row.push(field);
        if (row.some(cell => cell.trim() !== '')) rows.push(row);
    }
    return rows;
}

const csvPath = new URL('../meals-for-sheet.csv', import.meta.url);
const jsonPath = new URL('../meals.json', import.meta.url);
const rulesPath = new URL('../meal-rules.js', import.meta.url);

const rawCsv = readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
const rows = parseCsv(rawCsv);
if (rows.length < 2) {
    throw new Error('meals-for-sheet.csv contains no recipe rows.');
}

const headers = rows[0].map(h => h.trim());
const meals = [];
const seenIds = new Set();

for (let r = 1; r < rows.length; r++) {
    const record = {};
    headers.forEach((h, idx) => {
        let val = rows[r][idx] ?? '';
        // Strip leading formula-neutralisation single quote if added by csvCell
        if (val.startsWith("'") && /^'[=+\-@]/.test(val)) val = val.slice(1);
        record[h] = val;
    });
    const normalized = normalizeMeal(record);
    if (!normalized) {
        throw new Error(`Row ${r + 1} (${record['Meal ID'] || 'unknown'}) failed normalizeMeal validation.`);
    }
    if (seenIds.has(normalized.id)) {
        throw new Error(`Duplicate Meal ID "${normalized.id}" at row ${r + 1}.`);
    }
    const issues = safetyIssues(normalized);
    if (issues.length > 0) {
        throw new Error(`Row ${r + 1} (${normalized.id} - ${normalized.name}) failed safety checks: ${issues.join('; ')}`);
    }
    seenIds.add(normalized.id);
    meals.push({
        id: normalized.id,
        name: normalized.name,
        type: normalized.type,
        prepTime: normalized.prepTime,
        servings: normalized.servings,
        difficulty: normalized.difficulty,
        ingredients: normalized.ingredients,
        instructions: normalized.instructions,
        tags: normalized.tags,
        safetyNotes: normalized.safetyNotes,
        nutrition: null,
    });
}

const existingJson = JSON.parse(readFileSync(jsonPath, 'utf8'));
const updatedJson = {
    ...existingJson,
    updatedAt: new Date().toISOString().slice(0, 10),
    meals,
};
writeFileSync(jsonPath, JSON.stringify(updatedJson, null, 2) + '\n');

const rulesSource = readFileSync(rulesPath, 'utf8');
const marker = '// ── Built-in dataset fallback ──';
const idx = rulesSource.indexOf(marker);
const prefix = idx !== -1 ? rulesSource.slice(0, idx) : rulesSource + '\n';
const block = `${marker}\n// Keeps the app usable immediately on startup and when meals.json cannot be fetched.\nexport const BUILT_IN_MEALS = Object.freeze(${JSON.stringify(meals, null, 4)});\n`;
writeFileSync(rulesPath, prefix + block);

console.log(`Synced ${meals.length} validated recipes from meals-for-sheet.csv -> meals.json & meal-rules.js`);
