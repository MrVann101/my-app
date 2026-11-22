import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import { getSessionWithAdminCheck } from "@/lib/admin-auth";
import AdminConsole from "./admin-console";

export const metadata: Metadata = {
  title: "Admin Console | Bitewise",
  description: "Review user suggestions, experience ratings, and public meal plans.",
};

export default async function AdminPage() {
  const { user, isAdmin } = await getSessionWithAdminCheck();
  if (!user) {
    redirect("/login");
  }
  if (!isAdmin) {
    redirect("/dashboard");
  }

  return (
    <AppShell eyebrow="Admin" title="Admin Console">
      <AdminConsole />
    </AppShell>
  );
}
