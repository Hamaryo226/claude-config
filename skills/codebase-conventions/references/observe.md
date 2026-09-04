# 観測項目

各項目に **分子/分母** と **数えた方法** を残す。数えられなかったものは `不明` にする。
すべてを埋める必要はない。埋まらない項目は空欄のままレポートに `不明` として出す。

---

## A. コード配置

**「新しい処理をどこに書くか」に直接効く。最優先で埋める。**

- 各レイヤの実ディレクトリ (`Service` は `application/service/` か `service/` か `domain/`)
  - 数え方: クラス名のサフィックスでファイルを列挙し、親ディレクトリを集計する
    ```bash
    git ls-files "*Service.java" | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn
    ```
- Controller / Service / Repository が**それぞれ何をしているか**。代表を 2 件ずつ読んで確認する
  - Controller にロジックがあるか / DTO 変換はどこか / トランザクション境界はどこか
- DTO / Entity / Model / Mapper / Validator / Utility の置き場所と命名サフィックス
  - リクエストとレスポンスの DTO を分けているか。分けているならその命名
- module / package / namespace の分かれ方 (機能別か層別か)
- **レイヤ間の依存方向**。逆流が禁止されているか
  - 数え方: 下位レイヤから上位レイヤへの import を数える。0 件なら規約として機能している
    ```bash
    git grep -l "import .*\.controller\." -- "*/service/*" | wc -l
    ```
  - ArchUnit / NetArchTest / eslint `no-restricted-imports` / `import-linter` があれば**それが正解**
- 共通処理の置き場所 (`common/`, `shared/`, `util/`)。**新規に作ってよいのかも確認する**
- 生成コードと編集禁止領域。再生成コマンドとセットで記録する

## B. コードスタイル

明示的設定で強制されている項目はここで数えない (Phase 1 で確定済み)。

- 命名: class / interface / method / variable / field / constant
  - interface に `I` 接頭辞を付けるか (`.NET`)、実装クラスに `Impl` を付けるか (Java)
  - private field: `_camelCase` / `camelCase` / `m_camelCase`
  - 定数: `UPPER_SNAKE` / `PascalCase`
  - boolean の命名 (`is` / `has` / `can` 接頭辞の有無)
- メンバの並び順: public → private か、field → constructor → property → method か
- private helper method の位置 (呼び出し元の直後か、クラス末尾にまとめるか)
- method の分割傾向: 1 メソッドの行数の実態。**巨大メソッドが常態ならそれも観測結果**
- import / using の扱い: ワイルドカード import の可否、静的 import、`global using`、
  相対パス import か alias (`@/`) か
  ```bash
  git grep -h "^import .*\*;" -- "*.java" | wc -l
  ```
- 型推論: `var` / `val` / `auto` の使用度合い。明示型を好むか
- null / Optional / nullable: `Optional` を返すか `null` を返すか、`?` 付き型の使用、
  `@Nullable` / `@NonNull` の付与、`#nullable enable` の有無
- async: `async/await` か `Task` を返すだけか、`CancellationToken` を引数に取るか、
  `ConfigureAwait(false)` を付けるか、Promise チェーンか
- DI: constructor injection / field injection (`@Autowired` on field) / setter injection。
  Lombok `@RequiredArgsConstructor` の使用、primary constructor の使用
  ```bash
  git grep -c "@Autowired" -- "*.java" | wc -l
  ```
- error handling: 戻り値でエラーを返すか例外か、Result 型の有無

## C. コメント (最重点)

**ここを外すと、書いたコードが最も浮く。** 他の項目より丁寧に数える。

- **どこに書いてあるか**: class / public method / private method / field / 分岐 / SQL / 定数
  - 数え方: 各 public method の直前 3 行にコメントがあるかを数える。代表ファイル 5〜8 件を
    実際に読んで数えるのが確実
- **どこに書いていないか**。これを必ず出す。「public method には Javadoc を書かない (48/51)」は
  「書く」と同じくらい重要な情報
- **言語**: 日本語 / 英語 / 混在。混在ならどこが日本語でどこが英語か
  (例: Javadoc は日本語、TODO は英語)
- **文体**: 常体 (「〜する」) / 敬体 (「〜します」) / 体言止め。1 行か複数行か
- Javadoc / XML Documentation / docstring を**付ける対象**
  - 全 public か、公開 API だけか、付いていないか
  - `@param` / `@return` を埋めているか、サマリだけか
  ```bash
  git grep -c "^\s*/\*\*" -- "*.java" | wc -l
  git grep -c "^\s*/// <summary>" -- "*.cs" | wc -l
  ```
- **業務仕様を説明するコメントの傾向**: 計算式の根拠、業務ルール、締め日・端数処理などの
  ドメイン知識が書かれているか。書かれているならその粒度と場所
- **「なぜ」と「何をしているか」の比率**。代表ファイル 5 件で実際に数える。
  例: `なぜ 12 / 何 31` なら、このコードベースは「何」を書く文化。**それに合わせる**
  (一般論として「なぜを書け」と指導しない。既存に馴染ませることが目的)
- TODO / FIXME / HACK / XXX の形式。担当者名や日付が入るか
  ```bash
  git grep -h -E "(TODO|FIXME|HACK|XXX)" | head -30
  ```
- **チケット番号・仕様書番号の書き方**。`// [PROJ-123]` / `// 課題No.456` / `// 基本設計書 3.2.1`。
  これはプロジェクト固有性が最も高く、rules に書く価値が大きい
- コメントアウトされたコードの扱い: 残す文化か消す文化か。残すなら日付や理由を添えるか

## D. ログ・例外

- logger の取得方法: `@Slf4j` / `LoggerFactory.getLogger(X.class)` / `ILogger<T>` の DI /
  `console.log` / `logging.getLogger(__name__)`
  ```bash
  git grep -c "@Slf4j" -- "*.java" | wc -l
  ```
- ログレベルの使い分け (実測): 各レベルの出現回数と、どの場面で使われているか
- **ログを書くレイヤ**。Controller だけか、Service にもあるか、Repository には無いか
- ログメッセージの形式: 言語、固定の接頭辞、相関 ID / ユーザー ID を必ず載せるか、
  構造化ログ (key=value / MDC / structured logging) か
- **例外を catch する場所**。各レイヤで catch しているか、`@ControllerAdvice` /
  ミドルウェアに集約しているか
- 独自例外: 基底クラス、命名、エラーコードを持つか、どこで定義されているか
- エラー変換: 下位の例外を握って独自例外に包み直すか、そのまま投げるか。
  元例外を cause に渡しているか

## E. テスト

- テストファイルの配置: `src/test/java/...` のミラーか、実装と同じディレクトリか (`*.test.ts`)
- テストクラス / メソッドの命名: `XxxTest` / `XxxTests` / `test_xxx` /
  日本語メソッド名 / `@DisplayName` の使用
  ```bash
  git ls-files "*Test*.java" "*Tests.cs" "*.test.ts" "*_test.py" | head -20
  ```
- fixture / mock の作り方: Mockito / Moq / `jest.mock` / テストデータビルダー /
  共通の基底テストクラス / `@Sql` や testcontainers の使用
- 構造: Arrange / Act / Assert のコメントを書くか、`given/when/then` か、区切り無しか
- **1 テストで何を検証する傾向か**: assert が 1 件か複数か。実測する
- unit / integration の分離: ディレクトリ、命名、タグ (`@Tag("integration")`, `[Trait]`)、
  CI で分けて実行しているか
