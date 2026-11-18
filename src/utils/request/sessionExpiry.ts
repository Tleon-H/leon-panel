// 被新的首页请求取代、换了账号或已经离开页面时，迟到的 1000/1001 不能再清当前会话。
// 没提供 sessionCurrent 的请求保持原来的行为：这两个业务码仍然退出登录。

export function staleSessionResponse(code: unknown, sessionCurrent?: () => boolean): boolean {
  if (code !== 1000 && code !== 1001)
    return false
  if (!sessionCurrent)
    return false
  return !sessionCurrent()
}
