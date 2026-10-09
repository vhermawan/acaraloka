import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
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

const actionFiles = files.filter((file) => /\.tsx?$/.test(file) && /^\s*["']use server["']/.test(read(file)));
const routeFiles = files.filter((file) => file.endsWith("/route.ts"));
const pageFiles = files.filter((file) => file.endsWith("/page.tsx"));
const protectedPages = pageFiles.filter((file) => /^src\/app\/(me|organizer|admin)\//.test(file));

const GUARD_PATTERN = /require(Participant|Organizer|EventOwner|Admin|User)\(/;
const PUBLIC_PROTECTED_PAGES = new Set(["src/app/organizer/login/page.tsx", "src/app/admin/login/page.tsx"]);
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

type Row = { section: string; name: string; file: string; guard: string };

function parseRows(markdown: string): Row[] {
  let section = "";
  const rows: Row[] = [];
  for (const line of markdown.split("\n")) {
    if (line.startsWith("## ")) section = line.slice(3).trim();
    if (!line.startsWith("| ") || !/\| `src\//.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    const fileIndex = cells.findIndex((cell) => /^`src\//.test(cell));
    rows.push({
      section,
      name: cells[fileIndex - 1]?.replaceAll("`", "") ?? "",
      file: cells[fileIndex].replaceAll("`", ""),
      guard: cells[fileIndex + 1] ?? "",
    });
  }
  return rows;
}

type ExportedFunction = { name: string; body: ts.Node | undefined };

function hasExport(node: ts.Node) {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function exportedFunctions(file: string): ExportedFunction[] {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: ExportedFunction[] = [];
  for (const statement of source.statements) {
    if (!hasExport(statement)) continue;
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      found.push({ name: statement.name.text, body: statement.body });
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const init = declaration.initializer;
        if (ts.isIdentifier(declaration.name)) {
          const body = init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) ? init.body : init;
          found.push({ name: declaration.name.text, body });
        }
        if (ts.isObjectBindingPattern(declaration.name)) {
          for (const element of declaration.name.elements) {
            if (ts.isIdentifier(element.name)) found.push({ name: element.name.text, body: undefined });
          }
        }
      }
    }
  }
  return found;
}

function calleeName(call: ts.CallExpression) {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return "";
}

function firstAwaitedCall(body: ts.Node | undefined): string | null {
  if (!body) return null;
  let result: string | null = null;
  const visit = (node: ts.Node) => {
    if (result !== null) return;
    if (ts.isAwaitExpression(node) && ts.isCallExpression(node.expression)) {
      result = calleeName(node.expression);
      return;
    }
    if (ts.isFunctionLike(node) && node !== body) return;
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(body, visit);
  return result;
}

const rows = parseRows(doc);
const actionRows = rows.filter((row) => row.section === "Server action");
const routeRows = rows.filter((row) => row.section === "Route handler");
const documentedGuard = (row: Row) => /^`(require\w+)`/.exec(row.guard)?.[1];

const actions = actionFiles.flatMap((file) =>
  exportedFunctions(file)
    .filter((fn) => fn.body !== undefined)
    .map((fn) => ({ file, ...fn })),
);
const routeHandlers = routeFiles.flatMap((file) =>
  exportedFunctions(file)
    .filter((fn) => HTTP_METHODS.has(fn.name))
    .map((fn) => ({ file, ...fn })),
);

describe("authorization inventory", () => {
  it("finds the files and exports it is supposed to audit", () => {
    expect(actionFiles.length).toBeGreaterThan(0);
    expect(actions.length).toBeGreaterThanOrEqual(actionRows.length);
    expect(routeHandlers.length).toBeGreaterThan(0);
    expect(protectedPages.length).toBeGreaterThan(0);
  });

  it.each([...actionFiles, ...routeFiles, ...pageFiles])("documents %s", (file) => {
    expect(doc).toContain(`\`${file}\``);
  });

  it.each(actions.map((action) => [`${action.file}#${action.name}`, action] as const))(
    "documents action %s in its own row",
    (_label, action) => {
      const row = actionRows.find((candidate) => candidate.name === action.name && candidate.file === action.file);
      expect(row, `missing row for ${action.name} in ${action.file}`).toBeDefined();
    },
  );

  it.each(routeHandlers.map((handler) => [`${handler.file}#${handler.name}`, handler] as const))(
    "documents route handler %s",
    (_label, handler) => {
      const row = routeRows.find(
        (candidate) =>
          candidate.file === handler.file && candidate.name.split(/[\s,]+/).includes(handler.name),
      );
      expect(row, `missing ${handler.name} row for ${handler.file}`).toBeDefined();
    },
  );

  it("does not list files or actions that no longer exist", () => {
    for (const row of rows) expect(files, row.file).toContain(row.file);
    for (const row of actionRows) {
      expect(
        actions.some((action) => action.name === row.name && action.file === row.file),
        `${row.name} is not exported from ${row.file}`,
      ).toBe(true);
    }
  });

  it.each(actionRows.filter((row) => documentedGuard(row)).map((row) => [`${row.file}#${row.name}`, row] as const))(
    "%s awaits its documented guard before anything else",
    (_label, row) => {
      const action = actions.find((candidate) => candidate.name === row.name && candidate.file === row.file);
      expect(firstAwaitedCall(action?.body)).toBe(documentedGuard(row));
    },
  );

  it.each(routeRows.filter((row) => documentedGuard(row)).map((row) => [row.file, row] as const))(
    "%s calls its documented guard",
    (_label, row) => {
      expect(read(row.file)).toContain(`${documentedGuard(row)}(`);
    },
  );

  it.each(protectedPages.filter((file) => !PUBLIC_PROTECTED_PAGES.has(file)))("%s calls a guard", (file) => {
    expect(read(file)).toMatch(GUARD_PATTERN);
  });
});
