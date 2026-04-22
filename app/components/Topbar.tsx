"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getCurrentProfile } from "../lib/auth";
import { supabase } from "../lib/supabase";

type Profile = {
  id?: string;
  full_name?: string | null;
  role?: string | null;
  school_id?: number | null;
};

export default function Topbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    loadTopbarContext();
  }, [pathname, searchParams]);

  async function loadTopbarContext() {
    const { profile: currentProfile } = await getCurrentProfile();
    setProfile(currentProfile || null);
  }

  async function handleLogout() {
    setLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message);
      setLoggingOut(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="db-topbar">
      <div className="db-topbar-brand-wrap">
        <p className="db-topbar-brand">DailyBloom</p>
      </div>

      <div className="db-topbar-actions">
        <Link href="/" className="db-topbar-link db-topbar-link-home">
          Homepage
        </Link>

        {profile?.role === "master" ? (
          <Link
            href="/master?view=manage-schools"
            className="db-topbar-link db-topbar-link-master"
          >
            Master Dashboard
          </Link>
        ) : null}

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="db-topbar-link db-topbar-link-logout"
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  );
}