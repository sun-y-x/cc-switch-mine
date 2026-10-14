# CC Switch 特惠 API 定制构建

本仓库 fork 自 [farion1231/cc-switch](https://github.com/farion1231/cc-switch)（MIT 许可，原作者版权声明保留在 `LICENSE`）。
应用名称、应用标识（`com.ccswitch.desktop`）、一键导入协议（`ccswitch://`）都与上游一致，用户可以直接覆盖安装上游版本，配置不丢。

## 与上游的差别

所有改动都标了 `fork：` 注释，可以用 `git grep "fork："` 找全。

| 改动 | 位置 |
| --- | --- |
| 添加供应商时隐藏第三方中转、聚合平台和赞助商推广预设 | `src/config/tehui.ts`、`ProviderPresetSelector.tsx` |
| 内置「特惠 API」预设（Claude Code、Codex），在「全部」里排在「自定义配置」旁边 | `src/config/tehui.ts`、`claudeProviderPresets.ts` / `codexProviderPresets.ts` 末尾 |
| 自动更新改用本 fork 的签名密钥和下载地址 | `src-tauri/tauri.conf.json` 的 `plugins.updater` |
| 「查看更新说明」「下载页」等链接指向本 fork | `AboutSection.tsx`、`DatabaseUpgrade.tsx`、`src-tauri/src/commands/misc.rs` |
| 发布流程只出 Windows 和 macOS；macOS 用 ad-hoc 签名、不公证；额外产出服务器部署包 | `.github/workflows/release.yml`、`scripts/tehui-server-bundle.mjs` |
| 删除上游专用的自动化（R2 同步、Claude 机器人、标签、过期 issue、WSL 夜间测试、赞助、依赖更新） | `.github/` |

说明：

- 隐藏规则看预设的分类（`third_party`、`aggregator`）和赞助标记（`isPartner`、`primePartner`），上游以后新加的推广预设会被自动隐藏，不用逐个处理。
- 单测环境（`MODE=test`）下不隐藏，上游那批按名称点选第三方平台的测试照常通过；本 fork 的行为由 `tests/components/TehuiFork.test.tsx` 覆盖。
- 已经从推广预设添加过的供应商不受影响，照常显示和使用，只是编辑时不再提供切换到其他推广版本的入口。
- 特惠 API 预设追加在列表末尾，上游预设的下标不变（编辑旧供应商时靠下标找回预设）。

## 发布

### 一次性准备

在 GitHub 仓库 **Settings › Secrets and variables › Actions** 里添加两个 Repository secret：

| 名称 | 内容 |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | 更新签名私钥文件的全部内容（生成时放在本机 `~/.tauri/cc-switch-mine.key`） |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 私钥密码（`~/.tauri/cc-switch-mine.key.password`） |

私钥一旦丢失，已经装上的客户端就再也收不到自动更新，只能让用户手动重装。请把这两个文件另外备份一份。
公钥已写在 `src-tauri/tauri.conf.json` 里，不需要保密。

### 每次发布

1. 确认 `src/whats-new/<版本>.json` 存在（同步上游时一般已带上；没有的话写 `{"items": []}` 跳过弹窗，格式见同目录 README）。
2. 推送版本标签，标签名与 `tauri.conf.json` 的 `version` 一致，例如 `git tag v4.0.11 && git push origin v4.0.11`。
3. 等 Actions 里的 Release 跑完（约 30～40 分钟），GitHub Releases 里会出现安装包和 `CC-Switch-v4.0.11-server-bundle.zip`。
4. 把 server-bundle 解压到服务器的 `download/cc-switch/` 目录（对应 `https://docs.tehui.xyz/download/cc-switch/`），覆盖其中的 `latest.json` 和 `index.html`。旧版本目录可以保留。

客户端按顺序检查两个更新地址：先 `docs.tehui.xyz`，取不到再用 GitHub。服务器上的 `latest.json` 必须跟着第 4 步更新，否则会一直停在旧版本。

想先试编译、不发布：在 Actions 里手动运行 Release（workflow_dispatch），产物只留在这次运行里。

## 同步上游

```bash
git fetch upstream main
git merge upstream/main          # 或者 merge 某个上游版本的提交
```

可能冲突的地方和处理方式：

- `tauri.conf.json` 的 `version`：取上游的；`plugins.updater` 保留本 fork 的。
- `claudeProviderPresets.ts` / `codexProviderPresets.ts` 末尾：两边都保留，特惠 API 预设保持在最后。
- `tests/components/ProviderPresetSelector.test.tsx` 的预设行数：取上游的数字再 +1。
- `.github/workflows/release.yml`：保留本 fork 的版本，再看上游这次改了什么、要不要搬过来。
- 被删除的工作流如果上游改过：继续删除。

合并后跑一遍 `pnpm typecheck && pnpm test:unit`，再按上面的步骤发布。

## 已知限制

- macOS 包没有 Apple 开发者签名和公证。用户第一次打开会提示无法验证开发者，需要到「系统设置 › 隐私与安全性」点击「仍然打开」。未公证的应用自动更新能否顺利替换，需要在真机上验证一次。
- 不再出 Linux 包。
