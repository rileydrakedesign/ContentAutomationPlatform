// Compiles the app's globals.css (Tailwind v4 + design tokens) into a static
// stylesheet design-sync can ship as cfg.cssEntry. Tailwind only runs at build
// time, so the converter (which just copies CSS) needs a pre-compiled file.
import { readFileSync, writeFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const INPUT = 'src/app/globals.css';
const OUT = '.design-sync/compiled.css';

const css = readFileSync(INPUT, 'utf8');
const result = await postcss([tailwind()]).process(css, { from: INPUT, to: OUT });
writeFileSync(OUT, result.css);
console.error(`compiled ${(result.css.length / 1024).toFixed(0)} KB → ${OUT}`);
