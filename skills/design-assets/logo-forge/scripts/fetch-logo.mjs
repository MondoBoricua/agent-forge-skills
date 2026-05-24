#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API_BASE = 'https://api.svgl.app';

function usage(exitCode = 0) {
  const text = `
Usage:
  fetch-logo.mjs search <query>
  fetch-logo.mjs fetch <query> [--out-dir <dir>] [--variant light|dark|auto] [--wordmark]
  fetch-logo.mjs categories

Examples:
  fetch-logo.mjs search vercel
  fetch-logo.mjs fetch vercel --out-dir public/logos
  fetch-logo.mjs fetch axiom --variant dark --out-dir public/logos
  fetch-logo.mjs fetch github --wordmark --variant light --out-dir assets/logos
`;
  console.log(text.trim());
  process.exit(exitCode);
}

function parseArgs(argv) {
  const [command, query, ...rest] = argv;
  const options = {
    command,
    query,
    outDir: '.',
    variant: 'auto',
    wordmark: false,
  };

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--out-dir') {
      options.outDir = rest[++i];
    } else if (arg === '--variant') {
      options.variant = rest[++i];
    } else if (arg === '--wordmark') {
      options.wordmark = true;
    } else if (arg === '--help' || arg === '-h') {
      usage(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!['search', 'fetch', 'categories'].includes(command)) {
    usage(command ? 1 : 0);
  }
  if ((command === 'search' || command === 'fetch') && !query) {
    throw new Error(`${command} requires a query`);
  }
  if (!['auto', 'light', 'dark'].includes(options.variant)) {
    throw new Error('--variant must be auto, light, or dark');
  }

  return options;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${url}`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { accept: 'image/svg+xml,text/plain,*/*' },
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${url}`);
  }
  return response.text();
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fieldUrl(value, variant) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (variant !== 'auto' && value[variant]) return value[variant];
  return value.light || value.dark || null;
}

function selectedVariantName(value, variant) {
  if (!value || typeof value === 'string') return null;
  if (variant !== 'auto' && value[variant]) return variant;
  return value.light ? 'light' : 'dark';
}

function pickBest(results, query) {
  const normalized = query.toLowerCase();
  return (
    results.find((item) => item.title.toLowerCase() === normalized) ||
    results.find((item) => item.title.toLowerCase().includes(normalized)) ||
    results[0]
  );
}

function printResult(item, index = null) {
  const prefix = index == null ? '' : `${index + 1}. `;
  const category = Array.isArray(item.category) ? item.category.join(', ') : item.category;
  const hasTheme = typeof item.route === 'object';
  const hasWordmark = Boolean(item.wordmark);
  console.log(`${prefix}${item.title} [${category}]`);
  console.log(`   url: ${item.url}`);
  console.log(`   route: ${hasTheme ? 'light/dark variants' : item.route}`);
  if (hasWordmark) console.log('   wordmark: available');
  if (item.brandUrl) console.log(`   brandUrl: ${item.brandUrl}`);
}

async function search(query) {
  const url = `${API_BASE}?search=${encodeURIComponent(query)}`;
  const results = await fetchJson(url);
  if (!Array.isArray(results) || results.length === 0) {
    console.log(`No SVGL results for "${query}"`);
    return;
  }
  results.slice(0, 10).forEach(printResult);
}

async function categories() {
  const results = await fetchJson(`${API_BASE}/categories`);
  for (const item of results) {
    console.log(`${item.category}\t${item.total}`);
  }
}

async function fetchLogo(options) {
  const results = await fetchJson(`${API_BASE}?search=${encodeURIComponent(options.query)}`);
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(`No SVGL results for "${options.query}"`);
  }

  const item = pickBest(results, options.query);
  const assetField = options.wordmark ? item.wordmark : item.route;
  const assetUrl = fieldUrl(assetField, options.variant);
  if (!assetUrl) {
    throw new Error(`${item.title} does not have a ${options.wordmark ? 'wordmark' : 'logo'} asset for variant ${options.variant}`);
  }

  const variantName = selectedVariantName(assetField, options.variant);
  const pieces = [slug(item.title)];
  if (options.wordmark) pieces.push('wordmark');
  if (variantName) pieces.push(variantName);
  const filename = `${pieces.join('-')}.svg`;
  const outputPath = path.resolve(options.outDir, filename);

  const svg = await fetchText(assetUrl);
  if (!svg.trimStart().startsWith('<svg')) {
    throw new Error(`Downloaded asset does not look like SVG: ${assetUrl}`);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, svg);

  printResult(item);
  console.log(`   asset: ${assetUrl}`);
  console.log(`   wrote: ${outputPath}`);
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === 'search') {
    await search(options.query);
  } else if (options.command === 'categories') {
    await categories();
  } else if (options.command === 'fetch') {
    await fetchLogo(options);
  }
} catch (error) {
  console.error(`logo-forge: ${error.message}`);
  process.exit(1);
}
