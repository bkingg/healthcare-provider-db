import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

/** Private file storage for uploaded documents. Development uses a local
 * folder (FILE_STORAGE_DIR, default ./storage — git-ignored); hosting will
 * swap in a cloud store behind the same three functions. Files are never
 * served directly: routes read them after checking who's asking. */

const root = resolve(process.env.FILE_STORAGE_DIR ?? join(process.cwd(), "storage"));

/** The key → a path inside the storage folder (and never outside it). */
function pathFor(key: string): string {
  const p = resolve(root, key);
  if (!p.startsWith(root + sep)) throw new Error("Invalid storage key");
  return p;
}

export async function putFile(key: string, bytes: Uint8Array): Promise<void> {
  const p = pathFor(key);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, bytes, { flag: "wx" });
}

export async function readStoredFile(key: string): Promise<Buffer> {
  return readFile(pathFor(key));
}

export async function removeStoredFile(key: string): Promise<void> {
  await rm(pathFor(key), { force: true });
}
