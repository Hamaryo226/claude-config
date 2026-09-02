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

## ビルドとテスト

ラッパーがあれば必ずラッパーを使う。ローカルの Gradle / Maven を直接叩かない。

| ファイル | 使うコマンド |
| --- | --- |
| `gradlew` / `gradlew.bat` | `./gradlew build` / `./gradlew test` |
| `mvnw` / `mvnw.cmd` | `./mvnw verify` / `./mvnw test` |
| ラッパー無し | `gradle` / `mvn` (バージョン差に注意) |

- 単体テストだけ回すなら `./gradlew test --tests '*ClassName*'` / `./mvnw test -Dtest=ClassName`
- 全体ビルドが重いときは、まず対象モジュールだけに絞る

## Spring Boot

- **`application-*.yml` の本番プロファイルを読まない・書き換えない。** 設定で遮断してある
- 設定値はハードコードせず `@ConfigurationProperties` か `@Value` で外に出す
- DI はコンストラクタインジェクションを使う。フィールドインジェクション (`@Autowired` を
  フィールドに付ける形) は新規に書かない
- `@Transactional` は境界を意識して付ける。読み取り専用なら `readOnly = true`
- Controller にビジネスロジックを書かない。Service に置く
- Entity をそのまま API のレスポンスに使わない。DTO を挟む
- 例外は `@ControllerAdvice` で一元的に扱う。エラーレスポンスに内部情報を漏らさない

## 書き方

- 命名: クラスは PascalCase、メソッドと変数は camelCase、定数は UPPER_SNAKE_CASE
- `null` を返さない。`Optional` を使うか、例外にする
- Lombok が入っているリポジトリでは既存の使い方に合わせる。入っていないなら持ち込まない
- Kotlin では `!!` を使わない。`?.` `?:` か、null でないことを型で表す
- Checked exception を握りつぶさない。ログだけ出して握るのは最悪

## テスト

- テストの置き場所と命名は既存に合わせる (`src/test/java/...`)
- Spring のコンテキストを立ち上げるテスト (`@SpringBootTest`) は遅い。
  単体で済むものは `@ExtendWith(MockitoExtension.class)` で書く
- DB を使うテストは、既存のやり方 (Testcontainers か H2 か) に合わせる。新しい方式を持ち込まない
