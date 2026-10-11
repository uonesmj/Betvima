import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dictPath = path.join(root, 'src/lib/i18n/dictionaries.ts');
const extraPath = path.join(root, 'src/lib/i18n/extra-overrides.ts');

const dictSource = fs.readFileSync(dictPath, 'utf8');
const extraSource = fs.existsSync(extraPath) ? fs.readFileSync(extraPath, 'utf8') : '';

const localeMatch = dictSource.match(/export const LOCALES = \[([\s\S]*?)\] as const/);
if (!localeMatch) throw new Error('LOCALES_NOT_FOUND');

const locales = [...localeMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

const enMatch = dictSource.match(/const en: Dict = \{([\s\S]*?)\n\};/);
if (!enMatch) throw new Error('EN_DICTIONARY_NOT_FOUND');

const keyPattern = /'([^']+)'\s*:/g;
const sourceKeys = [...enMatch[1].matchAll(keyPattern)].map(m => m[1]);
const sourceSet = new Set(sourceKeys);

function extractLocaleBlock(source, locale) {
  const patterns = [
    `'${locale}': {`,
    `"${locale}": {`,
    `const ${locale}: Dict = {`,
    `${locale}: {`
  ];

  let start = -1;
  let marker = '';

  for (const candidate of patterns) {
    const i = source.indexOf(candidate);
    if (i >= 0 && (start < 0 || i < start)) {
      start = i;
      marker = candidate;
    }
  }

  if (start < 0) return null;

  const bodyStart = start + marker.length;
  let depth = 1;
  let quote = null;
  let escaped = false;

  for (let i = bodyStart; i < source.length; i++) {
    const c = source[i];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (c === '\\') {
        escaped = true;
      } else if (c === quote) {
        quote = null;
      }
      continue;
    }

    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      continue;
    }

    if (c === '{') depth++;

    if (c === '}') {
      depth--;
      if (depth === 0) {
        return source.slice(bodyStart, i);
      }
    }
  }

  throw new Error(`UNBALANCED_BLOCK:${locale}`);
}

function getKeys(block) {
  if (!block) return [];
  return [...block.matchAll(keyPattern)].map(m => m[1]);
}

const report = [];

for (const locale of locales) {
  if (locale === 'en') {
    report.push({
      locale,
      keys: sourceKeys.length,
      missing: [],
      extra: [],
      status: 'source'
    });
    continue;
  }

  const dictBlock = extractLocaleBlock(dictSource, locale);
  const extraBlock = extractLocaleBlock(extraSource, locale);

  const keys = [
    ...getKeys(dictBlock),
    ...getKeys(extraBlock)
  ];

  const uniqueKeys = [...new Set(keys)];
  const keySet = new Set(uniqueKeys);

  const missing = sourceKeys.filter(k => !keySet.has(k));
  const extra = uniqueKeys.filter(k => !sourceSet.has(k));

  const duplicateCount = keys.length - uniqueKeys.length;

  let status = 'complete';

  if (missing.length > 0 || extra.length > 0 || duplicateCount > 0) {
    status = 'partial';
  }

  if (uniqueKeys.length === 0) {
    status = 'missing';
  }

  report.push({
    locale,
    keys: uniqueKeys.length,
    missing,
    extra,
    duplicateCount,
    status
  });
}

console.log('=== I18N SUMMARY ===');
console.log(`SOURCE_KEYS=${sourceKeys.length}`);

for (const r of report) {
  console.log(
    `${r.locale.padEnd(6)} keys=${String(r.keys).padStart(3)} missing=${String(r.missing.length).padStart(3)} extra=${String(r.extra.length).padStart(3)} duplicates=${String(r.duplicateCount ?? 0).padStart(3)} ${r.status}`
  );
}

console.log('=== INCOMPLETE LOCALES ===');

for (const r of report) {
  if (r.status !== 'complete' && r.status !== 'source') {
    console.log(
      `${r.locale}: missing=${r.missing.length} extra=${r.extra.length} duplicates=${r.duplicateCount ?? 0}`
    );
  }
}

const incomplete = report.filter(r => r.status === 'partial' || r.status === 'missing').length;
const complete = report.filter(r => r.status === 'complete').length;

console.log('=== TOTAL ===');
console.log(`LOCALES=${locales.length}`);
console.log(`COMPLETE=${complete}`);
console.log(`INCOMPLETE=${incomplete}`);
console.log(`TRANSLATION_PROGRESS=${Math.round((complete / (locales.length - 1)) * 100)}%`);

if (incomplete > 0) process.exitCode = 1;
