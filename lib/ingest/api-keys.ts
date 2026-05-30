/**
 * API Key 校验
 * Sprint 2B.6 - Tasks Ingest API
 *
 * 使用环境变量配置 API Key，格式：
 * INGEST_API_KEY_{siteCode}=your-secret-key
 */

/**
 * 校验 API Key 是否有效
 * @returns 有效返回 siteCode，无效返回 null
 */
export function validateApiKey(apiKey: string): string | null {
  if (!apiKey) {
    return null
  }

  // 遍历环境变量，查找匹配的 API Key
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('INGEST_API_KEY_') && value === apiKey) {
      // 提取 siteCode: INGEST_API_KEY_SH01 -> SH01
      const siteCode = key.replace('INGEST_API_KEY_', '')
      if (siteCode && siteCode.length > 0) {
        return siteCode
      }
    }
  }

  return null
}

/**
 * 校验 siteCode 是否与 API Key 匹配
 */
export function validateSiteCodeMatch(
  apiKey: string,
  siteCode: string
): boolean {
  const matchedSiteCode = validateApiKey(apiKey)
  return matchedSiteCode !== null && matchedSiteCode === siteCode
}
