import { redirect } from "next/navigation";
import { getCurrentParent } from "@/app/lib/getCurrentParent";
import ParentDashboardClient from "./ParentDashboardClient";

export default async function ParentDashboard() {
  const parent = await getCurrentParent();

  if (!parent) {
    redirect("/parent-login");
  }

  const children = parent.children || [];

  if (children.length === 0) {
    return (
      <div style={{ padding: "40px" }}>
        <h1>No child found</h1>
        <p>No learners are linked to this account.</p>
      </div>
    );
  }

  return <ParentDashboardClient learners={children} parent={parent} />;
}
