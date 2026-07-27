#!/usr/bin/env npx tsx
// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.
/**
 * Upload docs, search them, then delete the uploaded documents.
 *
 * npx tsx examples/02_docs.ts
 */

import { readdirSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { Nctx0Client } from "../src/index.js";

const ACCESS_KEY = "~~";
const WORKSPACE_ID = "~~";
const BASE_URL = "https://actx0.com";

const DOCS_DIR = join(dirname(fileURLToPath(import.meta.url)), "docs");
const LABELS = { tag: "docs", team: "platform-team" };

const QUERIES = [
  "Where does Mara live?",
  "What kind of work does Mara do?",
  "Who is in Mara's family?",
  "What are Mara's hobbies?",
];

function titleFromStem(stem: string): string {
  return stem
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function main(): Promise<void> {
  const localFiles = readdirSync(DOCS_DIR)
    .filter((name) => name.endsWith(".txt"))
    .sort()
    .map((name) => join(DOCS_DIR, name));
  if (localFiles.length === 0) {
    throw new Error(`no .txt files in ${DOCS_DIR}`);
  }

  const client = new Nctx0Client({
    accessKey: ACCESS_KEY,
    workspaceId: WORKSPACE_ID,
    baseUrl: BASE_URL,
  });

  const listed = await client.document.list({ limit: 100 });
  console.log(`remote documents (${listed.total}):`);
  for (const doc of listed.documents) {
    console.log(`  ${doc.filename} checksum=${doc.checksum} status=${doc.status}`);
  }

  const docIds: string[] = [];
  console.log(`\nlocal files (${localFiles.length}):`);
  for (const path of localFiles) {
    const existing = await client.document.exists({ file: path, labels: LABELS });
    if (existing != null) {
      console.log(`  skip  ${basename(path)} (already uploaded ${existing.id})`);
      docIds.push(existing.id);
      continue;
    }

    const stem = basename(path, extname(path));
    const uploaded = await client.document.upload({
      file: path,
      title: titleFromStem(stem),
      labels: LABELS,
    });
    console.log(`  upload ${basename(path)} -> ${uploaded.id} checksum=${uploaded.checksum}`);
    docIds.push(uploaded.id);
  }

  console.log("\nwaiting 120 seconds for indexing...");
  await sleep(120_000);

  console.log("\nsearch");
  console.log("=".repeat(40));
  for (const query of QUERIES) {
    const results = await client.document.search({
      query,
      labels: LABELS,
      limit: 3,
    });
    console.log(`\nquery: ${query}`);
    console.log("-".repeat(40));
    if (results.results.length === 0) {
      console.log("  (no hits)");
      continue;
    }
    for (const hit of results.results) {
      console.log(`  [${hit.score.toFixed(2)}] ${hit.text}`);
    }
  }

  console.log("\ndelete");
  console.log("=".repeat(40));
  for (const docId of docIds) {
    await client.document.delete(docId);
    console.log(`  deleted ${docId}`);
  }

  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
