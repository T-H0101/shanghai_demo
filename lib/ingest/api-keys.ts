/**
 * API Key 校验
 * Sprint 2B.6 - Tasks Ingest API
 *
 * 使用环境变量配置 API Key，格式：
 * INGEST_API_KEY_{siteCode}=your-secret-key
 */

// 模块加载时构建 API Key 映射表（O(1) 查找）
const apiKeyMap = new Map<string, string>()
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith('INGEST_API_KEY_') && value) {
    const siteCode = key.replace('INGEST_API_KEY_', '')
    if (siteCode) {
      apiKeyMap.set(value, siteCode)
    }
  }
}

/**
 * 校验 API Key 是否有效
 * @returns 有效返回 siteCode，无效返回 null
 */
export function validateApiKey(apiKey: string): string | null {
  if (!apiKey) {
    return null
  }
  return apiKeyMap.get(apiKey) || null
}

/**
 * 校验 siteCode 是否与已验证的 siteCode 匹配
 */
export function validateSiteCodeMatch(
  matchedSiteCode: string,
  requestSiteCode: string
): boolean {
  return matchedSiteCode === requestSiteCode
}
