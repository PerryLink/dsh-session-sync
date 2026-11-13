// lib/sessionlog.mjs — 会话日志首帧（header）读取/改写（零 DSH 依赖，仅 node:zlib）。
//
// 宿主 session-persistence-jsonl 把每个会话写成一串**独立的 zstd 帧**：第一帧
// 只含 header 行，之后每个追加批次各一帧（`compression: none` 时是纯 JSONL，
// header 就是第一行）。追加从不重写已提交帧。因此投影只需要替换第一帧/第一行，
// 其余字节原样保留——这也让反向投影可以"把镜像里的原首帧接回本地尾部"，追加
// 事件仍逐字节相同（append-only 合并语义不受影响）。
//
// 本模块只做结构性扫描与解压/压缩；任何不可解析的输入都返回 undefined，由调用方
// 保持文件原样（绝不猜测、绝不改写看不懂的字节）。

import { constants, zstdCompressSync, zstdDecompressSync } from 'node:zlib'

const ZSTD_MAGIC = 0xFD2FB528
// 与宿主 compressZstdFrame 同参数（带 checksum 的 zstd 帧）。
const ZSTD_CHECKSUM_OPTIONS = { params: { [constants.ZSTD_c_checksumFlag]: 1 } }

/** 宿主会话日志文件名：`session.v<N>.jsonl` 或 `session.v<N>.jsonl.zstd`。 */
export const SESSION_LOG_NAME_RE = /^session\.v\d+\.jsonl(?:\.zstd)?$/u

/**
 * 扩展名是否表示 zstd 编码。
 * @param {string} name - 文件名。
 * @returns {boolean} `.zstd` 结尾为 true。
 */
export function isCompressedName(name) {
  return typeof name === 'string' && name.endsWith('.zstd')
}

/**
 * 扫描首个完整 zstd 帧的结束偏移（只走结构，不解压）。
 * 参考 zstd 帧格式：magic + frame header descriptor + 可选字段 + blocks + 可选
 * checksum。任何结构损坏/尾部不完整都返回 undefined。
 * @param {Buffer} buffer - 文件字节。
 * @returns {number|undefined} 首帧的排他结束偏移。
 */
function firstFrameEnd(buffer) {
  let offset = 0
  if (buffer.length < 4) return undefined
  if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) return undefined
  offset += 4
  if (offset === buffer.length) return undefined
  const descriptor = buffer.readUInt8(offset)
  offset += 1
  if ((descriptor & 0x18) !== 0) return undefined
  const contentSizeFlag = descriptor >>> 6
  const singleSegment = (descriptor & 0x20) !== 0
  const checksum = (descriptor & 0x04) !== 0
  const dictionaryFlag = descriptor & 0x03
  const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
  const contentSizeBytes = contentSizeFlag === 0
    ? (singleSegment ? 1 : 0)
    : 1 << contentSizeFlag
  const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
  if (buffer.length - offset < remainingHeaderBytes) return undefined
  offset += remainingHeaderBytes
  for (;;) {
    if (buffer.length - offset < 3) return undefined
    const blockHeader = buffer.readUIntLE(offset, 3)
    offset += 3
    const lastBlock = (blockHeader & 1) !== 0
    const blockType = (blockHeader >>> 1) & 0x03
    const blockSize = blockHeader >>> 3
    if (blockType === 0x03) return undefined
    const payloadBytes = blockType === 0x01 ? 1 : blockSize
    if (buffer.length - offset < payloadBytes) return undefined
    offset += payloadBytes
    if (lastBlock) break
  }
  if (checksum) {
    if (buffer.length - offset < 4) return undefined
    offset += 4
  }
  return offset
}

/**
 * 读取会话日志的 header 行（首帧/首行）与其余字节。
 * @param {Buffer} buffer - 文件字节。
 * @param {boolean} compressed - 是否 zstd 编码。
 * @returns {{header: {type: string, id: string, cwd?: string, [key: string]: unknown}, text: string, frame: Buffer, rest: Buffer}|undefined} 解析结果。
 */
export function readSessionHeader(buffer, compressed) {
  if (!Buffer.isBuffer(buffer)) return undefined
  let frame
  let text
  let rest
  if (compressed) {
    const end = firstFrameEnd(buffer)
    if (end === undefined) return undefined
    frame = buffer.subarray(0, end)
    rest = buffer.subarray(end)
    try {
      text = zstdDecompressSync(frame).toString('utf8')
    } catch {
      return undefined
    }
  } else {
    const newline = buffer.indexOf(0x0a)
    if (newline < 0) return undefined
    frame = buffer.subarray(0, newline + 1)
    text = frame.toString('utf8')
    rest = buffer.subarray(newline + 1)
  }
  if (!text.endsWith('\n')) return undefined
  const line = text.slice(0, -1)
  if (line.length === 0 || line.includes('\n')) return undefined
  let header
  try {
    header = JSON.parse(line)
  } catch {
    return undefined
  }
  if (header === null || typeof header !== 'object' || Array.isArray(header)) return undefined
  if (header.type !== 'session' || typeof header.id !== 'string' || header.id.length === 0) return undefined
  if (header.cwd !== undefined && typeof header.cwd !== 'string') return undefined
  return { header: /** @type {{type: string, id: string, cwd?: string, [key: string]: unknown}} */ (header), text, frame, rest }
}

/**
 * 编码一个 header 行为独立帧（zstd 时与宿主同参数，含 checksum）。
 * @param {{type: string, id: string, [key: string]: unknown}} header - header 对象。
 * @param {boolean} compressed - 是否 zstd 编码。
 * @returns {Buffer} 首帧/首行字节。
 */
export function encodeSessionHeader(header, compressed) {
  const line = Buffer.from(`${JSON.stringify(header)}\n`, 'utf8')
  return compressed ? zstdCompressSync(line, ZSTD_CHECKSUM_OPTIONS) : line
}

/**
 * 用新 header 替换首帧/首行，其余字节原样保留。
 * @param {Buffer} buffer - 原文件字节。
 * @param {boolean} compressed - 是否 zstd 编码。
 * @param {{type: string, id: string, cwd?: string, [key: string]: unknown}} header - 新 header。
 * @returns {Buffer|undefined} 改写后的字节；输入不可解析时 undefined。
 */
export function rewriteSessionHeader(buffer, compressed, header) {
  const parsed = readSessionHeader(buffer, compressed)
  if (parsed === undefined) return undefined
  return Buffer.concat([encodeSessionHeader(header, compressed), parsed.rest])
}
