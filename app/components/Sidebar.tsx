"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";

type Profile = {
  id?: string;
  full_name?: string | null;
  role?: string | null;
  school_id?: number | null;
};

type School = {
  id: number;
  school_name: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
};

type NavItem = {
  label: string;
  href: string;
  match?: string[];
  view?: string;
};

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    loadSidebarContext();
  }, [pathname, searchParams]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname, searchParams]);

  async function loadSidebarContext() {
    setLoading(true);

    const { profile: currentProfile } = await getCurrentProfile();

    if (!currentProfile) {
      setProfile(null);
      setSchool(null);
      setLoading(false);
      return;
    }

    setProfile(currentProfile);

    let schoolId: number | null = null;

    const schoolFromQuery = searchParams.get("school");
    const masterSchoolMatch = pathname.match(/^\/master\/school\/(\d+)$/);

    if (schoolFromQuery) {
      schoolId = Number(schoolFromQuery);
    } else if (masterSchoolMatch?.[1]) {
      schoolId = Number(masterSchoolMatch[1]);
    } else if (currentProfile.role !== "master" && currentProfile.school_id) {
      schoolId = Number(currentProfile.school_id);
    }

    if (!schoolId || Number.isNaN(schoolId)) {
      setSchool(null);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("schools")
      .select("id, school_name, logo_url, primary_color, secondary_color")
      .eq("id", schoolId)
      .single();

    setSchool(data || null);
    setLoading(false);
  }

  const masterNav = useMemo<NavItem[]>(
    () => [
      {
        label: "Master Dashboard",
        href: "/master?view=manage-schools",
        match: ["/master"],
        view: "manage-schools",
      },
      {
        label: "Manage Schools",
        href: "/master?view=manage-schools",
        match: ["/master"],
        view: "manage-schools",
      },
      {
  label: "Principal Management",
  href: "/principals",
  match: ["/principals"],
},
      {
        label: "Active Principals",
        href: "/master?view=active-principals",
        match: ["/master"],
        view: "active-principals",
      },
      {
        label: "Schools Needing Setup",
        href: "/master?view=schools-needing-setup",
        match: ["/master"],
        view: "schools-needing-setup",
      },
    ],
    []
  );

  const schoolScopedNav = useMemo<NavItem[]>(() => {
    const schoolQuery = school ? `?school=${school.id}` : "";

    if (profile?.role === "master") {
      return [
        {
          label: "Dashboard",
          href: `/master/school/${school?.id || ""}`,
          match: ["/master/school"],
        },
        {
          label: "Learners",
          href: `/children${schoolQuery}`,
          match: ["/children"],
        },
        {
          label: "Events",
          href: `/events${schoolQuery}`,
          match: ["/events"],
        },
        {
          label: "Attendance",
          href: `/attendance${schoolQuery}`,
          match: ["/attendance"],
        },
        {
          label: "Summaries",
          href: `/summaries${schoolQuery}`,
          match: ["/summaries"],
        },
        {
          label: "Broadcasts",
          href: `/broadcasts${schoolQuery}`,
          match: ["/broadcasts"],
        },
        {
          label: "Payments",
          href: `/payments${schoolQuery}`,
          match: ["/payments"],
        },
        {
          label: "Teachers",
          href: `/teachers${schoolQuery}`,
          match: ["/teachers"],
        },
        {
          label: "Classrooms",
          href: `/classrooms${schoolQuery}`,
          match: ["/classrooms"],
        },
        {
          label: "Reports",
          href: `/reports${schoolQuery}`,
          match: ["/reports"],
        },
      ];
    }

    if (profile?.role === "teacher") {
      return [
        {
          label: "Dashboard",
          href: "/teacher",
          match: ["/teacher"],
        },
        {
          label: "Today’s Activities",
          href: "/activities",
          match: ["/activities"],
        },
        {
          label: "Learners",
          href: "/children",
          match: ["/children"],
        },
        {
          label: "Attendance",
          href: "/attendance",
          match: ["/attendance"],
        },
        {
          label: "Summaries",
          href: "/summaries",
          match: ["/summaries"],
        },
        {
          label: "Events",
          href: "/events",
          match: ["/events"],
        },
      ];
    }

    return [
      {
        label: "Dashboard",
        href: "/dashboard",
        match: ["/dashboard"],
      },
      {
        label: "Today’s Activities",
        href: "/activities",
        match: ["/activities"],
      },
      {
        label: "Reports",
        href: "/reports",
        match: ["/reports"],
      },
      {
        label: "Communications",
        href: "/communications",
        match: ["/communications"],
      },
      {
        label: "Learners",
        href: "/children",
        match: ["/children"],
      },
      {
        label: "Teachers",
        href: "/teachers",
        match: ["/teachers"],
      },
      {
        label: "Classrooms",
        href: "/classrooms",
        match: ["/classrooms"],
      },
      {
        label: "Events",
        href: "/events",
        match: ["/events"],
      },
      {
        label: "Attendance",
        href: "/attendance",
        match: ["/attendance"],
      },
      {
        label: "Summaries",
        href: "/summaries",
        match: ["/summaries"],
      },
      {
        label: "Broadcasts",
        href: "/broadcasts",
        match: ["/broadcasts"],
      },
      {
        label: "Payments",
        href: "/payments",
        match: ["/payments"],
      },
    ];
  }, [profile?.role, school]);

  const isMaster = profile?.role === "master";
  const showSchoolActions = Boolean(school) || !isMaster;

  return (
    <aside className="db-sidebar-shell">
      <div className="db-sidebar-mobile-bar">
        <div>
          <p className="db-sidebar-brand-mini">DAILYBLOOM</p>
          <p className="db-sidebar-role-mini">
            {profile?.role ? `Role: ${profile.role}` : "Menu"}
          </p>
        </div>

        <button
          type="button"
          className="db-mobile-menu-button"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
        >
          {isMobileMenuOpen ? "Close" : "Menu"}
        </button>
      </div>

      <div className={`db-sidebar-content ${isMobileMenuOpen ? "open" : ""}`}>
        <div
          style={{
            background: "linear-gradient(135deg, #F8E8F0 0%, #FFF8F2 100%)",
            border: "1px solid #EBC9D8",
            borderRadius: "24px",
            padding: "18px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "#8A84A3",
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            DAILYBLOOM
          </p>

          <h2
            style={{
              margin: "6px 0 0 0",
              fontSize: "20px",
              color: "#2D2A3E",
              fontWeight: 700,
            }}
          >
            Preschool Management App
          </h2>

          {profile?.role ? (
            <p
              style={{
                margin: "10px 0 0 0",
                fontSize: "13px",
                color: "#5B5675",
                textTransform: "capitalize",
                fontWeight: 500,
              }}
            >
              Role: {profile.role}
            </p>
          ) : null}
        </div>

        <div
          style={{
            background: "#FFFDFB",
            border: "1px solid #F0E3D8",
            borderRadius: "18px",
            padding: "12px",
          }}
        >
          {loading ? (
            <p
              style={{
                margin: 0,
                color: "#6D6888",
                fontSize: "14px",
              }}
            >
              Loading school context...
            </p>
          ) : school ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                minWidth: 0,
              }}
            >
              {school.logo_url ? (
                <img
                  src={school.logo_url}
                  alt={`${school.school_name} logo`}
                  style={{
                    width: "52px",
                    height: "52px",
                    objectFit: "cover",
                    borderRadius: "16px",
                    border: "1px solid #F0E3D8",
                    background: "#FFFFFF",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "16px",
                    border: "1px solid #F0E3D8",
                    background: "#F8E8F0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#2D2A3E",
                    fontWeight: 700,
                    fontSize: "22px",
                    flexShrink: 0,
                  }}
                >
                  {school.school_name?.charAt(0)?.toUpperCase() || "S"}
                </div>
              )}

              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "#8A84A3",
                    fontWeight: 700,
                  }}
                >
                  Current School
                </p>

                <p
                  style={{
                    margin: "3px 0 0 0",
                    fontSize: "16px",
                    color: "#2D2A3E",
                    fontWeight: 700,
                    lineHeight: 1.3,
                    wordBreak: "break-word",
                  }}
                >
                  {school.school_name}
                </p>

                <p
                  style={{
                    margin: "3px 0 0 0",
                    fontSize: "12px",
                    color: "#6D6888",
                  }}
                >
                  School context is active
                </p>
              </div>
            </div>
          ) : (
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "#8A84A3",
                  fontWeight: 700,
                }}
              >
                Current School
              </p>

              <p
                style={{
                  margin: "8px 0 0 0",
                  color: "#6D6888",
                  fontSize: "14px",
                  lineHeight: 1.5,
                }}
              >
                {isMaster
                  ? "Select a school from Manage Schools to load school context."
                  : "No school linked yet."}
              </p>
            </div>
          )}

          {isMaster && school ? (
            <Link
              href={`/master/school/${school.id}`}
              style={{
                display: "inline-block",
                marginTop: "12px",
                textDecoration: "none",
                background: "#7CCCF3",
                color: "#2D2A3E",
                padding: "10px 14px",
                borderRadius: "12px",
                fontWeight: 600,
                fontSize: "13px",
                border: "1px solid #CBEAF7",
              }}
            >
              Open School Overview
            </Link>
          ) : null}
        </div>

        {isMaster ? (
          <NavSection
            title="Platform"
            items={masterNav}
            pathname={pathname}
            currentView={searchParams.get("view")}
          />
        ) : null}

        {showSchoolActions ? (
          <NavSection
            title={isMaster ? "Selected School" : "School Management"}
            items={schoolScopedNav}
            pathname={pathname}
            currentView={null}
          />
        ) : null}

        <div
          style={{
            background: "#FFF7D9",
            border: "1px solid #F3E4A3",
            borderRadius: "20px",
            padding: "14px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "#6D6888",
              fontWeight: 700,
            }}
          >
            What this dashboard can do
          </p>

          <p
            style={{
              margin: "8px 0 0 0",
              fontSize: "13px",
              color: "#5B5675",
              lineHeight: 1.6,
              fontWeight: 400,
            }}
          >
            Manage learners, events, attendance, summaries, classrooms, teachers,
            reports, and school activity without losing school context.
          </p>
        </div>
      </div>
    </aside>
  );
}

function NavSection({
  title,
  items,
  pathname,
  currentView,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  currentView?: string | null;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #F0E3D8",
        borderRadius: "22px",
        padding: "14px",
      }}
    >
      <p
        style={{
          margin: "0 0 10px 0",
          fontSize: "12px",
          color: "#8A84A3",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {title}
      </p>

      <div style={{ display: "grid", gap: "8px" }}>
        {items.map((item) => {
          const isActive = item.view
            ? pathname.startsWith("/master") && currentView === item.view
            : item.match?.some((segment) => pathname.startsWith(segment)) ||
              pathname === item.href;

          return (
            <Link
              key={`${title}-${item.label}`}
              href={item.href}
              style={{
                textDecoration: "none",
                background: isActive ? "#EAF7FD" : "#FFFDFB",
                color: "#2D2A3E",
                border: isActive ? "1px solid #CBEAF7" : "1px solid #F0E3D8",
                padding: "12px 14px",
                borderRadius: "14px",
                fontSize: "14px",
                fontWeight: isActive ? 700 : 600,
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}