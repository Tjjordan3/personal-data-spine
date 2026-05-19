import { open } from "@tauri-apps/plugin-dialog";
import { readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { insertItem, listItems } from "../db/items";

async function hashPath(path: string): Promise<string> {
  const data = new TextEncoder().encode(path);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function titleFromMarkdown(fileName: string, body: string): string {
  const heading = body.match(/^#\s+(.+)$/m);
  if (heading?.[1]) {
    return heading[1].trim().slice(0, 200);
  }
  const base = fileName.replace(/\.md$/i, "").replace(/[_-]+/g, " ");
  return base.trim() || "Imported note";
}

async function collectMdFiles(
  dir: string,
  out: string[],
): Promise<void> {
  const entries = await readDir(dir);
  for (const entry of entries) {
    const full = `${dir}/${entry.name}`.replace(/\\/g, "/");
    if (entry.isDirectory) {
      await collectMdFiles(full, out);
    } else if (entry.name.toLowerCase().endsWith(".md")) {
      out.push(full);
    }
  }
}

async function existingImportPaths(): Promise<Set<string>> {
  const notes = await listItems({ type: "note", status: "all", limit: 5000 });
  const paths = new Set<string>();
  for (const note of notes) {
    const p = note.metadata.import_source_path as string | undefined;
    if (p) paths.add(p);
  }
  return paths;
}

export async function importNotesFromFolder(): Promise<{
  imported: number;
  skipped: number;
}> {
  const picked = await open({
    title: "Import notes from folder",
    directory: true,
    multiple: false,
  });
  if (!picked || Array.isArray(picked)) {
    return { imported: 0, skipped: 0 };
  }

  const files: string[] = [];
  await collectMdFiles(picked, files);
  const seen = await existingImportPaths();

  let imported = 0;
  let skipped = 0;

  for (const filePath of files) {
    if (seen.has(filePath)) {
      skipped += 1;
      continue;
    }
    let body: string;
    try {
      body = await readTextFile(filePath);
    } catch {
      skipped += 1;
      continue;
    }
    const fileName = filePath.split(/[/\\]/).pop() ?? "note.md";
    const title = titleFromMarkdown(fileName, body);
    const pathHash = await hashPath(filePath);
    const trimmed = body.trim();
    const content = /^#\s+/m.test(trimmed)
      ? trimmed
      : trimmed
        ? `# ${title}\n\n${trimmed}`
        : `# ${title}`;

    await insertItem({
      type: "note",
      content,
      tags: ["#imported", "#note"],
      source: "markdown-folder-import",
      metadata: {
        import_source_path: filePath,
        import_source_hash: pathHash,
        import_title: title,
      },
    });
    seen.add(filePath);
    imported += 1;
  }

  return { imported, skipped };
}
