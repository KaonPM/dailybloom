"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { getAllowedNavigationItems } from "../lib/navigation-access";
import { Permission, PERMISSIONS } from "../lib/permissions";
import { permissionForSchoolPath } from "../lib/navigation-permissions";
import { isGradeRClassroom } from "../lib/classroom-programme";

type Profile = {
  id?: string;
  full_name?: string | null;
  role?: string | null;
  school_id?: number | null;
  permissions?: string[] | null;
};

type School = {
  id: number;
  school_name: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  package_name?: string | null;
  wageflow_enabled?: boolean | null;
};

type NavItem = {
  label: string;
  href: string;
  match?: string[];
  view?: string;
  featureKey?: string;
  permission?: Permission;
  newTab?: boolean;
};

type WorkflowGroup = {
  key: string;
  label: string;
  color: string;
  items: NavItem[];
  externalItems?: Array<{ label: string; href: string }>;
};

function displayRole(role?: string | null) {
  if (!role) return "";
  if (role.toLowerCase() === "teacher") return "Practitioner";
  return role.replaceAll("_", " ");
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  const [filteredQuickActionsNav, setFilteredQuickActionsNav] = useState<NavItem[]>([]);
  const [filteredTeacherQuickActionsNav, setFilteredTeacherQuickActionsNav] = useState<NavItem[]>([]);
  const [filteredSchoolManagementNav, setFilteredSchoolManagementNav] = useState<NavItem[]>([]);
  const [filteredTeacherSchoolManagementNav, setFilteredTeacherSchoolManagementNav] = useState<NavItem[]>([]);

  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [openWorkflowGroups, setOpenWorkflowGroups] = useState<
    Record<string, { pathname: string; open: boolean }>
  >({});

  const masterNav = useMemo<NavItem[]>(
    () => [
      {
        label: "Master Dashboard",
        href: "/master?view=dashboard",
        match: ["/master"],
        view: "dashboard",
      },
      {
        label: "DailyBloom Support",
        href: "/messages",
        match: ["/messages"],
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
        label: "Master Admin Access",
        href: "/platform-access",
        match: ["/platform-access"],
      },
      {
        label: "Onboarding Pipeline",
        href: "/onboarding",
        match: ["/onboarding"],
      },
      {
        label: "Billing Overview",
        href: "/billing",
        match: [],
      },
      {
        label: "Platform Reports",
        href: "/master/reports",
        match: ["/master/reports"],
      },
      {
        label: "Trust & Security",
        href: "/master/trust-security",
        match: ["/master/trust-security"],
      },
      {
        label: "Platform Analytics",
        href: "/master/analytics",
        match: ["/master/analytics"],
      },
      {
        label: "DBE Resource Reviews",
        href: "/master/resource-reviews",
        match: ["/master/resource-reviews"],
      },
      {
        label: "Impact & Sponsorship",
        href: "/master/impact",
        match: ["/master/impact"],
      },
    ],
    []
  );

  const quickActionsNav = useMemo<NavItem[]>(
    () => [
      { label: "Add Learner", href: "/enrolments?action=add", match: ["/enrolments"], permission: PERMISSIONS.LEARNERS_MANAGE, newTab: true },
      { label: "Add Practitioner", href: "/teachers?action=add", match: ["/teachers"], permission: PERMISSIONS.STAFF_MANAGE },
      { label: "Add Event", href: "/events", match: ["/events"], permission: PERMISSIONS.EVENTS_MANAGE },
      {
        label: "Create Broadcast",
        href: "/broadcasts",
        match: ["/broadcasts"],
        permission: PERMISSIONS.BROADCASTS_MANAGE,
      },
      {
        label: "Record Payment",
        href: "/payments",
        match: ["/payments"],
        featureKey: "payment_tracking",
        permission: PERMISSIONS.BILLING_MANAGE,
      },
    ],
    []
  );

  const teacherQuickActionsNav = useMemo<NavItem[]>(
    () => [
      {
        label: "Take Attendance",
        href: "/attendance",
        match: ["/attendance"],
      },
      {
        label: "Daily Summaries",
        href: "/summaries",
        match: ["/summaries"],
        featureKey: "daily_summaries",
      },
      {
        label: "View Learners",
        href: "/children",
        match: ["/children"],
      },
      {
        label: "Today’s Activities",
        href: "/classroom-activities",
        match: ["/classroom-activities"],
      },
      {
        label: "Class Broadcasts",
        href: "/broadcasts",
        match: ["/broadcasts"],
      },
      {
        label: "Progress Reports",
        href: "/progress-reports",
        match: ["/progress-reports"],
      },
    ],
    []
  );

  const dbeNav = useMemo<NavItem[]>(
    () => [
      {
        label: "Registration Details",
        href: "/dbe-registration",
        match: ["/dbe-registration"],
        permission: PERMISSIONS.DBE_MANAGE,
      },
      {
        label: "Compliance Documents",
        href: "/dbe-registration/documents",
        match: ["/dbe-registration/documents"],
        permission: PERMISSIONS.DBE_MANAGE,
      },
    ],
    []
  );

  const schoolManagementNav = useMemo<NavItem[]>(
    () => [
      { label: "Learners", href: "/children", match: ["/children"], permission: PERMISSIONS.LEARNERS_MANAGE },
      { label: "Enrolments", href: "/enrolments", match: ["/enrolments"], permission: PERMISSIONS.LEARNERS_MANAGE },
      { label: "Re-enrolments", href: "/re-enrolments", match: ["/re-enrolments"], permission: PERMISSIONS.SCHOOL_MANAGE },
      {
        label: "Awaiting Classroom Allocation",
        href: "/awaiting-classroom-allocation",
        match: ["/awaiting-classroom-allocation"],
        permission: PERMISSIONS.SCHOOL_MANAGE,
      },
      { label: "Meetings, Minutes & Surveys", href: "/school-administration", match: ["/school-administration"], permission: PERMISSIONS.SCHOOL_MANAGE },
      { label: "Data Migration", href: "/data-migration", match: ["/data-migration"], permission: PERMISSIONS.SCHOOL_MANAGE },
      { label: "Classrooms", href: "/classrooms", match: ["/classrooms"], permission: PERMISSIONS.CLASSROOM_ASSIGN },
      {
        label: "Learner Attendance",
        href: "/attendance",
        match: ["/attendance"],
        permission: PERMISSIONS.ATTENDANCE_MANAGE,
      },
      {
        label: "Practitioner Attendance",
        href: "/teacher-attendance",
        match: ["/teacher-attendance"],
        permission: PERMISSIONS.TEACHER_ATTENDANCE_MANAGE,
      },
      {
        label: "Classroom Activities",
        href: "/classroom-activities",
        match: ["/classroom-activities"],
        permission: PERMISSIONS.ACTIVITIES_MANAGE,
      },
      {
        label: "Grade R Learning Hub",
        href: "/grade-r-learning",
        match: ["/grade-r-learning"],
        permission: PERMISSIONS.ACTIVITIES_MANAGE,
      },
      { label: "Events", href: "/events", match: ["/events"], permission: PERMISSIONS.EVENTS_MANAGE },
      {
        label: "Summaries",
        href: "/summaries",
        match: ["/summaries"],
        featureKey: "daily_summaries",
        permission: PERMISSIONS.SUMMARIES_MANAGE,
      },
      { label: "Broadcasts", href: "/broadcasts", match: ["/broadcasts"], permission: PERMISSIONS.BROADCASTS_MANAGE },
      {
        label: "Parent Consent",
        href: "/parent-permissions",
        match: ["/parent-permissions"],
        permission: PERMISSIONS.PARENT_PERMISSIONS_MANAGE,
      },
      {
        label: "Incident Reports",
        href: "/incident-reports",
        match: ["/incident-reports"],
        permission: PERMISSIONS.INCIDENT_REVIEW,
      },
      {
        label: "Payments",
        href: "/payments",
        match: ["/payments"],
        featureKey: "payment_tracking",
        permission: PERMISSIONS.BILLING_MANAGE,
      },
      {
        label: "Learner Requirements Tracking",
        href: "/learner-requirements",
        match: ["/learner-requirements"],
        featureKey: "learner_requirements",
        permission: PERMISSIONS.REQUIREMENTS_VIEW,
      },
      {
        label: "Progress Reports",
        href: "/progress-reports",
        match: ["/progress-reports"],
        permission: PERMISSIONS.PROGRESS_REPORTS_MANAGE,
      },
      {
        label: "Progress Review",
        href: "/teacher-assessments",
        match: ["/teacher-assessments"],
        permission: PERMISSIONS.PROGRESS_REPORTS_MANAGE,
      },
      {
        label: "Achievement Awards",
        href: "/achievement-awards",
        match: ["/achievement-awards"],
        permission: PERMISSIONS.AWARDS_MANAGE,
      },
      {
          label: "Communication Centre",
        href: "/communications",
        match: ["/communications"],
        permission: PERMISSIONS.MESSAGE_VIEW,
      },
      {
        label: "Reports",
        href: "/reports",
        match: ["/reports"],
        permission: PERMISSIONS.REPORTS_VIEW,
      },
      {
        label: "School Analytics",
        href: "/analytics",
        match: ["/analytics"],
        featureKey: "advanced_school_analytics",
        permission: PERMISSIONS.ANALYTICS_VIEW,
      },
      {
        label: "School Printable Documents",
        href: "/school-documents",
        match: ["/school-documents"],
        permission: PERMISSIONS.SCHOOL_DOCUMENTS_MANAGE,
      },
      {
        label: "School Setup",
        href: "/school-setup",
        match: ["/school-setup"],
        permission: PERMISSIONS.SCHOOL_MANAGE,
      },
      {
        label: "Trust & Security",
        href: "/trust-security",
        match: ["/trust-security"],
        permission: PERMISSIONS.REPORTS_VIEW,
      },
      { label: "Billing Overview", href: "/billing", match: [], permission: PERMISSIONS.BILLING_MANAGE },
    ],
    []
  );

  const teacherSchoolManagementNav = useMemo<NavItem[]>(
      () => [
        {
          label: "Communication Centre",
          href: "/communications",
          match: ["/communications"],
          permission: PERMISSIONS.MESSAGE_VIEW,
        },
      {
        label: "Classroom Activities",
        href: "/classroom-activities",
        match: ["/classroom-activities"],
      },
      {
        label: "Grade R Learning Hub",
        href: "/grade-r-learning",
        match: ["/grade-r-learning"],
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
        label: "Incident Reports",
        href: "/incident-reports",
        match: ["/incident-reports"],
      },
      {
        label: "Daily Summaries",
        href: "/summaries",
        match: ["/summaries"],
        featureKey: "daily_summaries",
      },
      {
        label: "Events",
        href: "/events",
        match: ["/events"],
      },
      {
        label: "Progress Reports",
        href: "/progress-reports",
        match: ["/progress-reports"],
      },
      {
        label: "Progress Review",
        href: "/teacher-assessments",
        match: ["/teacher-assessments"],
      },
      {
        label: "Achievement Awards",
        href: "/achievement-awards",
        match: ["/achievement-awards"],
      },
    ],
    []
  );

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
      setSubscriptionPlan("");
      setUnreadMessageCount(0);
      setFilteredQuickActionsNav([]);
      setFilteredTeacherQuickActionsNav([]);
      setFilteredSchoolManagementNav([]);
      setFilteredTeacherSchoolManagementNav([]);
      setLoading(false);
      return;
    }

    setProfile(currentProfile);
    fetchUnreadMessageCount(String(currentProfile.id || ""));

    let schoolId: number | null = null;

    const schoolFromQuery = searchParams.get("school");
    const masterSchoolMatch = pathname.match(/^\/master\/school\/(\d+)$/);

    if (schoolFromQuery) {
      const parsedSchoolId = Number(schoolFromQuery);
      schoolId = Number.isFinite(parsedSchoolId) ? parsedSchoolId : null;
    } else if (masterSchoolMatch?.[1]) {
      const parsedSchoolId = Number(masterSchoolMatch[1]);
      schoolId = Number.isFinite(parsedSchoolId) ? parsedSchoolId : null;
    } else if (currentProfile.role !== "master" && currentProfile.school_id) {
      schoolId = Number(currentProfile.school_id);
    }

    const [
      allowedQuickActions,
      allowedTeacherQuickActions,
      allowedSchoolManagement,
      allowedTeacherManagement,
      gradeRClassrooms,
    ] = await Promise.all([
      getAllowedNavigationItems(schoolId, quickActionsNav),
      getAllowedNavigationItems(schoolId, teacherQuickActionsNav),
      getAllowedNavigationItems(schoolId, schoolManagementNav),
      getAllowedNavigationItems(schoolId, teacherSchoolManagementNav),
      schoolId
        ? supabase.from("classrooms").select("classroom_name").eq("school_id", schoolId)
        : Promise.resolve({ data: [] as Array<{ classroom_name?: string | null }> }),
    ]);

    const hasGradeRClassroom = (gradeRClassrooms.data || []).some((classroom) =>
      isGradeRClassroom(classroom.classroom_name)
    );
    const hideGradeRHubWhenUnavailable = (items: NavItem[]) =>
      hasGradeRClassroom
        ? items
        : items.filter((item) => item.href !== "/grade-r-learning");

    const delegatedPermissions = new Set(
      Array.isArray(currentProfile.permissions) ? currentProfile.permissions : []
    );
    const requiredPathPermission = permissionForSchoolPath(pathname);
    if (
      currentProfile.role === "admin" &&
      requiredPathPermission &&
      !delegatedPermissions.has(requiredPathPermission)
    ) {
      setLoading(false);
      router.replace("/dashboard");
      return;
    }
    const filterForDelegatedAdmin = (items: NavItem[]) =>
      currentProfile.role === "admin"
        ? items.filter(
            (item) => !item.permission || delegatedPermissions.has(item.permission)
          )
        : items;

    setFilteredQuickActionsNav(filterForDelegatedAdmin(allowedQuickActions));
    setFilteredSchoolManagementNav(hideGradeRHubWhenUnavailable(filterForDelegatedAdmin(allowedSchoolManagement)));

    if (currentProfile.role === "teacher") {
      setFilteredTeacherQuickActionsNav(teacherQuickActionsNav);
      setFilteredTeacherSchoolManagementNav(hideGradeRHubWhenUnavailable(teacherSchoolManagementNav));
    } else {
      setFilteredTeacherQuickActionsNav(filterForDelegatedAdmin(allowedTeacherQuickActions));
      setFilteredTeacherSchoolManagementNav(hideGradeRHubWhenUnavailable(filterForDelegatedAdmin(allowedTeacherManagement)));
    }

    if (!schoolId || Number.isNaN(schoolId)) {
      setSchool(null);
      setSubscriptionPlan("");
      setLoading(false);
      return;
    }

    const [{ data: schoolData }, { data: subscriptionData }] = await Promise.all([
      supabase
        .from("schools")
        .select(
          "id, school_name, logo_url, primary_color, secondary_color, package_name, wageflow_enabled"
        )
        .eq("id", schoolId)
        .single(),

      supabase
        .from("school_subscriptions")
        .select("plan_name, status")
        .eq("school_id", schoolId)
        .maybeSingle(),
    ]);

    setSchool((schoolData || null) as School | null);
    setSubscriptionPlan(
      String(subscriptionData?.plan_name || schoolData?.package_name || "")
    );
    setLoading(false);
  }

  async function fetchUnreadMessageCount(profileId: string) {
    if (!profileId) {
      setUnreadMessageCount(0);
      return;
    }

    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", profileId)
      .eq("is_read", false);

    if (error) {
      setUnreadMessageCount(0);
      return;
    }

    setUnreadMessageCount(count || 0);
  }

  const isMaster = profile?.role === "master";
  const isMasterAdmin = profile?.role === "master_admin";
  const isTeacher = profile?.role === "teacher";
  const isAdmin = profile?.role === "admin";
  const delegatedPermissions = new Set(profile?.permissions || []);
  const canManagePreschoolAdmins =
    profile?.role === "owner" || profile?.role === "principal" || (isMaster && Boolean(school?.id));
  const canViewTeachers =
    !isTeacher && (!isAdmin || delegatedPermissions.has(PERMISSIONS.STAFF_VIEW));
  const canViewDbe =
    !isTeacher && (!isAdmin || delegatedPermissions.has(PERMISSIONS.DBE_MANAGE));
  const canViewMessages =
    !isAdmin || delegatedPermissions.has(PERMISSIONS.MESSAGE_VIEW);
  const showSchoolActions = !isMasterAdmin && (Boolean(school) || !isMaster);

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`sidebar-messages-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const nextMessage = payload.new as
            | { recipient_id?: string | null; sender_id?: string | null }
            | null;
          const oldMessage = payload.old as
            | { recipient_id?: string | null; sender_id?: string | null }
            | null;

          if (
            String(nextMessage?.recipient_id || "") === String(profile.id) ||
            String(oldMessage?.recipient_id || "") === String(profile.id)
          ) {
            fetchUnreadMessageCount(String(profile.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const isBloomElite =
    String(subscriptionPlan || school?.package_name || "")
      .trim()
      .toLowerCase() === "bloom elite";

  const showWageFlowStaffManagement =
    !isTeacher && (isBloomElite || school?.wageflow_enabled === true);

  function withSchoolContext(href: string) {
    if (!isMaster || !school?.id) {
      return href;
    }

    if (href.startsWith("http")) {
      return href;
    }

    if (href.startsWith("/master")) {
      return href;
    }

    const separator = href.includes("?") ? "&" : "?";
    return `${href}${separator}school=${school.id}`;
  }

  const dashboardHref =
    isMaster && school?.id
      ? `/dashboard?school=${school.id}`
      : isTeacher
      ? "/teacher"
      : "/dashboard";

  const dashboardMatch = isTeacher ? ["/teacher"] : ["/dashboard"];

  function isActiveNav(item: NavItem) {
    if (item.view) {
      return pathname.startsWith("/master") && searchParams.get("view") === item.view;
    }

    return (
      item.match?.some((segment) => pathname.startsWith(segment)) ||
      pathname === item.href
    );
  }

  function navStyle(item: NavItem) {
    const isActive = isActiveNav(item);

    return {
      textDecoration: "none",
      background: isActive ? "#EAF7FD" : "#FFFDFB",
      color: "#2D2A3E",
      border: isActive ? "1px solid #CBEAF7" : "1px solid #F0E3D8",
      padding: "12px 14px",
      borderRadius: "14px",
      fontSize: "14px",
      fontWeight: isActive ? 700 : 600,
      display: "block",
    };
  }

  function collapsibleButtonStyle(borderLeftColor: string) {
    return {
      width: "100%",
      textAlign: "left" as const,
      background: "#FFFDFB",
      color: "#2D2A3E",
      border: "1px solid #F0E3D8",
      borderLeft: `4px solid ${borderLeftColor}`,
      padding: "12px 14px",
      borderRadius: "14px",
      fontSize: "14px",
      fontWeight: 700,
      cursor: "pointer",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "10px",
    };
  }

  const visibleQuickActionsNav = isTeacher
    ? filteredTeacherQuickActionsNav
    : filteredQuickActionsNav;

  const visibleSchoolNav = isTeacher
    ? filteredTeacherSchoolManagementNav
    : filteredSchoolManagementNav;

  function itemsNamed(...labels: string[]) {
    const itemsByLabel = new Map(visibleSchoolNav.map((item) => [item.label, item]));
    return labels.flatMap((label) => {
      const item = itemsByLabel.get(label);
      return item ? [item] : [];
    });
  }

  const messagesNavItem: NavItem = {
    label: "Messages",
    href: "/messages",
    match: ["/messages"],
  };

  const workflowGroups: WorkflowGroup[] = isTeacher
    ? [
        {
          key: "daily-classroom",
          label: "Daily Classroom",
          color: "#22C55E",
          items: itemsNamed(
            "Attendance",
            "Classroom Activities",
            "Grade R Learning Hub",
            "Daily Summaries",
            "Events"
          ),
        },
        {
          key: "learner-development",
          label: "Learner Development",
          color: "#7C3AED",
          items: itemsNamed(
            "Progress Review",
            "Progress Reports",
            "Incident Reports",
            "Achievement Awards"
          ),
        },
        {
          key: "learners-parents",
          label: "Learners & Parents",
          color: "#60A5FA",
          items: itemsNamed("Learners"),
        },
        {
          key: "parent-communication",
          label: "Parent Communication",
          color: "#EC4899",
            items: [
              ...(canViewMessages ? [messagesNavItem] : []),
              { label: "Class Broadcasts", href: "/broadcasts", match: ["/broadcasts"] },
              ...itemsNamed("Communication Centre"),
          ],
        },
      ]
    : [
        {
          key: "daily-classroom",
          label: "Daily Classroom",
          color: "#22C55E",
          items: itemsNamed(
            "Learner Attendance",
            "Classroom Activities",
            "Grade R Learning Hub",
            "Summaries",
            "Events",
            "Practitioner Attendance"
          ),
        },
        {
          key: "learner-development",
          label: "Learner Development",
          color: "#7C3AED",
          items: itemsNamed(
            "Progress Review",
            "Progress Reports",
            "Incident Reports",
            "Achievement Awards"
          ),
        },
        {
          key: "learners-parents",
          label: "Admissions",
          color: "#60A5FA",
          items: itemsNamed(
            "Enrolments",
            "Awaiting Classroom Allocation",
            "Re-enrolments",
            "Parent Consent"
          ),
        },
        {
          key: "parent-communication",
          label: "Parent Communication",
          color: "#EC4899",
          items: [
            ...(canViewMessages ? [messagesNavItem] : []),
             ...itemsNamed("Broadcasts", "Communication Centre"),
          ],
        },
        {
          key: "fees-payments",
          label: "Fees & Payments",
          color: "#EAB308",
          items: itemsNamed("Payments", "Billing Overview"),
        },
        {
          key: "school-administration",
          label: "School Administration",
          color: "#F59E0B",
          items: [
            ...itemsNamed("School Setup", "Classrooms", "Learners"),
            ...(canViewTeachers
              ? [{ label: "Practitioners", href: "/teachers", match: ["/teachers"] }]
              : []),
            ...itemsNamed(
              "Learner Requirements Tracking",
              "School Printable Documents",
              "Meetings, Minutes & Surveys",
              "Data Migration",
              "Trust & Security"
            ),
            ...(canViewDbe ? dbeNav : []),
          ],
        },
        {
          key: "reports-insights",
          label: "Reports & Insights",
          color: "#38BDF8",
          items: itemsNamed("Reports", "School Analytics"),
        },
        {
          key: "staff-management",
          label: "Staff Management",
          color: "#7C3AED",
          items: [
            ...(canManagePreschoolAdmins
              ? [{ label: "Admin", href: "/staff-access", match: ["/staff-access"] }]
              : []),
          ],
          externalItems: showWageFlowStaffManagement
            ? [
                {
                  label: "WageFlow Staff Management",
                  href: "https://wageflow.lesedismartsolutions.co.za/login",
                },
              ]
            : [],
        },
      ];

  const visibleWorkflowGroups = workflowGroups.filter(
    (group) => group.items.length > 0 || Boolean(group.externalItems?.length)
  );

  const masterAdminNav = [
    { label: "Master Admin Home", href: "/master-admin", match: ["/master-admin"] },
    ...(profile?.permissions?.includes(PERMISSIONS.MESSAGE_VIEW) &&
    profile?.permissions?.includes(PERMISSIONS.MESSAGE_SEND)
      ? [{ label: "DailyBloom Support", href: "/messages", match: ["/messages"] }]
      : []),
    ...(profile?.permissions?.includes(PERMISSIONS.PLATFORM_DASHBOARD_VIEW)
      ? [{ label: "Master Dashboard", href: "/master?view=dashboard", match: ["/master"] }]
      : []),
    ...(profile?.permissions?.includes("platform.schools.onboard")
      ? [{ label: "Onboarding Pipeline", href: "/onboarding", match: ["/onboarding"] }]
      : []),
    ...(profile?.permissions?.includes("platform.principals.manage")
      ? [{ label: "Principal Management", href: "/principals", match: ["/principals"] }]
      : []),
    ...(profile?.permissions?.includes("platform.schools.status") &&
    !profile?.permissions?.includes("platform.principals.manage")
      ? [{ label: "School Status", href: "/principals", match: ["/principals"] }]
      : []),
    ...(profile?.permissions?.includes("billing.manage")
      ? [
          { label: "Billing Overview", href: "/billing", match: [] },
        ]
      : []),
    ...(profile?.permissions?.includes(PERMISSIONS.PLATFORM_ADMIN_MANAGE)
      ? [{ label: "Master Admin Access", href: "/platform-access", match: ["/platform-access"] }]
      : []),
    ...(profile?.permissions?.includes(PERMISSIONS.PLATFORM_REPORTS_VIEW)
      ? [
          { label: "Platform Reports", href: "/master/reports", match: ["/master/reports"] },
          {
            label: "Trust & Security",
            href: "/master/trust-security",
            match: ["/master/trust-security"],
          },
        ]
      : []),
    ...(profile?.permissions?.includes(PERMISSIONS.PLATFORM_ANALYTICS_VIEW)
      ? [{ label: "Platform Analytics", href: "/master/analytics", match: ["/master/analytics"] }]
      : []),
    ...(profile?.permissions?.includes(PERMISSIONS.PLATFORM_IMPACT_VIEW)
      ? [{ label: "Impact & Sponsorship", href: "/master/impact", match: ["/master/impact"] }]
      : []),
  ];

  return (
    <aside className="db-sidebar-shell">
      <div className="db-sidebar-mobile-bar">
        <div>
          <p className="db-sidebar-brand-mini">DAILYBLOOM</p>
          <p className="db-sidebar-role-mini">
            {profile?.role ? `Role: ${displayRole(profile.role)}` : "Menu"}
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
              Role: {displayRole(profile.role)}
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
                    width: "64px",
                    height: "64px",
                    objectFit: "contain",
                    borderRadius: "14px",
                    border: "1px solid #F0E3D8",
                    background: "#FFFFFF",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "14px",
                    border: "1px solid #F0E3D8",
                    background: "#F8E8F0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#2D2A3E",
                    fontWeight: 700,
                    fontSize: "24px",
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
                    fontSize: "11px",
                    color: "#8A84A3",
                    fontWeight: 700,
                  }}
                >
                  Current School
                </p>

                <p
                  style={{
                    margin: "3px 0 0 0",
                    fontSize: "14px",
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
                    fontSize: "11px",
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
            <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
              <Link
                href={`/dashboard?school=${school.id}`}
                style={{
                  display: "inline-block",
                  textDecoration: "none",
                  background: "#7CCCF3",
                  color: "#2D2A3E",
                  padding: "10px 14px",
                  borderRadius: "12px",
                  fontWeight: 600,
                  fontSize: "13px",
                  border: "1px solid #CBEAF7",
                  textAlign: "center",
                }}
              >
                Open School Dashboard
              </Link>

              <Link
                href="/master?view=manage-schools"
                style={{
                  display: "inline-block",
                  textDecoration: "none",
                  background: "#FFFDFB",
                  color: "#2D2A3E",
                  padding: "10px 14px",
                  borderRadius: "12px",
                  fontWeight: 600,
                  fontSize: "13px",
                  border: "1px solid #F0E3D8",
                  textAlign: "center",
                }}
              >
                Change School
              </Link>
            </div>
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

        {isMasterAdmin ? (
          <NavSection
            title="Assigned Platform Tools"
            items={masterAdminNav}
            pathname={pathname}
            currentView={searchParams.get("view")}
          />
        ) : null}

        {showSchoolActions ? (
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #F0E3D8",
              borderRadius: "22px",
              padding: "14px",
            }}
          >
            <div style={{ display: "grid", gap: "8px" }}>
              <Link
                href={dashboardHref}
                style={navStyle({
                  label: "Dashboard",
                  href: dashboardHref,
                  match: dashboardMatch,
                })}
              >
                Dashboard
              </Link>

              <button
                type="button"
                onClick={() => setQuickActionsOpen((prev) => !prev)}
                style={collapsibleButtonStyle("#22C55E")}
              >
                <span>Quick Actions</span>
                <span>{quickActionsOpen ? "⌄" : "›"}</span>
              </button>

              {quickActionsOpen &&
                visibleQuickActionsNav.map((item) => (
                  <Link
                    key={item.label}
                    href={withSchoolContext(item.href)}
                    target={item.newTab ? "_blank" : undefined}
                    rel={item.newTab ? "noopener noreferrer" : undefined}
                    style={navStyle(item)}
                  >
                    {item.label}
                  </Link>
                ))}

              {visibleWorkflowGroups.map((group) => {
                const groupIsActive = group.items.some((item) => isActiveNav(item));
                const groupOverride = openWorkflowGroups[group.key];
                const groupIsOpen =
                  groupOverride?.pathname === pathname ? groupOverride.open : groupIsActive;

                return (
                  <div key={group.key} style={{ display: "grid", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenWorkflowGroups((current) => ({
                          ...current,
                          [group.key]: { pathname, open: !groupIsOpen },
                        }))
                      }
                      style={collapsibleButtonStyle(group.color)}
                      aria-expanded={groupIsOpen}
                    >
                      <span>{group.label}</span>
                      <span>{groupIsOpen ? "⌄" : "›"}</span>
                    </button>

                    {groupIsOpen
                      ? group.items.map((item) => (
                          <Link
                            key={`${group.key}-${item.label}`}
                            href={withSchoolContext(item.href)}
                            style={navStyle(item)}
                          >
                            {item.href === "/messages" ? (
                              <span style={messageNavInner}>
                                <span>{item.label}</span>
                                {unreadMessageCount > 0 ? (
                                  <span style={messageBadge}>{unreadMessageCount}</span>
                                ) : null}
                              </span>
                            ) : (
                              item.label
                            )}
                          </Link>
                        ))
                      : null}

                    {groupIsOpen
                      ? group.externalItems?.map((item) => (
                          <a
                            key={`${group.key}-${item.label}`}
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={navStyle({ label: item.label, href: item.href })}
                          >
                            {item.label}
                          </a>
                        ))
                      : null}
                  </div>
                );
              })}
            </div>
          </div>
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
            Manage learners, events, attendance, summaries, classrooms, practitioners,
            reports, and school activity without losing school context.
          </p>
        </div>
      </div>
    </aside>
  );
}

const messageNavInner = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
} as const;

const messageBadge = {
  minWidth: "24px",
  height: "24px",
  borderRadius: "999px",
  background: "#E53935",
  color: "#FFFFFF",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 7px",
  fontSize: "12px",
  fontWeight: 800,
  lineHeight: 1,
} as const;

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
