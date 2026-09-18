// test/mirror.test.mjs — 会话目录 → 工作树的字节镜像（真实临时目录）。
// 覆盖：初次复制/增量更新/源删除同步/符号链接拒绝/fork 文件永不删除。

import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { mirrorSessionRoot, ensureDeviceFile } from '../lib/mirror.mjs'

async function makeTemp() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-session-sync-mirror-'))
  return { root, clean: () => fs.rm(root, { recursive: true, force: true }) }
}

test('mirrors new files, skips unchanged, reports symlinks', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const src = path.join(root, 'sessions')
  const repo = path.join(root, 'repo')
  await fs.mkdir(path.join(src, 's1'), { recursive: true })
  await fs.writeFile(path.join(src, 's1', 'log.jsonl'), 'line1\n')
  await fs.writeFile(path.join(src, 's1', 'blob.bin'), Buffer.from([0x00, 0xff, 0x28]))
  if (process.platform !== 'win32') {
    await fs.symlink(path.join(src, 's1', 'log.jsonl'), path.join(src, 's1', 'link.jsonl'))
  }
  const first = await mirrorSessionRoot({ sessionRoot: src, repoDir: repo, mirrorDir: 'sessions' })
  assert.equal(first.mirrored, 2)
  assert.equal(first.unchanged, 0)
  if (process.platform !== 'win32') assert.equal(first.skippedLinks.length, 1)

  const second = await mirrorSessionRoot({ sessionRoot: src, repoDir: repo, mirrorDir: 'sessions' })
  assert.equal(second.mirrored, 0)
  assert.equal(second.unchanged, 2)

  const content = await fs.readFile(path.join(repo, 'sessions', 's1', 'blob.bin'))
  assert.deepEqual([...content], [0x00, 0xff, 0x28])
})

test('source deletions sync; fork files are never copied or deleted', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const src = path.join(root, 'sessions')
  const repo = path.join(root, 'repo')
  await fs.mkdir(path.join(src, 's1'), { recursive: true })
  await fs.writeFile(path.join(src, 's1', 'log.jsonl'), 'a\n')
  await mirrorSessionRoot({ sessionRoot: src, repoDir: repo, mirrorDir: 'sessions' })

  // 删除源文件 + 手放一个 fork 文件（模拟此前冲突裁决产物）。
  await fs.unlink(path.join(src, 's1', 'log.jsonl'))
  const fork = path.join(repo, 'sessions', 's1', 'log.jsonl.remote-fork-20260815120000-a1b2c3d4')
  await fs.writeFile(fork, 'remote side\n')

  const result = await mirrorSessionRoot({ sessionRoot: src, repoDir: repo, mirrorDir: 'sessions' })
  assert.deepEqual(result.deleted, ['s1/log.jsonl'])
  assert.deepEqual(result.forkedPreserved, ['s1/log.jsonl.remote-fork-20260815120000-a1b2c3d4'])
  assert.equal(await fs.readFile(fork, 'utf8'), 'remote side\n')
})

test('update path rewrites changed content bytes', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const src = path.join(root, 'sessions')
  const repo = path.join(root, 'repo')
  await fs.mkdir(path.join(src, 's1'), { recursive: true })
  await fs.writeFile(path.join(src, 's1', 'log.jsonl'), 'v1\n')
  await mirrorSessionRoot({ sessionRoot: src, repoDir: repo, mirrorDir: 'sessions' })
  await fs.appendFile(path.join(src, 's1', 'log.jsonl'), 'v2\n')
  const result = await mirrorSessionRoot({ sessionRoot: src, repoDir: repo, mirrorDir: 'sessions' })
  assert.equal(result.mirrored, 1)
  assert.equal(await fs.readFile(path.join(repo, 'sessions', 's1', 'log.jsonl'), 'utf8'), 'v1\nv2\n')
})

test('mirror never follows symlinked directories out of the root', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const src = path.join(root, 'sessions')
  const outside = path.join(root, 'outside')
  const repo = path.join(root, 'repo')
  await fs.mkdir(src, { recursive: true })
  await fs.mkdir(outside, { recursive: true })
  await fs.writeFile(path.join(outside, 'secret.txt'), 'secret\n')
  if (process.platform !== 'win32') {
    await fs.symlink(outside, path.join(src, 'escape'))
    const result = await mirrorSessionRoot({ sessionRoot: src, repoDir: repo, mirrorDir: 'sessions' })
    assert.equal(result.mirrored, 0)
    assert.equal(result.skippedLinks.length, 1)
    await assert.rejects(fs.access(path.join(repo, 'sessions', 'escape', 'secret.txt')))
  }
})

