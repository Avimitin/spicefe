import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compile } from '@mdx-js/mdx';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const documentsDirectory = resolve(projectRoot, 'src/docs');

export async function compileDocuments(directory = documentsDirectory) {
  const directoryEntries = await readdir(directory);
  const sourceNames = directoryEntries
    .filter((name) => name.endsWith('.mdx'))
    .sort();

  if (sourceNames.length === 0) {
    throw new Error(`No MDX documents found in ${directory}`);
  }

  const sourceNameSet = new Set(sourceNames);
  for (const generatedName of directoryEntries.filter((name) => name.endsWith('.mdx.js'))) {
    if (!sourceNameSet.has(generatedName.slice(0, -3))) {
      await unlink(resolve(directory, generatedName));
    }
  }

  const outputs = [];
  for (const sourceName of sourceNames) {
    const sourcePath = resolve(directory, sourceName);
    const outputPath = `${sourcePath}.js`;
    const source = await readFile(sourcePath, 'utf8');
    const compiled = await compile(source, {
      development: false,
      jsx: false,
      outputFormat: 'program',
    });
    await writeFile(
      outputPath,
      `// Generated from ${sourceName} by tools/compile-mdx.mjs.\n${String(compiled)}`,
    );
    outputs.push(outputPath);
  }

  return outputs;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const output of await compileDocuments()) {
    process.stdout.write(`${output}\n`);
  }
}
