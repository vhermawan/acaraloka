import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const appDir = join(root, "src/app");
const doc = readFileSync(join(root, "docs/security/authorization.md"), "utf8");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

const files = walk(appDir).map((file) => relative(root, file));
const read = (file: string) => readFileSync(join(root, file), "utf8");

const actionFiles = files.filter((file) => file.endsWith("actions.ts") && read(file).startsWith('"use server"'));
const routeFiles = files.filter((file) => file.endsWith("/route.ts"));
const pageFiles = files.filter((file) => file.endsWith("/page.tsx"));
const protectedPages = pageFiles.filter((file) => /^src\/app\/(me|organizer|admin)\//.test(file));

const GUARD_PATTERN = /require(Participant|Organizer|EventOwner|Admin|User)\(/;
const PUBLIC_PROTECTED_PAGES = new Set(["src/app/organizer/login/page.tsx"]);

const rows = doc
  .split("\n")
  .filter((line) => line.startsWith("| ") && /\| `src\//.test(line))
  .map((line) => line.split("|").map((cell) => cell.trim()));

describe("authorization inventory", () => {
  it("finds the files it is supposed to audit", () => {
    expect(actionFiles.length).toBeGreaterThan(0);
    expect(routeFiles.length).toBeGreaterThan(0);
    expect(protectedPages.length).toBeGreaterThan(0);
    expect(rows.length).toBeGreaterThan(60);
  });

  it.each([...actionFiles, ...routeFiles, ...pageFiles])("documents %s", (file) => {
    expect(doc).toContain(`\`${file}\``);
  });

  it.each(actionFiles)("documents every exported action of %s", (file) => {
    const names = [...read(file).matchAll(/export async function (\w+)/g)].map((match) => match[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(doc).toContain(`| \`${name}\` |`);
  });

  it("does not list files that no longer exist", () => {
    for (const row of rows) {
      const path = row.find((cell) => /^`src\//.test(cell))!.replaceAll("`", "");
      expect(files, path).toContain(path);
    }
  });

  it("names a guard that each documented file really uses", () => {
    for (const row of rows) {
      const path = row.find((cell) => /^`src\//.test(cell))!.replaceAll("`", "");
      const guard = row.map((cell) => /^`(require\w+)`/.exec(cell)?.[1]).find(Boolean);
      if (guard) expect(read(path), `${path} should call ${guard}`).toContain(`${guard}(`);
    }
  });

  it.each(protectedPages.filter((file) => !PUBLIC_PROTECTED_PAGES.has(file)))("%s calls a guard", (file) => {
    expect(read(file)).toMatch(GUARD_PATTERN);
  });

  it.each(
    actionFiles.filter(
      (file) => !file.includes("legal/accept") && !file.includes("sign/[token]"),
    ),
  )("%s calls a guard before touching data", (file) => {
    const source = read(file);
    expect(source).toMatch(GUARD_PATTERN);
  });
});
