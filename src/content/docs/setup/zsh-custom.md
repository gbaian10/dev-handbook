---
title: alias 與 zfunc
description: 幾個好用的 alias，以及用 ~/.zfunc 管理自訂函式與補全：一個函式一個檔、用到才載入。
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

| alias | 作用 |
| --- | --- |
| `c`、`cc`、`cx`、`m` | 常打的指令縮短：`clear`、`claude`、`codex`、`make` |
| `ls="eza --icons=auto"` | 用 eza 取代 ls。`--icons=auto` 只在輸出到終端機時顯示圖示，接到管線或寫進檔案時不加，免得圖示字元混進結果 |
| `zz="z -"` | 跳回上一個目錄（zoxide 的 `z -`） |
| `-g -- --help=…` | **全域 alias**：出現在指令中任何位置都會展開。任何指令加 `--help`，說明都會經過 bat 上色 |

一般 alias 只在指令開頭展開；`alias -g` 定義的全域 alias 在整行任何位置都會展開。中間的 `--` 是告訴 `alias` 後面不是它的選項，才能定義以 `--` 開頭的名稱。
全域 alias 不會展開引號裡的字，`echo "--help"` 不受影響。

## zfunc：自訂函式與補全

自己寫的 shell 函式不要全塞進 `.zshrc`，改成**一個函式一個檔案**，放在 `~/.zfunc/`，用到時才載入：

```text
~/.zfunc/
├── mkcd            ← 函式，檔名就是函式名稱
├── _mkcd           ← 底線開頭：mkcd 的 Tab 補全
└── docker/         ← 可以用子目錄分類（一層）
    └── ...
```

### 載入設定

```zsh title="~/.zshrc（節錄，放在 source $ZSH/oh-my-zsh.sh 之前）"
fpath=(~/.zfunc ~/.zfunc/*(N/) $fpath)
autoload -Uz ~/.zfunc/**/[^_]*(N.:t)
```

| 片段 | 意思 |
| --- | --- |
| `fpath=(…)` | zsh 找函式與補全檔的路徑。加入 `~/.zfunc` 與它底下每個子目錄 |
| `*(N/)` | 只取目錄；`N` 表示沒有符合時展開成空的，不報錯 |
| `autoload -Uz` | 先登記函式名稱，**第一次呼叫時才讀檔**，不拖慢 shell 啟動 |
| `**/[^_]*` | 遞迴找所有不是底線開頭的檔案，也就是函式本體 |
| `(N.:t)` | `.` 只取一般檔案，`:t` 只留檔名（函式名稱） |

要放在 `source $ZSH/oh-my-zsh.sh` **之前**：oh-my-zsh 會執行 `compinit` 初始化補全，那時 `fpath` 已經包含 `~/.zfunc`，底線開頭的補全檔才會被掃到。

新增檔案後開新的 shell（或 `exec zsh`）就生效。

### 函式檔案怎麼寫

檔案內容就是**函式本體**，不用再包一層 `mkcd() { … }`：

```zsh title="~/.zfunc/mkcd"
# mkcd <dir> — 建立目錄並進入
mkdir -p -- "$1" && cd -- "$1"
```

補全檔第一行用 `#compdef` 指定給哪個指令：

```zsh title="~/.zfunc/_mkcd"
#compdef mkcd
_files -/
```

`_files -/` 表示只補目錄。

:::caution[檔名就是函式名稱]
autoload 以檔名當函式名稱。檔案改名，舊名字的函式就消失，而且不會有任何錯誤訊息。
:::

### 什麼該寫成 zfunc

- 超過一行、需要參數或判斷的，寫成 zfunc；一行的縮寫用 alias 就好
- 包裝既有指令（例如替 `claude` 加上預設參數）時，函式名稱可以跟原指令同名，函式內用 `command claude` 呼叫原本的程式
- 工具附的補全檔（`_工具名`）也可以放這裡；但如果工具能自己產生（`工具 completion zsh`），最好在套用 dotfiles 時重新產生，免得版本升級後過時

`~/.zfunc` 整個目錄收進 dotfiles 管理。
