---
paths:
  - "**/*.py"
  - "**/pyproject.toml"
  - "**/requirements*.txt"
---

# Python

<!-- 一般的な良し悪し (可変デフォルト引数、裸の except、pathlib、SQL のプレースホルダ等) は
     書かない。Sonnet 5 は指示しなくてもやる。ここは環境を見ないと分からないことだけ。 -->

## 環境

- **仮想環境の外で `pip install` しない。** `.venv` / `venv` があればそれを有効にして使う
- 依存の管理方法はリポジトリに合わせる (`pyproject.toml` + uv/poetry か `requirements.txt` か)

## 整形とリント

- `ruff` の設定があるリポジトリでは、編集後に `ruff format` だけが自動で走る。
  import 削除など意味を変えうる `ruff check --fix` は明示的に実行する
- `black` / `isort` / `flake8` を使っているリポジトリでは、そちらの設定に従う。
  **複数のフォーマッタを混ぜない**

## テスト

- 実行: `pytest` / 対象を絞るなら `pytest tests/test_foo.py::test_bar`
