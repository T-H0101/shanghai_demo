import { redirect } from "next/navigation"

/**
 * /volumes → redirect to /racks?view=volumes
 * R.91.1: 存储卷管理已合并到盘架管理容量区域
 */
export default function VolumesPage() {
  redirect("/racks?view=volumes")
}