"use client";

import type { OrgMembership } from "@/lib/events";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  IconChevronDown,
  IconHome,
  IconLogo,
  IconLogout,
  IconMembers,
} from "./AdminNavIcons";
import { OrganizationSwitcher } from "./OrganizationSwitcher";

const NAV_ITEMS = [
  { href: "/dashboard", label: "イベント一覧", Icon: IconHome, match: "exact" as const },
  { href: "/dashboard/members", label: "参加者一覧", Icon: IconMembers, match: "prefix" as const },
] as const;

function DashboardNavLinks({ pathname }: { pathname: string }) {
  return (
    <div className="space-y-1.5">
      {NAV_ITEMS.map((item) => {
        const active =
          item.match === "exact"
            ? pathname === item.href || pathname === `${item.href}/`
            : pathname.startsWith(item.href);
        const Icon = item.Icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm font-semibold transition-colors ${
              active
                ? "border-transparent bg-indigo-100 text-indigo-600"
                : "border-transparent text-slate-900 hover:bg-indigo-100 hover:text-indigo-600 active:border-indigo-200"
            }`}
          >
            <Icon
              className={`size-5 flex-none ${
                active ? "text-indigo-500" : "text-slate-300 group-hover:text-indigo-500"
              }`}
            />
            <span className="grow">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

type Props = {
  children: ReactNode;
  organization?: OrgMembership;
};

export function DashboardShell({ children, organization }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [userLabel, setUserLabel] = useState("運営者");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email;
      if (email) setUserLabel(email.split("@")[0] ?? email);
    });
  }, [supabase]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen w-full min-w-[320px] flex-col bg-slate-100 text-slate-900">
      <header className="z-10 flex flex-none items-center bg-slate-100">
        <div className="container mx-auto px-4 lg:px-8 xl:max-w-7xl">
          <div className="flex justify-between border-b-2 border-slate-200/50 py-6">
            <div className="flex min-w-0 items-center gap-4">
              <Link
                href="/dashboard"
                className="group inline-flex shrink-0 items-center gap-2 text-sm font-bold tracking-wide text-slate-700 hover:text-indigo-600 sm:text-lg"
              >
                <IconLogo className="size-5 rotate-90 text-indigo-500" />
                <span>OpenMATSURI</span>
              </Link>
              {organization && (
                <>
                  <span className="hidden text-slate-300 sm:inline">/</span>
                  <div className="min-w-0 flex-1 sm:flex-none">
                    <OrganizationSwitcher organization={organization} />
                  </div>
                </>
              )}
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setUserDropdownOpen((open) => !open)}
                className="group flex items-center gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold text-slate-900 hover:bg-indigo-100 hover:text-indigo-600"
              >
                <span className="hidden sm:inline-block">{userLabel}</span>
                <IconChevronDown className="size-5 text-slate-400" />
              </button>
              {userDropdownOpen && (
                <div className="absolute end-0 z-20 mt-2 w-48 rounded-sm shadow-xl shadow-slate-200">
                  <div className="rounded-sm bg-white p-2 ring-1 ring-slate-900/5">
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      className="group flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
                    >
                      <IconLogout className="size-5 text-slate-300 group-hover:text-indigo-500" />
                      ログアウト
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex max-w-full flex-auto flex-col">
        <div className="container mx-auto p-4 lg:p-8 xl:max-w-7xl">
          <div className="grid grid-cols-1 md:gap-12 lg:grid-cols-12 lg:gap-8">
            <nav className="hidden lg:col-span-3 lg:block">
              <p className="mb-3 px-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                メニュー
              </p>
              <DashboardNavLinks pathname={pathname} />
            </nav>

            <div className="lg:col-span-9">{children}</div>
          </div>
        </div>
      </main>

      <footer className="flex grow-0 items-center">
        <div className="container mx-auto px-4 lg:px-8 xl:max-w-7xl">
          <div className="border-t-2 border-slate-200/50 py-6 text-sm font-medium text-slate-600">
            © <span className="font-semibold">OpenMATSURI</span> Admin
          </div>
        </div>
      </footer>
    </div>
  );
}
