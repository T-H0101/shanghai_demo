/**
 * SHA-256 完整性摘要 (NOT 数字签名)
 *
 * R.1 §7 严格区分:
 *   - "数字签名" 需要证书/私钥, 项目未托管 → 禁止伪造
 *   - "SHA-256 摘要" 只校验内容完整性 → 可用
 *
 * header 字段名: x-sha256 (R.13 起统一, 旧端点 x-content-sha256 兼容)
 */

import { createHash } from "node:crypto"

export function contentSha256(body: string | Buffer): string {
  return createHash("sha256").update(body).digest("hex")
}
