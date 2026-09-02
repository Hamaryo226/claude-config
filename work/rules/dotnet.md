---
paths:
  - "**/*.cs"
  - "**/*.csproj"
  - "**/*.sln"
  - "**/*.razor"
---

# .NET / C#

## ビルドと検証

- ビルド: `dotnet build <sln または csproj>` / テスト: `dotnet test` / 整形: `dotnet format`
- `.cs` を編集すると `dotnet format whitespace` が自動で走る (PostToolUse フック)。
  インデントの手直しに時間を使わない
- Linux 上で `net*-windows` (WinForms / WPF) をビルド検証するときは
  `EnableWindowsTargeting=true` を環境変数で渡す。**csproj は書き換えない**
- ソリューションが大きいときは、先に対象プロジェクトだけをビルドする
  (`dotnet build src/Foo/Foo.csproj`)

## 触ってはいけないもの

- `TargetFramework` / `LangVersion` / `Nullable` を、依頼されていないのに変えない
- `obj/` `bin/` の中身を直接編集しない
- `.sln` のプロジェクト構成を、依頼されていないのに並べ替えない

## 書き方

- 命名: 型・メソッド・プロパティは PascalCase、ローカル変数と引数は camelCase、
  private フィールドは `_camelCase`
- `var` は右辺で型が明らかなときだけ使う
- nullable が有効なプロジェクトでは `!` (null 免除) を安易に付けない。
  null になり得ないなら、なぜそう言えるかをコードで示す
- `async` メソッドは `Task` / `Task<T>` を返す。`async void` はイベントハンドラだけ
- `IDisposable` は `using` で確実に解放する
- UI スレッドを触る処理 (WinForms) を、バックグラウンドスレッドから直接呼ばない

## テスト

- テストプロジェクトの命名と配置は既存に合わせる (例: `tests/<Project>.Tests`)
- 1 テスト 1 検証。テスト名は何を確かめているか日本語で書いてよい
