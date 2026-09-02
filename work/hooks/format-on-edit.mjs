#!/usr/bin/env node
// PostToolUse (Edit | Write): 編集したファイルを、そのリポジトリの設定がある場合だけ整形する。【会社用】
// settings.json 側で async: true にしてあるのでターンをブロックしない。
//
// 方針: 「リポジトリに設定があるときだけ動く」。チームのリポジトリを勝手に整形しない。
//
// Java / Kotlin を対象にしていない理由:
//   spotless も google-java-format も「1 ファイルだけを安定して整形する」手段が無く、
//   プロジェクト全体を整形して無関係な差分を大量に出す危険がある。
//   Java / Kotlin はコミット前に `./gradlew spotlessApply` などを明示的に実行する運用にする
//   (rules/java-spring.md 参照)。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const BS = String.fromCharCode(92);
const norm = (p) => p.split(BS).join("/");

/** file から上に辿って、pred を満たす最初のディレクトリを返す。 */
function findUp(file, pred) {
  let dir = dirname(resolve(file));
  for (let i = 0; i < 30; i++) {
    try {
      if (pred(dir)) return dir;
    } catch {
      /* 読めないディレクトリは飛ばす */
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

const hasAny = (dir, names) => names.some((n) => existsSync(join(dir, n)));

const PRETTIER_CONFIGS = [
  ".prettierrc",
  ".prettierrc.json",
  ".prettierrc.yml",
  ".prettierrc.yaml",
  ".prettierrc.js",
  ".prettierrc.cjs",
  ".prettierrc.mjs",
  "prettier.config.js",
  "prettier.config.cjs",
  "prettier.config.mjs",
];

const ESLINT_CONFIGS = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yml",
  ".eslintrc.yaml",
];

/** ESLint に投げてよい拡張子 (CSS や Markdown は対象外)。 */
const LINTABLE_EXT = new Set([
  ".ts", ".tsx", ".mts", ".cts",
  ".js", ".jsx", ".mjs", ".cjs",
]);

/** package.json に "prettier" キーがあるか。 */
function packageJsonHasPrettier(dir) {
  const pkg = join(dir, "package.json");
  if (!existsSync(pkg)) return false;
  try {
    return Object.prototype.hasOwnProperty.call(
      JSON.parse(readFileSync(pkg, "utf8")),
      "prettier"
    );
  } catch {
    return false;
  }
}

/** pyproject.toml に [tool.ruff] セクションがあるか。 */
function pyprojectHasRuff(dir) {
  const p = join(dir, "pyproject.toml");
  if (!existsSync(p)) return false;
  try {
    return /^\s*\[tool\.ruff/m.test(readFileSync(p, "utf8"));
  } catch {
    return false;
  }
}

// npx は Windows では .cmd シムなので shell が要る。dotnet は実行ファイルなので不要。
// shell を使う場合は空白を含む引数を自前で括る (cmd が引数を割ってしまうため)。
function run(cmd, args, cwd) {
  const needsShell = process.platform === "win32" && cmd === "npx";
  const finalArgs = needsShell
    ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a))
    : args;
  try {
    execFileSync(cmd, finalArgs, {
      cwd,
      stdio: "ignore",
      timeout: 60_000,
      shell: needsShell,
    });
  } catch {
    // 整形に失敗しても編集自体は成立している。黙って諦める。
  }
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }

  const file = input?.tool_input?.file_path;
  if (typeof file !== "string" || !file || !existsSync(file)) process.exit(0);

  const ext = extname(file).toLowerCase();

  // --- C# ---
  if (ext === ".cs") {
    const root = findUp(file, (d) =>
      readdirSync(d).some((n) => n.endsWith(".sln") || n.endsWith(".csproj"))
    );
    // --include は root からの相対パスを取る
    if (root) run("dotnet", ["format", "whitespace", "--include", norm(relative(root, file))], root);
    process.exit(0);
  }

  // --- prettier が扱う拡張子 ---
  const PRETTIER_EXT = new Set([
    ".ts", ".tsx", ".mts", ".cts",
    ".js", ".jsx", ".mjs", ".cjs",
    ".json", ".jsonc",
    ".css", ".scss", ".less",
    ".html", ".vue", ".svelte", ".astro",
    ".yml", ".yaml", ".md",
  ]);
  if (PRETTIER_EXT.has(ext)) {
    const prettierRoot = findUp(
      file,
      (d) => hasAny(d, PRETTIER_CONFIGS) || packageJsonHasPrettier(d)
    );
    if (prettierRoot) {
      // --no-install: 設定はあるが未インストールのリポジトリで勝手に落としてこない
      run("npx", ["--no-install", "prettier", "--write", norm(file)], prettierRoot);
      process.exit(0);
    }

    // prettier が無ければ、ESLint が入っているリポジトリでだけ --fix をかける
    if (LINTABLE_EXT.has(ext)) {
      const eslintRoot = findUp(
        file,
        (d) => hasAny(d, ESLINT_CONFIGS) && existsSync(join(d, "node_modules", "eslint"))
      );
      if (eslintRoot) run("npx", ["--no-install", "eslint", "--fix", norm(file)], eslintRoot);
    }
    process.exit(0);
  }

  // --- Python (ruff の設定があるリポジトリのみ) ---
  if (ext === ".py" || ext === ".pyi") {
    const root = findUp(
      file,
      (d) => hasAny(d, ["ruff.toml", ".ruff.toml"]) || pyprojectHasRuff(d)
    );
    // `ruff format` だけを掛ける。`ruff check --fix` は未使用 import の削除など
    // 意味を変える修正を含むので、編集のたびに自動で走らせない (明示的に実行する運用)。
    if (root) run("ruff", ["format", norm(file)], root);
    process.exit(0);
  }

  process.exit(0);
}

main();
