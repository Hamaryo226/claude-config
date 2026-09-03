---
paths:
  - "**/*.cs"
  - "**/*.csproj"
  - "**/*.sln"
  - "**/*.razor"
---

# .NET / C#

<!-- 一般的な良し悪し (命名規則、var の使い分け、async void、using) は書かない。
     Sonnet 5 は指示しなくてもやる。ここは環境を見ないと分からないことだけ。 -->

## ビルドと検証

- ビルド: `dotnet build <sln または csproj>` / テスト: `dotnet test` / 整形: `dotnet format`
- `.cs` を編集すると `dotnet format whitespace` が自動で走る (PostToolUse フック)。
  インデントの手直しに時間を使わない
- Linux 上で `net*-windows` (WinForms / WPF) をビルド検証するときは
  `EnableWindowsTargeting=true` を環境変数で渡す。**csproj は書き換えない**

## 触ってはいけないもの

- `TargetFramework` / `LangVersion` / `Nullable` を、依頼されていないのに変えない
- `obj/` `bin/` の中身を直接編集しない
- `.sln` のプロジェクト構成を、依頼されていないのに並べ替えない

## テスト

- テストプロジェクトの命名と配置は既存に合わせる (例: `tests/<Project>.Tests`)
- nullable が有効なプロジェクトでは `!` (null 免除) を安易に付けない
