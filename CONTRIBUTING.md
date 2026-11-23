# Git 协作规范

适用于本仓库所有参与者。目标是：**main 随时可发布、每次改动可追溯、评审不过夜**。

## 1. 角色与权限

| 角色 | 权限 | 职责 |
|------|------|------|
| **项目管理员（Maintainer）** | 管理仓库设置、分支保护、Release；合并 PR；处理回滚 | 把关质量与发布节奏，维护分支/标签/里程碑，仲裁冲突 |
| **项目成员（Contributor）** | 创建分支、提交 PR、评审他人 PR | 完成分配的任务，自测并补齐文档，及时响应评审 |

约定：

- 管理员至少 2 人，互为备份；仓库设置、密钥、发布权限仅管理员持有。
- 成员**不得直接 push `main`**（由分支保护强制），一切改动走 PR。
- 管理员同样不绕过评审：管理员提交的 PR 需另一名管理员或资深成员批准。
- 角色变更由管理员在团队内公示后调整 GitHub 团队权限。

## 2. 分支模型

| 分支 | 用途 | 来源 → 合入 |
|------|------|-------------|
| `main` | 稳定分支，随时可发布 | — |
| `feat/<scope>-<简述>` | 新功能 | main → main |
| `fix/<scope>-<简述>` | 缺陷修复 | main → main |
| `hotfix/<简述>` | 线上紧急修复 | main → main（并打 patch tag） |
| `docs/`、`chore/`、`refactor/` | 文档、杂务、重构 | main → main |

- `scope` 与目录对应：`backend`、`web`、`app`、`firmware`、`infra`、`docs`。
- 分支名用小写英文与连字符，例如 `feat/web-order-export`。
- 分支生命周期不超过 2 周；完成后由合并者删除远程分支。

## 3. 提交信息

采用 Conventional Commits：`<type>(<scope>): <subject>`

- **type**：`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`
- **scope**：同分支的模块前缀；跨模块可省略
- **subject**：中文，动词开头，不超过 50 字，句末不加句号
- 正文说明**为什么改**、影响范围；破坏性变更加 `BREAKING CHANGE:` 段落

```text
feat(web): 订单列表支持按时间范围筛选

后台订单量增大后无法快速定位某天的异常订单，
新增日期区间筛选并记住上次选择。
```

一个提交只做一件事；格式化、重命名等无行为变更单独提交。

## 4. 日常开发流程

1. **领任务**：在 Issue 下评论认领并由管理员指派，避免重复开发。
2. **同步主干**：`git switch main && git pull --rebase`
3. **开分支**：`git switch -c feat/web-order-export`
4. **小步提交**：本地通过 lint / 单测后再推送；`git push -u origin HEAD`
5. **开 PR**：标题同提交规范，描述写清 **变更内容 / 影响范围 / 验证方式 / 截图或录屏**；关联 Issue（`Closes #12`）。
6. **评审**：至少 1 名评审通过且 CI 全绿；作者逐条回复评论，改完点 Re-request review。
7. **合并**：由管理员 **Squash merge**，PR 标题即最终提交信息；合并后删除分支。

保持线性历史：用 `git pull --rebase` 同步，**禁止对共享分支 force push**。

## 5. 评审规则

- 作者不能自审；评审人优先选熟悉该模块的成员。
- 首次响应 **24 小时内**；超过 2 天未处理，管理员可改派或接管。
- 关注正确性、边界条件、安全（密钥、隐私、权限）、可维护性；风格问题交给 lint/格式化工具，不占用评审。
- 单个 PR 建议 ≤ 400 行（自动生成文件、锁文件除外），过大请拆分。
- 以下改动**必须管理员批准**：`docker-compose.yml`、`.env*`、CI 配置、数据库迁移、模型权重与固件烧录参数。

## 6. 合并、发布与回滚

- **合并方式**：仅 Squash merge，禁止 Merge commit 与 Rebase merge，保证 main 一条线。
- **发布**：管理员在 main 打语义化标签 `vX.Y.Z`，同步更新 `CHANGELOG.md` 与版本号。
- **回滚**：`git revert <sha>` 并走 PR；**禁止 reset 已推送的 main**。
- **hotfix**：从 main 拉分支，最小改动，1 名管理员 + 1 名成员评审，合并后立即打 patch 标签，24 小时内补复盘 Issue。

## 7. 外部贡献（Fork PR）的审查与合并

外部贡献者先 fork 仓库，再从自己的分支提 PR——代码不在本仓库，需要先取到本地验证，再合并。

```bash
gh pr list                                  # 1. 查看待审 PR

# 2. 取到本地：GitHub 为每个 PR 提供 pull/<编号>/head 引用，无需添加对方 remote
git fetch origin pull/5/head:review/pr-5
git switch review/pr-5
#    等价的一条命令：gh pr checkout 5

# 3. 只看改动、不切分支
git diff main...HEAD --stat                 # 三点号：以分叉点为基准，只显示 PR 净改动
git diff main...HEAD
```

审查要点：

- 核对改动范围与 PR 描述是否一致，有没有夹带无关文件或格式化噪音。
- 检查是否混入 `.env`、密钥、模型权重、构建产物。
- **先读 diff 再执行** `npm install` / `pip install`：依赖的 postinstall 脚本可执行任意代码。
- 本地跑受影响模块的 lint / 单测 / 构建，结果写进 PR 评论。
- `gh pr checks 5` 看 CI；`gh pr review 5 --approve|--comment|--request-changes -b "..."` 留意见。
- 作者推送新提交后，重新 `git fetch origin pull/5/head:review/pr-5 -f` 再复查增量（`git diff <旧head>..<新head>`）。

合并：

```bash
gh pr view 5 --json mergeable               # 先确认无冲突
gh pr edit 5 --title "docs(readme): 榜单文案改为「好养活榜单」"   # Squash 后即最终提交信息
gh pr merge 5 --squash --delete-branch
```

- 一律 Squash merge；PR 标题不符合提交规范时，合并前先改标题。
- fork 分支可能因权限不足删除失败，不影响合并结果。
- 合并后本地同步用 `git pull --rebase`，**不要 `reset --hard`** 掉自己未推送的提交。

## 8. 禁止事项

- 直接 push `main`，或对任何共享分支 force push。
- 提交密钥、`.env`、证书、模型权重、超过 10MB 的二进制文件。
- 提交 `node_modules`、构建产物、`.DS_Store` 等（以 `.gitignore` 为准）。
- 未经评审合并自己的 PR，或用 "临时先合，回头再改" 的方式推进。

## 9. 管理员检查清单（初始化仓库时）

- [ ] 保护 `main`：禁止直接 push / force push，要求 PR + 1 次批准 + CI 通过
- [ ] 开启 "Require conversation resolution" 与 "Delete branch after merge"
- [ ] 配置 Issue/PR 标签：`feat` `fix` `docs` `blocked` `needs-review`
- [ ] 配置 CI：lint、单测、构建（backend / web / app 分别执行）
- [ ] 约定发布节奏与值班评审人（每周轮换）
