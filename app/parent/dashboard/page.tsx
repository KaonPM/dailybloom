"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ParentDashboard() {
  const router = useRouter();

  const [child, setChild] = useState<any>(null);

  useEffect(() => {
    const loggedIn =
      localStorage.getItem(
        "parentLoggedIn"
      );

    const selectedChild =
      localStorage.getItem(
        "selectedChild"
      );

    if (!loggedIn) {
      router.push("/parent-login");
      return;
    }

    if (selectedChild) {
      setChild(
        JSON.parse(selectedChild)
      );
    }
  }, [router]);

  if (!child) {
    return null;
  }

  return (
    <div>

      <h1>
        Welcome 👋
      </h1>

      <div
        style={{
          marginTop: "30px",
          background: "#fff",
          padding: "25px",
          borderRadius: "18px",
          border: "1px solid #eee"
        }}
      >
        <h2>{child.name}</h2>

        <p>
          Class: {child.class || "Not assigned"}
        </p>
      </div>

    </div>
  );
}