test('ensureDeviceFile writes once and reports later identity changes', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  assert.equal(await ensureDeviceFile(root, 'device.txt', 'dev-1'), true)
  assert.equal(await ensureDeviceFile(root, 'device.txt', 'dev-1'), false)
  assert.equal(await ensureDeviceFile(root, 'device.txt', 'dev-2'), true)
  assert.equal(await fs.readFile(path.join(root, 'device.txt'), 'utf8'), 'dev-2\n')
})

// 宿主私有会话产物（租约 + 迁移暂存）不进镜像；generation log（同步载荷）照常同步。
// 名称来源：session-persistence-jsonl/lease.ts:40（session.lock）与
// generation.ts:725（session.migration.<token><suffix>.tmp）；载荷名来源：
// session-format/filename.ts:14（session[.vN].jsonl）+ format.ts:41（logSuffix）。
test('host-private artifacts never enter the mirror, generation logs always do', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const src = path.join(root, 'sessions')
  const repo = path.join(root, 'repo')
  await fs.mkdir(path.join(src, 's1'), { recursive: true })
  await fs.writeFile(path.join(src, 's1', 'session.lock'), '{"pid":1}')
  await fs.writeFile(path.join(src, 's1', 'session.migration.ab12cd.jsonl.tmp'), 'partial\n')
  await fs.writeFile(path.join(src, 's1', 'session.jsonl'), 'v0 payload\n')
  await fs.writeFile(path.join(src, 's1', 'session.v2.jsonl.zstd'), Buffer.from([0x28, 0xb5, 0x2f, 0xfd]))

  const result = await mirrorSessionRoot({ sessionRoot: src, repoDir: repo, mirrorDir: 'sessions' })

  // 载荷照常同步（回归锁：白名单写宽 = 插件静默不再同步任何会话内容）。
  assert.equal(await fs.readFile(path.join(repo, 'sessions', 's1', 'session.jsonl'), 'utf8'), 'v0 payload\n')
  assert.deepEqual(
    [...await fs.readFile(path.join(repo, 'sessions', 's1', 'session.v2.jsonl.zstd'))],
    [0x28, 0xb5, 0x2f, 0xfd],
  )
  // 瞬时产物两个都不进镜像、且不计入 mirrored/unchanged。
  assert.equal(result.mirrored, 2)
  assert.equal(result.hostArtifactsSkipped, 2)
  await assert.rejects(fs.access(path.join(repo, 'sessions', 's1', 'session.lock')))
  await assert.rejects(fs.access(path.join(repo, 'sessions', 's1', 'session.migration.ab12cd.jsonl.tmp')))

  // 文件数守恒：镜像树 = 源树文件数 − 被跳过的宿主产物数。
  const countFiles = async (dir) => {
    let total = 0
    const walk = async (current) => {
      for (const entry of await fs.readdir(current, { withFileTypes: true })) {
        const absolute = path.join(current, entry.name)
        if (entry.isDirectory()) await walk(absolute)
        else if (entry.isFile()) total += 1
      }
    }
    await walk(dir)
    return total
  }
  assert.equal(await countFiles(path.join(repo, 'sessions')), await countFiles(src) - result.hostArtifactsSkipped)
})

test('a target-side host-private artifact is preserved, never deleted', async (t) => {
  const { root, clean } = await makeTemp()
  t.after(clean)
  const src = path.join(root, 'sessions')
  const repo = path.join(root, 'repo')
  await fs.mkdir(path.join(src, 's1'), { recursive: true })
  await fs.writeFile(path.join(src, 's1', 'session.jsonl'), 'payload\n')
  // 目标侧已有另一设备提交/持有的租约与迁移暂存：源侧没有它们。
  await fs.mkdir(path.join(repo, 'sessions', 's1'), { recursive: true })
  await fs.writeFile(path.join(repo, 'sessions', 's1', 'session.lock'), '{"pid":9}')
  await fs.writeFile(path.join(repo, 'sessions', 's1', 'session.migration.zz99.jsonl.tmp'), 'stale\n')
  // 一个源侧已不存在、且不受白名单保护的常规文件：仍必须被删（删除语义未被削弱）。
  await fs.writeFile(path.join(repo, 'sessions', 's1', 'obsolete.jsonl'), 'gone\n')

  const result = await mirrorSessionRoot({ sessionRoot: src, repoDir: repo, mirrorDir: 'sessions' })

  assert.equal(await fs.readFile(path.join(repo, 'sessions', 's1', 'session.lock'), 'utf8'), '{"pid":9}')
  assert.equal(await fs.readFile(path.join(repo, 'sessions', 's1', 'session.migration.zz99.jsonl.tmp'), 'utf8'), 'stale\n')
  assert.deepEqual(result.hostArtifactsPreserved, ['s1/session.lock', 's1/session.migration.zz99.jsonl.tmp'].sort())
  assert.deepEqual(result.deleted, ['s1/obsolete.jsonl'])
})
