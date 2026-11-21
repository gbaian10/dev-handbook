---
title: alias 與 zfunc
description: 幾個好用的 alias、用 ~/.zfunc 管理自訂函式，以及替 CLI 工具加上 Tab 補全。
---

## alias

寫在 `~/.zshrc`，放在 `source $ZSH/oh-my-zsh.sh` **之後**，才不會被 oh-my-zsh 外掛定義的同名 alias 蓋掉。

```zsh title="~/.zshrc（節錄）"
alias c="clear"
alias cc="claude"
alias cx="codex"
alias m="make"
alias ls="eza --icons=auto"
alias zz="z -"
alias -g -- --help="--help 2>&1 | bat --language=help --style=plain"
```

| alias                   | 作用                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `c`、`cc`、`cx`、`m`    | 常打的指令縮短：`clear`、`claude`、`codex`、`make`                                                        |
| `ls="eza --icons=auto"` | 用 eza 取代 ls。`--icons=auto` 只在輸出到終端機時顯示圖示，接到管線或寫進檔案時不加，免得圖示字元混進結果 |
| `zz="z -"`              | 跳回上一個目錄（zoxide 的 `z -`）                                                                         |
| `-g -- --help=…`        | **全域 alias**：出現在指令中任何位置都會展開。任何指令加 `--help`，說明都會經過 bat 上色                  |

一般 alias 只在指令開頭展開；`alias -g` 定義的全域 alias 在整行任何位置都會展開。中間的 `--` 是告訴 `alias` 後面不是它的選項，才能定義以 `--` 開頭的名稱。
全域 alias 不會展開引號裡的字，`echo "--help"` 不受影響。

## zfunc：自訂函式

超過一行、要參數或判斷的指令，寫成 shell 函式。zsh 的做法是**一個函式一個檔案**，放在 `~/.zfunc/`，檔名就是函式名稱，用到時才載入：

```zsh title="~/.zshrc（節錄，放在 source $ZSH/oh-my-zsh.sh 之前）"
fpath=(~/.zfunc ~/.zfunc/**/*(N/) $fpath)
for zfunc in ~/.zfunc/**/[^_]*(N.:t); do
  autoload -Uz -- "$zfunc"
done
unset zfunc
```

- `fpath`：zsh 找函式與補全檔的路徑，這裡加入 `~/.zfunc` 和各層子目錄。函式檔名須唯一，zsh 會從 `fpath` 依序找同名檔案
- `autoload`：先登記函式名稱，**第一次呼叫時才讀檔**，不拖慢 shell 啟動
- 底線開頭的檔案（例如 `_mkcd`）是補全檔，不載入成函式。要放在 oh-my-zsh 之前，它初始化補全時才掃得到

檔案內容就是函式本體，不用再包一層 `mkcd() { … }`：

```zsh title="~/.zfunc/mkcd"
# mkcd <dir> — 建立目錄並進入
mkdir -p -- "$1" && cd -- "$1"
```

先用 `mkdir -p ~/.zfunc` 建立目錄，將範例存成 `~/.zfunc/mkcd`。開新的 shell 後，用 `type mkcd` 確認已登記，再在子 shell 的暫存目錄執行 `(cd "$(mktemp -d)" && mkcd example && pwd)`，輸出的路徑應以 `/example` 結尾。

:::caution[檔名就是函式名稱]
autoload 以檔名當函式名稱。檔案改名，舊名字的函式就消失，而且不會有任何錯誤訊息。
:::

整個 `~/.zfunc` 適合交給 dotfiles 工具管理。

## 工具內建的補全

很多 CLI 能自己產生 zsh 的 Tab 補全，安裝時是否一起設定補全視發行方式而定。已啟用 oh-my-zsh 的 zsh 可以把產生的檔案放入補全快取。以下用 gh 和 ripgrep 示範，先產生暫存檔，兩個指令都成功後再更新補全。

```zsh
(
  set -e
  dir="${ZSH_CACHE_DIR:?請先在已啟用 oh-my-zsh 的 zsh 執行}/completions"
  mkdir -p -- "$dir"
  tmp=$(mktemp -d "$dir/.new.XXXXXX")
  trap 'rm -rf -- "$tmp"' EXIT
  gh completion -s zsh > "$tmp/_gh"
  rg --generate complete-zsh > "$tmp/_rg"
  test -s "$tmp/_gh" && test -s "$tmp/_rg" || exit 1
  mv -- "$tmp/_gh" "$tmp/_rg" "$dir/"
  rm -f -- "${ZSH_COMPDUMP:?找不到 oh-my-zsh 補全快取}" "$ZSH_COMPDUMP.zwc"
)
```

- `$ZSH_CACHE_DIR/completions` 通常在 `~/.oh-my-zsh/cache/completions`。oh-my-zsh 在初始化補全前加入 `fpath`，`uv`、`mise`、`rust` 外掛也用這個位置。 [oh-my-zsh 載入程式](https://github.com/ohmyzsh/ohmyzsh/blob/master/oh-my-zsh.sh)
- 檔名是底線加指令名稱（`_gh`），開頭是 `#compdef gh`，zsh 就知道它是 `gh` 的補全
- 清除 `$ZSH_COMPDUMP` 和編譯檔後，用 `exec zsh` 開新 shell 重新掃描。輸入 `gh` 加一個空格，再按 <kbd>Tab</kbd> 確認是否列出子指令。也可以用 `print -r -- "${_comps[gh]}"` 檢查登記的函式。 [gh 補全指令](https://cli.github.com/manual/gh_completion)

各工具產生補全的指令不一樣：

| 工具                                          | 指令                                                   |
| --------------------------------------------- | ------------------------------------------------------ |
| gh                                            | `gh completion -s zsh`                                 |
| chezmoi、golangci-lint、sops、helm、k9s、flux | `<工具> completion zsh`                                |
| ruff                                          | `ruff generate-shell-completion zsh`                   |
| codex、herdr                                  | `codex completion zsh`、`herdr completion zsh`         |
| rg                                            | `rg --generate complete-zsh`                           |
| bat                                           | `bat --completion zsh`                                 |
| watchexec                                     | `watchexec --completions zsh`                          |
| bun                                           | `SHELL=zsh bun completions`（將輸出重新導向至 `_bun`） |
| wrangler                                      | `wrangler complete zsh`                                |

表中的指令是產生器。把適用的輸出存成 `_<實際指令名>`，其中 Bun 需要透過 `SHELL` 指定 zsh 並重新導向。Ruff 和 uv 的官方範例分別將 `ruff generate-shell-completion zsh`、`uv generate-shell-completion zsh` 的輸出交給 `eval`，每次開 shell 會重新產生。這裡存成檔案，工具更新後再產生一次。用 dotfiles 工具管理時，也可安排在套用設定時更新。 [Bun 補全實作](https://github.com/oven-sh/bun/blob/main/src/runtime/cli/install_completions_command.rs) · [Ruff 補全設定](https://docs.astral.sh/ruff/configuration/#shell-autocompletion) · [uv 補全設定](https://docs.astral.sh/uv/getting-started/installation/#shell-autocompletion)

官方說明見 [zsh 的 alias 語法](https://zsh.sourceforge.io/Doc/Release/Shell-Builtin-Commands.html#index-alias)及 [函式自動載入](https://zsh.sourceforge.io/Doc/Release/Functions.html#Autoloading-Functions)。
