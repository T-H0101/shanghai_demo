import { redirect } from "next/navigation"

export default function ControlPage() {
  redirect("/tasks?view=commands")
}
