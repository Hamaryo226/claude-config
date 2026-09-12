# claude-config の保守

このリポジトリは会社用 Claude Code 設定の配布元。ルートの CLAUDE.md は配布する全案件共通テンプレートで、この AGENTS.md は配布対象外の保守指示。
会社での実行環境は Claude Code CLI / AWS Bedrock / 会社指定 Sonnet 5 high。保守に使う Codex のモデルやローカル環境とは区別する。

## 変更の境界

- 現在の設定はルート直下にある。旧 work/ や個人用プロファイルを再作成しない。
- 依頼された変更を実装・関連検証まで進める。既存の staged / unstaged / untracked のユーザー作業を保持する。
- コミット依頼は対象差分だけ、push は依頼に含まれる場合だけ行う。既に得た承認は同じ範囲で有効。
- settings.json の権限、hooks のガード、モデル継承、手動起動設定は、文章の簡略化を理由に変更しない。
- .gitignore は許可リスト方式。新規ファイルが追跡候補になることを確認する。認証情報や履歴、生ログを追加しない。

## 必要なときに読むもの

- 配布・配置の変更: README.md と install.ps1 / install.sh。通常の保守で実ユーザーの ~/.claude へ適用しない。
- スキルの変更: 対象 SKILL.md と、その変更に関わる references のみ。目的・適用条件・固有の判断基準を残し、全件調査や固定手順を一律に要求しない。
- 評価設計や結果の解釈: eval/README.md。eval/results/ は当時のモデル・設定での記録なので書き換えず、現在の性能と区別する。

## 検証

- 指示・スキル・設定: node eval/selfcheck.mjs --profile work と git diff --check。文言変更に全プロジェクトの実行試験を追加しない。
- 評価ハーネス: node --test eval/tests/*.test.mjs。使い捨て fixture と偽 CLI を使うローカルテストで、本番アクセスはない。変更が原因の失敗は修正して関連テストを再実行する。
- 配置スクリプト: dry-run と隔離した一時ターゲットへの適用を確認。install.ps1 の UTF-8 BOM を保持し、Windows PowerShell 5.1 / 7 で検証する。
- --live や runner の通常実行は実 CLI / API を使う。静的検証や偽 CLI テストと混同しない。
- build / 静的検証の成功から UI・音声・入力・外部接続の成功を推論しない。ユーザーが実機確認を担当すると指定した場合、その部分は未確認として引き継ぐ。

## 環境の落とし穴

- CLI が PATH で見つからない場合、ホスト PC に未インストールとは断定しない。現在のシェル・サンドボックスと会社の接続確認を分ける。
- git の所有者警告には、検証済みのリポジトリパスをコマンド単位の -c safe.directory= に指定する。グローバル設定は変更しない。
- Windows の評価テストは CLAUDE_CONFIG_EVAL_CLI_SCRIPT で偽 Node CLI を指定できる。実 CLI が動いた証拠にはならない。
