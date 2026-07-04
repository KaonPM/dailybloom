"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SelectChildPage() {
  const router = useRouter();

  const [children, setChildren] = useState<any[]>([]);

  useEffect(() => {
    const storedChildren =
      localStorage.getItem("parentChildren");

    if (!storedChildren) {
      router.push("/parent-login");
      return;
    }

    setChildren(JSON.parse(storedChildren));
  }, [router]);

  const handleSelectChild = (child: any) => {
    localStorage.setItem(
      "selectedChild",
      JSON.stringify(child)
    );

    router.push("/parent/dashboard");
  };

  return (
    <div
      style={{
        padding: "30px",
      }}
    >
      <div
        style={{
          marginBottom: "30px",
        }}
      >
        <h1
          style={{
            color: "#2D2A3E",
            marginBottom: "8px",
            fontSize: "32px",
          }}
        >
          My Children
        </h1>

        <p
          style={{
            color: "#6D6888",
          }}
        >
          Choose a learner to continue
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fill,minmax(250px,1fr))",
          gap: "20px",
        }}
      >
        {children.map((child) => (
          <div
            key={child.id}
            onClick={() =>
              handleSelectChild(child)
            }
            style={{
              background: "#fff",
              borderRadius: "18px",
              padding: "24px",
              cursor: "pointer",
              border: "1px solid #eee",
              transition: "0.3s",
              boxShadow:
                "0 2px 10px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                width: "70px",
                height: "70px",
                borderRadius: "50%",
                background: "#FFE6F1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "32px",
                marginBottom: "15px",
              }}
            >
              👶
            </div>

            <h3
              style={{
                color: "#2D2A3E",
                marginBottom: "8px",
              }}
            >
              {child.name}
            </h3>

            <div
              style={{
                color: "#6D6888",
                fontSize: "14px",
              }}
            >
              Tap to view profile
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}