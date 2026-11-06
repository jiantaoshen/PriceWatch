// Keep old local bookmarks working; email delivery/settings have been removed.
import { redirect } from "next/navigation";
export default function FormerEmailPage() { redirect("/notifications"); }
