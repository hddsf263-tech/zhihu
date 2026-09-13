# ADR-001：工程目录以 packages/* 为当前实现基线

日期：2026-09-13
状态：已批准（成员二基线）

## 背景

PROJECT_SPEC.md 的目标目录示例包含 `apps/api/`、`apps/web/`、`packages/contracts/`、`packages/fixtures/` 和 `scripts/`。当前共享工作区实际落盘的源码目录是 `packages/api/`、`packages/web/` 和 `packages/contracts/`；没有第二套 `apps/api/` 或 `apps/web/` 实现。

## 决策

M2-0/M2-1 及后续联调暂以实际 `packages/*` 目录为唯一源码基线：

- 后端：`packages/api/`
- 前端：`packages/web/`
- 契约与 replay fixture：`packages/contracts/`
- `apps/*`、`packages/fixtures/`、`scripts/` 不复制第二套实现；如外部交接需要，仅用说明文档标注目录差异。

## 影响

成员三从 `feat/member-2-m2-baseline-clean` 创建自己的前端分支时，应从 `packages/contracts` 和 `packages/contracts/src/fixtures.ts` 开始，不按 `apps/*` 路径复制实现。未来若要迁移目录，必须另开 ADR，评估 workspace、构建和部署影响后再执行。