---
title: alias 與 zfunc
description: 幾個好用的 alias，以及用 ~/.zfunc 管理自訂函式：一個函式一個檔、用到才載入。
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
fpath=(~/.zfunc ~/.zfunc/*(N/) $fpath)
autoload -Uz ~/.zfunc/**/[^_]*(N.:t)
```

- `fpath`：zsh 找函式與補全檔的路徑，這裡加入 `~/.zfunc` 和它底下的子目錄（可以分類放）
- `autoload`：先登記函式名稱，**第一次呼叫時才讀檔**，不拖慢 shell 啟動
- 底線開頭的檔案（例如 `_mkcd`）是補全檔，不載入成函式。要放在 oh-my-zsh 之前，它初始化補全時才掃得到

檔案內容就是函式本體，不用再包一層 `mkcd() { … }`：

```zsh title="~/.zfunc/mkcd"
# mkcd <dir> — 建立目錄並進入
mkdir -p -- "$1" && cd -- "$1"
```

開新的 shell（或 `exec zsh`）就能用 `mkcd`。

:::caution[檔名就是函式名稱]
autoload 以檔名當函式名稱。檔案改名，舊名字的函式就消失，而且不會有任何錯誤訊息。
:::

整個 `~/.zfunc` 適合交給 dotfiles 工具管理。
