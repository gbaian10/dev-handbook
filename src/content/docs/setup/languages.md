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

會寫進 `~/.config/mise/config.toml`，之後 `mise upgrade` 一次升級。

## 各語言的專案設定

### Python

```bash
uv python pin 3.15      # 寫出 .python-version
uv run python --version # uv 會自動下載並使用這個版本
```

`pyproject.toml` 的 `requires-python` 表示「這個專案支援哪些版本」，`.python-version` 表示「開發時用哪一版」。

### Rust

```toml title="rust-toolchain.toml"
[toolchain]
channel = "1.100.0"
components = ["clippy", "rustfmt"]
```

在專案目錄執行 `cargo`，rustup 會自動裝好並切換到這個版本。

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

先由 PATH 決定執行哪一份 `go`（例如 mise 依 `mise.toml` 放上的版本），這份 go 再讀 `go.mod`。預設 `GOTOOLCHAIN=auto` 的規則：

- `toolchain` 比目前這份新 → 自動下載並改跑 `toolchain` 指定的版本
- 沒有 `toolchain`，`go` 那行比目前新 → 改跑 `go` 那行的版本
- 都不比目前新 → 用目前這份（Go 向下相容）

也就是**兩者中比較新的那個**：

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

- **Go 的 `mise.toml` 和 `go.mod` 版本不一致**。不一致時實際跑的是兩者中較新的那個，很容易以為在用 A、其實在跑 B。要寫就兩邊寫同一版
- **用 mise 裝的 bun 不要執行 `bun upgrade`**。它會直接覆蓋 mise 目錄裡的執行檔，mise 記錄的版本就和實際的不一致。升級用 `mise upgrade bun`
- **Python、Rust 不要再用 mise 裝一份**。PATH 上同時有 mise 和 uv／rustup 的版本時，哪個先被找到取決於 PATH 順序，結果不容易預測
