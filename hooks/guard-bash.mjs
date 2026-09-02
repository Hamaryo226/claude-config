#!/usr/bin/env node
// PreToolUse (Bash | PowerShell): 取り返しのつかないコマンドを実行前に止める。
// CLAUDE.md の指示と違い、フックはモデルの判断に関係なく効く安全装置。
// 仕様: https://code.claude.com/docs/en/hooks
import { readFileSync } from "node:fs";

/** 各ルール: [判定, 理由]。理由はそのまま Claude に返り、次の手を考える材料になる。 */
const RULES = [
  [
    /(^|[\s;&|(])rm\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*[rR][a-zA-Z]*f|(^|[\s;&|(])rm\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*f[a-zA-Z]*[rR]/,
    "rm -rf は使わない。消す対象を明示して 1 つずつ削除するか、ユーザーに削除を依頼すること。",
  ],
  [
    /Remove-Item[\s\S]*-Recurse[\s\S]*-Force|Remove-Item[\s\S]*-Force[\s\S]*-Recurse/i,
    "Remove-Item -Recurse -Force は使わない。対象を明示して 1 つずつ削除するか、ユーザーに削除を依頼すること。",
  ],
  [
    /git\s+reset\s+(--\S+\s+)*--hard/,
    "git reset --hard は未コミットの変更を復旧不能にする。git stash か、対象ファイルだけの git restore を使うこと。",
  ],
  [
    /git\s+clean\s+(-\S+\s*)*-\S*[dxX]/,
    "git clean は追跡外ファイルを消す。何が消えるか git clean -n で確認したうえで、実行はユーザーに任せること。",
  ],
  [
    /git\s+checkout\s+--\s+\.|git\s+restore\s+(--\S+\s+)*\.\s*$/,
    "作業ツリー全体の巻き戻しは行わない。対象ファイルを明示すること。",
  ],
  [
    /git\s+push\s[\s\S]*--force(?!-with-lease)/,
    "git push --force は他人の履歴を壊す。--force-with-lease を使うか、ユーザーに実行を依頼すること。",
  ],
  [
    /git\s+push\s[\s\S]*\s(origin\s+)?(main|master)(\s|$)/,
    "main / master への直接 push は行わない。作業ブランチを切って PR を作ること。",
  ],
  [
    /git\s+commit\s[\s\S]*--no-verify|git\s+push\s[\s\S]*--no-verify/,
    "--no-verify で pre-commit フックを飛ばさない。フックが落ちる原因の方を直すこと。",
  ],
  [
    /git\s+(filter-branch|filter-repo)|git\s+reflog\s+expire|git\s+gc\s[\s\S]*--prune=now/,
    "履歴を書き換える操作は自動実行しない。手順を提示してユーザーに実行してもらうこと。",
  ],
];
// パッケージ公開 (npm publish / dotnet nuget push) はここでは止めない。
// settings.json の permissions.ask に入れてあり、都度ユーザーが承認できる方が扱いやすいため。

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0); // 入力が読めないときは黙って通す
  }

  const cmd = input?.tool_input?.command;
  if (typeof cmd !== "string" || !cmd) process.exit(0);

  for (const [re, reason] of RULES) {
    if (re.test(cmd)) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: `[guard-bash] ${reason}`,
          },
        })
      );
      process.exit(0);
    }
  }
  process.exit(0);
}

main();
