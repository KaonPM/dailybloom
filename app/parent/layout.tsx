import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentParent } from "@/app/lib/getCurrentParent";
import ParentTopBar from "./components/ParentTopBar";

export default async function ParentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const parent = await getCurrentParent();

  if (!parent) {
    redirect("/parent-login");
  }

  const child =
    parent.children?.length > 0
      ? parent.children[0]
      : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FFF8F5",
      }}
    >
      <ParentTopBar
        parent={parent}
        child={child}
      />

      <main
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "30px 24px",
        }}
      >
        {children}
      </main>
    </div>
  );
}