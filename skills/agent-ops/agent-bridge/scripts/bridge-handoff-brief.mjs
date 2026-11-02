/**
 * Lectura/escritura del brief markdown + bloque JSON.
 */
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { writeAtomicDurable } from './bridge-handoff-durable.mjs';
import { extractContractJson } from './bridge-verify';
import { validateHandoffContract } from './bridge-handoff-contract-b.mjs';
import { assertRealFileTarget } from './bridge-handoff-paths.mjs';

const MAX_BRIEF_BYTES = 1024 * 1024;

export function loadBriefFile(briefPath) {
  if (!existsSync(briefPath)) return { error: 'not_found' };
  const buf = readFileSync(briefPath);
  if (buf.length > MAX_BRIEF_BYTES) return { error: 'brief_too_large' };
  const markdown = buf.toString('utf8');
  const extracted = extractContractJson(markdown);
  if (extracted.error) return { error: extracted.error };
  const valid = validateHandoffContract(extracted.contract);
  if (!valid.ok) return { error: 'invalid_contract', detail: valid };
  return { markdown, contract: extracted.contract };
}

/** Reemplaza el bloque JSON conservando el resto del markdown. */
export function embedContractInMarkdown(markdown, contract) {
  const json = JSON.stringify(contract, null, 2);
  const re = /```json\s*[\s\S]*?```/i;
  if (!re.test(markdown)) {
    return `${markdown.trim()}\n\n## Contrato (JSON)\n\n\`\`\`json\n${json}\n\`\`\`\n`;
  }
  return markdown.replace(re, `\`\`\`json\n${json}\n\`\`\``);
}

export function writeBriefAtomic(briefPath, markdown, contract) {
  const target = assertRealFileTarget(briefPath);
  if (!target.ok) return { error: target.reason };
  mkdirSync(dirname(briefPath), { recursive: true });
  const body = embedContractInMarkdown(markdown, contract);
  try {
    writeAtomicDurable(briefPath, body);
    return { ok: true };
  } catch {
    return { error: 'write_failed' };
  }
}
