"use client";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  Clock3,
  History,
  ClipboardList,
  Users,
  BriefcaseBusiness,
  ShieldCheck,
  FolderKanban,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import AccountMenu from "@/components/app/AccountMenu";
import { canUseAttendance } from "@/lib/shared/attendance-access";
const groups = [
  { label: "Pribadi", items: [["/dashboard", "Dashboard Saya", Clock3]] },
  {
    label: "Ringkasan",
    items: [["/admin/dashboard", "Dashboard", LayoutDashboard]],
  },
  {
    label: "Akses Pengguna",
    items: [
      ["/users", "Manajemen User", Users],
      ["/roles", "Manajemen Role", ShieldCheck],
      ["/activity-logs", "Log Aktivitas", ClipboardList],
    ],
  },
  {
    label: "Operasional",
    items: [
      ["/history", "Riwayat Absensi", History],
      ["/schedules", "Jadwal Kerja", Clock3],
      ["/projects", "Manajemen Project", FolderKanban],
      ["/assignments", "Penempatan Tukang", BriefcaseBusiness],
    ],
  },
];
const items = groups.flatMap((group) => group.items);
const preferenceKey = "composite.sidebar.collapsed";
let memoryPreference = null;
function readPreference() {
  if (memoryPreference !== null) return memoryPreference;
  try {
    return window.localStorage.getItem(preferenceKey) === "true";
  } catch {
    return false;
  }
}
function subscribePreference(listener) {
  window.addEventListener("storage", listener);
  window.addEventListener("sidebar-preference", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("sidebar-preference", listener);
  };
}
function serverPreference() {
  return false;
}
export default function SidebarNav({ user, permissions, canReadActivityLog }) {
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        ([href]) =>
          href === "/admin/dashboard" ||
          (href === "/dashboard"
            ? user.role !== "admin" && canUseAttendance(user)
            : href === "/activity-logs"
              ? canReadActivityLog
              : permissions?.[href.slice(1)]?.read),
      ),
    }))
    .filter((group) => group.items.length > 0);
  const collapsed = useSyncExternalStore(
    subscribePreference,
    readPreference,
    serverPreference,
  );
  const [tooltip, setTooltip] = useState(null);
  function toggleSidebar() {
    const next = !collapsed;
    memoryPreference = next;
    try {
      window.localStorage.setItem(preferenceKey, String(next));
      memoryPreference = null;
    } catch {
      /* Persistence is optional when browser storage is unavailable. */
    }
    window.dispatchEvent(new Event("sidebar-preference"));
    setTooltip(null);
  }
  function showTooltip(event, label, desktop) {
    if (
      !desktop ||
      !collapsed ||
      !window.matchMedia("(min-width: 768px)").matches
    )
      return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      label,
      top: rect.top + rect.height / 2,
      left: rect.right + 12,
    });
  }
  const pathname = usePathname();
  const drawer = useRef(null);
  useEffect(() => {
    const dialog = drawer.current;
    const lock = () => {
      document.body.style.overflow = dialog.open ? "hidden" : "";
    };
    dialog.addEventListener("close", lock);
    return () => {
      dialog.removeEventListener("close", lock);
      document.body.style.overflow = "";
    };
  }, []);
  function navigation(desktop = false) {
    return (
      <>
        <Link
          href="/admin/dashboard"
          className="admin-brand"
          aria-label="Composite — Dashboard"
          onClick={() => drawer.current?.close()}
        >
          <Logo size={39} />
          <span className="sidebar-brand-text">
            COMPOSITE<small>PORTAL ABSENSI</small>
          </span>
        </Link>
        <nav
          aria-label="Navigasi admin"
          className="admin-nav-groups"
          onScroll={() => setTooltip(null)}
        >
          {visibleGroups.map((group) => (
            <div
              key={group.label}
              className="admin-nav-group"
              role="group"
              aria-label={group.label}
            >
              <p className="nav-caption">{group.label}</p>
              {group.items.map(([href, label, Icon]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => {
                    setTooltip(null);
                    drawer.current?.close();
                  }}
                  aria-current={
                    pathname === href || pathname.startsWith(href + "/")
                      ? "page"
                      : undefined
                  }
                  className="admin-nav-link"
                  aria-label={label}
                  onMouseEnter={(event) => showTooltip(event, label, desktop)}
                  onMouseLeave={() => setTooltip(null)}
                  onFocus={(event) => showTooltip(event, label, desktop)}
                  onBlur={() => setTooltip(null)}
                >
                  <Icon size={19} aria-hidden="true" />
                  <span className="sidebar-menu-label">{label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </>
    );
  }
  return (
    <>
      <aside
        id="desktop-sidebar"
        className="admin-sidebar"
        data-collapsed={collapsed}
      >
        {navigation(true)}
      </aside>
      {tooltip && (
        <span
          className="sidebar-tooltip"
          role="tooltip"
          style={{ top: tooltip.top, left: tooltip.left }}
        >
          {tooltip.label}
        </span>
      )}
      <header className="admin-topbar">
        <div className="topbar-left">
          <button
            className="icon-button desktop-sidebar-toggle"
            aria-label={collapsed ? "Perluas sidebar" : "Perkecil sidebar"}
            aria-expanded={!collapsed}
            aria-controls="desktop-sidebar"
            onClick={toggleSidebar}
          >
            {collapsed ? (
              <PanelLeftOpen size={21} />
            ) : (
              <PanelLeftClose size={21} />
            )}
          </button>
          <button
            className="icon-button mobile-menu"
            aria-label="Buka menu"
            onClick={() => {
              drawer.current.showModal();
              document.body.style.overflow = "hidden";
            }}
          >
            <Menu size={22} />
          </button>
          <span>
            Portal Absensi <span className="topbar-separator">/</span>{" "}
            <strong>
              {items.find(
                ([href]) =>
                  href === pathname || pathname.startsWith(href + "/"),
              )?.[1] || "Admin"}
            </strong>
          </span>
        </div>
        <AccountMenu user={user} />
      </header>
      <dialog
        ref={drawer}
        className="sidebar-drawer"
        onClick={(event) => {
          if (event.target === drawer.current) drawer.current.close();
        }}
      >
        <button
          className="icon-button drawer-close"
          aria-label="Tutup menu"
          onClick={() => drawer.current.close()}
        >
          <X />
        </button>
        {navigation()}
      </dialog>
    </>
  );
}
