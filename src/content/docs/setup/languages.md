---
title: 語言版本管理
description: Python、Rust、Go、TypeScript／JavaScript（bun、node）各用什麼裝，專案的版本由誰決定。
---

我常寫的語言是 Python、Rust、Go、TypeScript／JavaScript（bun 與 node）。
它們的版本管理分兩層：**全域裝一份**，**每個專案用的版本交給專案自己的檔案決定**。

這頁只講「語言本身的版本」。lint、格式化、型別檢查、測試這些工具另外整理。

## 總覽

| 語言   | 全域怎麼裝             | 專案的版本寫在哪                                         | 誰負責切換                                   |
| ------ | ---------------------- | -------------------------------------------------------- | -------------------------------------------- |
| Python | uv（原生安裝）         | `.python-version`、`pyproject.toml` 的 `requires-python` | uv                                           |
| Rust   | rustup（原生安裝）     | `rust-toolchain.toml`                                    | rustup                                       |
| Go     | mise：`go = "latest"`  | `go.mod` 的 `go` 與 `toolchain`                          | mise 先選，go 指令再依 `go.mod` 決定要不要換 |
| bun    | mise：`bun = "latest"` | 專案的 `mise.toml`                                       | mise                                         |
| node   | mise：`node = "lts"`   | 專案的 `mise.toml`                                       | mise                                         |

## 判斷原則

**語言自己的工具會切換版本，就交給它；不會的，才交給 mise。**

- **Python、Rust**：uv 和 rustup 本身就會依專案的檔案自動切換版本、自動下載。再疊一層 mise 只是多一層要查的地方，所以直接用它們的原生安裝程式。
- **Go**：Go 1.21 起，`go` 指令會讀 `go.mod`，版本不夠時自動下載對應的工具鏈。但第一份 `go` 還是要有人裝，這份交給 mise。
- **bun、node**：自己沒有依專案切換版本的機制（`bun upgrade` 只能把全域那份升到最新），所以交給 mise，用專案的 `mise.toml` 釘版本。

## 全域安裝

原生安裝的步驟見[新電腦從零開始](/setup/new-machine/)。mise 管的三個：

```bash
mise use -g go@latest bun@latest node@lts
```

會寫進 `~/.config/mise/config.toml`，用 `mise ls` 確認。之後可用 `mise upgrade` 檢查並更新這些版本要求。 [mise use 手冊](https://mise.jdx.dev/cli/use.html)

## 各語言的專案設定

### Python

```bash
uv python pin 3.15      # 寫出 .python-version
uv run python --version # uv 會自動下載並使用這個版本
```

`pyproject.toml` 的 `requires-python` 表示「這個專案支援哪些版本」，`.python-version` 表示「開發時用哪一版」。

在專案目錄執行命令，選擇符合 `requires-python` 的版本。若專案已有符合的 Python，uv 可直接使用。 [uv 的 Python 版本管理](https://docs.astral.sh/uv/concepts/python-versions/)

### Rust

```toml title="rust-toolchain.toml"
[toolchain]
channel = "1.100.0"
components = ["clippy", "rustfmt"]
```

在專案目錄執行 `cargo --version`，rustup 會安裝尚未備妥的工具鏈並採用該版本。再用 `rustup show active-toolchain` 確認。 [rustup 的工具鏈覆寫](https://rust-lang.github.io/rustup/overrides.html)

### Go

```text title="go.mod（節錄）"
go 1.26
toolchain go1.27.4
```

| 行                   | 意思                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| `go 1.26`            | **最低需求**：至少要 1.26 才能編譯，也決定能用哪些語法。被當成依賴時也有效 |
| `toolchain go1.27.4` | **建議版本**：在這個 repo 開發時優先用這版。被當成依賴時忽略；可省略       |

#### 實際會跑哪一版

先由 PATH 決定執行哪一份 `go`（例如 mise 依 `mise.toml` 放上的版本）。在標準的 `GOTOOLCHAIN=auto` 設定下，Go 再查看目前的 `go.work`，若未使用 workspace 就查看主模組的 `go.mod`。

- `toolchain default` 會停用依該檔案自動切換版本
- `toolchain` 或 `go` 要求更高版本時，先在 PATH 找選中的工具鏈，找不到才下載
- 已有的版本符合兩行要求時，繼續使用該版本

以下範例都假設沒有 workspace、`go` 的最低需求是 1.26。用 `go version` 可確認實際選用的版本。

| PATH 上的 go（例如 mise.toml） | go.mod 的 toolchain | 實際跑的                         |
| ------------------------------ | ------------------- | -------------------------------- |
| 1.27.4                         | go1.27.4            | 1.27.4（一致，最單純）           |
| 1.26.0                         | go1.27.4            | 1.27.4（Go 自己下載的）          |
| 1.27.4                         | go1.27.0            | 1.27.4（`toolchain` 那行沒作用） |

官方說明：[Go Toolchains](https://go.dev/doc/toolchain)

### bun、node

```toml title="mise.toml"
[tools]
bun = "1.4.5"
node = "26"
```

在專案目錄先確認 `mise.toml` 內容並信任這份設定，再安裝和檢查版本：

```bash
mise trust
mise install
bun --version
node --version
```

`bun = "1.4.5"` 指定到修補版本，`node = "26"` 選擇 26 系列。Shell 已啟用 mise 或使用 shims 時，進到這個目錄就會採用這些設定。 [mise：入門](https://mise.jdx.dev/getting-started.html)

## 要避開的坑

- **Go 的 `mise.toml` 和 `go.mod` 版本不一致**。若已用 mise 選定專案開發版本，可讓它與 `toolchain` 一致，避免額外的工具鏈切換。`go` 那行仍可維持專案的最低相容需求
- **用 mise 裝的 bun 交給 mise 更新**。`mise upgrade bun` 會在設定範圍內更新。精確釘版時，先更新專案的版本要求再執行 `mise install`
- **Python、Rust 不要再用 mise 裝一份**。PATH 上同時有 mise 和 uv／rustup 的版本時，哪個先被找到取決於 PATH 順序，結果不容易預測
