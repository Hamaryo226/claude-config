---
paths:
  - "**/*.java"
  - "**/*.kt"
  - "**/*.kts"
  - "**/pom.xml"
  - "**/build.gradle"
  - "**/build.gradle.kts"
  - "**/application*.{yml,yaml,properties}"
---

# Java / Kotlin / Spring Boot

<!-- 一般的な良し悪し (命名規則、Optional、コンストラクタインジェクション、DTO を挟む等) は
     書かない。Sonnet 5 は指示しなくてもやる。ここは環境を見ないと分からないことだけ。 -->

## ビルドとテスト

**ラッパーがあれば必ずラッパーを使う。** ローカルの Gradle / Maven を直接叩かない。

| ファイル | 使うコマンド |
| --- | --- |
| `gradlew` / `gradlew.bat` | `./gradlew build` / `./gradlew test` |
| `mvnw` / `mvnw.cmd` | `./mvnw verify` / `./mvnw test` |
| ラッパー無し | `gradle` / `mvn` (バージョン差に注意) |

- 単体テストだけ回すなら `./gradlew test --tests '*ClassName*'` / `./mvnw test -Dtest=ClassName`
- 全体ビルドが重いときは、まず対象モジュールだけに絞る
- **Java / Kotlin は自動整形しない。** spotless も google-java-format も 1 ファイルだけを
  安定して整形できず、無関係な差分を大量に出す。コミット前に `./gradlew spotlessApply` を
  明示的に実行する運用

## この環境で特に注意すること

- **`application-*.yml` の本番プロファイルを読まない・書き換えない。** 設定で遮断してある
- Lombok が入っているリポジトリでは既存の使い方に合わせる。入っていないなら持ち込まない
- DB を使うテストは、既存のやり方 (Testcontainers か H2 か) に合わせる。新しい方式を持ち込まない
- Spring のコンテキストを立ち上げるテスト (`@SpringBootTest`) は遅い。
  単体で済むものは `@ExtendWith(MockitoExtension.class)` で書く
