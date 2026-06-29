import { redirect } from "next/navigation"

/**
 * /check → redirect to /racks?view=inspection
 * R.91.1: 原始 17-tab 页已合并到盘架管理巡检区域
 */
export default function CheckPage() {
  redirect("/racks?view=inspection")
}