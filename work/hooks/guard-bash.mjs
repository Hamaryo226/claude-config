#!/usr/bin/env node
// PreToolUse (Bash | PowerShell): 取り返しのつかないコマンドを実行前に止める。【会社用】
// 個人用に、本番環境・サーバー操作・秘密情報の持ち出しに関するルールを足したもの。
// CLAUDE.md の指示と違い、フックはモデルの判断に関係なく効く安全装置。
// 仕様: https://code.claude.com/docs/en/hooks
import { readFileSync } from "node:fs";

/** 各ルール: [判定, 理由]。理由はそのまま Claude に返り、次の手を考える材料になる。 */
const RULES = [
  // ---------- ファイルの破壊 ----------
  [
    // -rf / -fr の連結形に加えて、-r -f のように分けた形と --recursive --force も拾う
    /(^|[\s;&|(`])rm\s+(?:-[a-zA-Z-]+\s+)*(?:-[a-zA-Z]*[rR][a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*[rR]|--recursive\s+(?:-[a-zA-Z-]+\s+)*--force|--force\s+(?:-[a-zA-Z-]+\s+)*--recursive|-[rR]\s+(?:-[a-zA-Z-]+\s+)*-f|-f\s+(?:-[a-zA-Z-]+\s+)*-[rR])/,
    "rm の再帰強制削除は使わない。消す対象を明示して 1 つずつ削除するか、人に削除を依頼すること。",
  ],
  [
    // find 経由の一括削除。rm を直接書かないので上のルールをすり抜ける
    /(^|[\s;&|(`])find\s[\s\S]*?(-delete\b|-exec\s+rm\b)|\|\s*xargs\s+(?:-\S+\s+)*rm\b/,
    "find や xargs 経由の一括削除は使わない。対象を確認したうえで、実行は人に任せること。",
  ],
  [
    /Remove-Item[\s\S]*-Recurse[\s\S]*-Force|Remove-Item[\s\S]*-Force[\s\S]*-Recurse/i,
    "Remove-Item -Recurse -Force は使わない。対象を明示して 1 つずつ削除するか、人に削除を依頼すること。",
  ],

  // ---------- git ----------
  [
    /git\s+reset\s+(--\S+\s+)*--hard/,
    "git reset --hard は未コミットの変更を復旧不能にする。git stash か、対象ファイルだけの git restore を使うこと。",
  ],
  [
    /git\s+clean\s+(-\S+\s*)*-\S*[dxX]/,
    "git clean は追跡外ファイルを消す。何が消えるか git clean -n で確認したうえで、実行は人に任せること。",
  ],
  [
    /git\s+checkout\s+--\s+\.|git\s+restore\s+(--\S+\s+)*\.\s*$/,
    "作業ツリー全体の巻き戻しは行わない。対象ファイルを明示すること。",
  ],
  [
    /git\s+push\s[\s\S]*--force(?!-with-lease)/,
    "git push --force は他人の履歴を壊す。--force-with-lease を使うか、人に実行を依頼すること。",
  ],
  [
    // `git push origin HEAD:main` や `refs/heads/main` のような refspec 形も拾う
    /git\s+push\s[\s\S]*?(?:\s|:)(?:origin\s+)?(?:HEAD:)?(?:refs\/heads\/)?(main|master|develop|release)(\s|$)/,
    "保護ブランチ (main / master / develop / release) への直接 push は行わない。作業ブランチを切って PR を出すこと。",
  ],
  [
    /git\s+commit\s[\s\S]*--no-verify|git\s+push\s[\s\S]*--no-verify/,
    "--no-verify で pre-commit フックを飛ばさない。フックが落ちる原因の方を直すこと。",
  ],
  [
    /git\s+(filter-branch|filter-repo)|git\s+reflog\s+expire|git\s+gc\s[\s\S]*--prune=now/,
    "履歴を書き換える操作は自動実行しない。手順を提示して人に実行してもらうこと。",
  ],

  // ---------- サーバー・サービスの操作 ----------
  [
    /(^|[\s;&|(])(sudo\s+)?systemctl\s+(stop|restart|disable|mask|reload)\b/,
    "サービスの停止・再起動は自動実行しない。コマンドを提示して人に実行してもらうこと (status / list-units の確認は可)。",
  ],
  [
    /(^|[\s;&|(])(sudo\s+)?service\s+\S+\s+(stop|restart|reload)\b/,
    "サービスの停止・再起動は自動実行しない。コマンドを提示して人に実行してもらうこと。",
  ],
  [
    /(Restart|Stop|Remove)-Service\b|(^|[\s;&|(])iisreset\b|Restart-WebAppPool\b/i,
    "Windows サービス / IIS の停止・再起動は自動実行しない。コマンドを提示して人に実行してもらうこと。",
  ],
  [
    /(^|[\s;&|(])(sudo\s+)?(shutdown|reboot|halt|poweroff)\b|Restart-Computer\b|Stop-Computer\b/i,
    "再起動・シャットダウンは実行しない。",
  ],

  // ---------- デプロイ・インフラ適用 ----------
  [
    /terraform\s+(apply|destroy)\b/,
    "terraform apply / destroy は自動実行しない。terraform plan の結果を提示して、適用は人に任せること。",
  ],
  [
    /ansible-playbook\b(?![\s\S]*--check)/,
    "ansible-playbook の実行は自動でしない。--check (dry-run) で確認したうえで、適用は人に任せること。",
  ],
  [
    /kubectl\s+(delete|drain|cordon)\b|kubectl\s+rollout\s+(restart|undo)\b|kubectl\s+apply\b/,
    "クラスタへの変更は自動実行しない。マニフェストの差分を提示して、適用は人に任せること (get / describe / logs は可)。",
  ],
  [
    /helm\s+(install|upgrade|uninstall|rollback)\b/,
    "helm によるリリース操作は自動実行しない。人に実行してもらうこと。",
  ],
  [
    /docker\s+system\s+prune|docker\s+volume\s+rm|docker\s+-\S*compose\s[\s\S]*down\s[\s\S]*-v|docker\s+compose\s[\s\S]*down\s[\s\S]*(-v|--volumes)/,
    "ボリュームごと消す操作はデータを失う。対象を確認したうえで、実行は人に任せること。",
  ],

  // ---------- データベース ----------
  [
    /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i,
    "DROP / TRUNCATE は自動実行しない。SQL を提示して人に実行してもらうこと。",
  ],
  [
    /\bDELETE\s+FROM\b(?![\s\S]*\bWHERE\b)|\bUPDATE\s+\S+\s+SET\b(?![\s\S]*\bWHERE\b)/i,
    "WHERE 句の無い DELETE / UPDATE は全件を書き換える。条件を付けるか、人に実行してもらうこと。",
  ],
  [
    /flyway\s+(clean|migrate)\b|liquibase\s+(update|dropAll)\b|(gradlew?|mvnw?)[\s\S]*flywayClean/,
    "マイグレーションの実行は自動でしない。適用対象の環境を確認したうえで、人に実行してもらうこと。",
  ],

  // ---------- 秘密情報の持ち出し ----------
  [
    /(^|[\s;&|(])(curl|wget|Invoke-WebRequest|Invoke-RestMethod|iwr|irm)\b/i,
    "外部への HTTP アクセスはコマンドで行わない。必要な調査は WebFetch (許可ドメインのみ) を使うこと。社内データを外部へ送らない。",
  ],
  [
    /(^|[\s;&|(])(cat|type|Get-Content|gc)\s[\s\S]*\.(env|pem|key|pfx|p12|jks|keystore)\b/i,
    "認証情報や鍵ファイルを読まない。値が必要なら、何が必要かを伝えて人に渡してもらうこと。",
  ],
  [
    /(^|[\s;&|(])(scp|rsync|ssh)\s/,
    "リモートホストへの接続・転送は自動実行しない。コマンドを提示して人に実行してもらうこと。",
  ],
];
// パッケージ公開 (npm publish / dotnet nuget push / mvn deploy) はここでは止めない。
// settings.json の permissions.ask に入れてあり、都度人が承認できる方が扱いやすいため。

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
            permissionDecisionReason: `[guard-bash/work] ${reason}`,
          },
        })
      );
      process.exit(0);
    }
  }
  process.exit(0);
}

main();
