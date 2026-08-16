// lib/domain.mjs — 'session_sync' 存储领域声明（唯一允许 zod/DSH 包的 lib 模块：
// 领域记录 schema 是持久边界校验器，zod 与 defineDomain 是 harness 自身词汇）。

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { DOMAIN_NAME, LIMITS } from './constants.mjs'

/**
 * 同步元数据记录（state 表单例键）：设备 id（fork 归属/提交署名）、最近
 * 推/拉时间、最近推送头与最近错误。介质上每条记录在 open 时按此校验
 * （invalid-record 响亮拒绝，绝不静默跳过）。
 */
export const syncStateSchema = z.object({
  deviceId: z.string().min(1).max(LIMITS.MAX_DEVICE_ID_LENGTH),
  lastPullAt: z.number().int().nonnegative().optional(),
  lastPushAt: z.number().int().nonnegative().optional(),
  lastPushHead: z.string().regex(/^[0-9a-f]{40,64}$/iu).optional(),
  lastError: z.string().max(500).optional(),
})

/**
 * 'session_sync' 领域 spec：一张 'state' 表，键为单例键。
 * version 变更即废弃整介质（预发布立场，无迁移）。
 */
export const sessionSyncDomainSpec = defineDomain({
  name: DOMAIN_NAME,
  version: 1,
  tables: { state: domainTable(syncStateSchema) },
})
