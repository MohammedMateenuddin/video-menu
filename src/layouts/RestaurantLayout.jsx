import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Tags,
  QrCode,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Store,
} from "lucide-react";
import { useEffect, useState } from "react";

import { logout } from "../lib/auth";
import { getCurrentRestaurant } from "../services/restaurantService";

function RestaurantLayout() {
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);

  const [restaurant, setRestaurant] = useState(null);

  const [loggingOut, setLoggingOut] = useState(false);

  const navItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Menu",
      path: "/dashboard/menu",
      icon: UtensilsCrossed,
    },
    {
      name: "Categories",
      path: "/dashboard/categories",
      icon: Tags,
    },
    {
      name: "QR Code",
      path: "/dashboard/qr",
      icon: QrCode,
    },
    {
      name: "Settings",
      path: "/dashboard/settings",
      icon: Settings,
    },
  ];

  // =========================================
  // LOAD RESTAURANT
  // =========================================

  useEffect(() => {
    loadRestaurant();
  }, []);

  async function loadRestaurant() {
    try {
      const data = await getCurrentRestaurant();

      setRestaurant(data?.restaurants || null);
    } catch (error) {
      console.error("Restaurant layout error:", error);
    }
  }

  // =========================================
  // LOGOUT
  // =========================================

  async function handleLogout() {
    try {
      setLoggingOut(true);

      await logout();

      navigate("/login", {
        replace: true,
      });
    } catch (error) {
      console.error("Logout error:", error);

      setLoggingOut(false);
    }
  }

  // =========================================
  // MENU URL
  // =========================================

  const menuUrl = restaurant?.slug
    ? `${
        import.meta.env.VITE_PUBLIC_URL || window.location.origin
      }/r/${restaurant.slug}`
    : null;

  // =========================================
  // SIDEBAR
  // =========================================

  function Sidebar({ mobile = false }) {
    return (
      <aside
        className={
          mobile
            ? "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r flex flex-col shadow-xl"
            : "hidden lg:flex lg:w-64 xl:w-72 bg-white border-r min-h-screen flex-col shrink-0"
        }
      >
        {/* =========================================
            BRAND
        ========================================== */}

        <div className="px-5 py-5 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center font-bold shrink-0">
                V
              </div>

              <div className="min-w-0">
                <h1 className="font-bold text-lg tracking-tight">VideoMenu</h1>

                <p className="text-xs text-gray-500 mt-0.5">
                  Restaurant Dashboard
                </p>
              </div>
            </div>

            {mobile && (
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"
              >
                <X size={19} />
              </button>
            )}
          </div>
        </div>

        {/* =========================================
            RESTAURANT
        ========================================== */}

        <div className="px-4 pt-4">
          <div className="rounded-xl bg-gray-50 border p-3">
            <div className="flex items-center gap-3">
              {restaurant?.logo_url ? (
                <img
                  src={restaurant.logo_url}
                  alt={restaurant.name}
                  className="w-10 h-10 rounded-lg object-cover border"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-white border flex items-center justify-center">
                  <Store size={18} className="text-gray-500" />
                </div>
              )}

              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  {restaurant?.name || "Your Restaurant"}
                </p>

                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      restaurant?.is_active === false
                        ? "bg-gray-400"
                        : "bg-green-500"
                    }`}
                  />

                  <p className="text-xs text-gray-500">
                    {restaurant?.is_active === false ? "Inactive" : "Active"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================
            NAVIGATION
        ========================================== */}

        <nav className="p-4 space-y-1 flex-1">
          <p className="px-3 pb-2 text-[10px] uppercase tracking-wider font-semibold text-gray-400">
            Manage
          </p>

          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/dashboard"}
                onClick={() => {
                  if (mobile) {
                    setMobileOpen(false);
                  }
                }}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? "bg-black text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100 hover:text-black"
                  }`
                }
              >
                <Icon size={18} strokeWidth={2} />

                <span className="flex-1">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* =========================================
            CUSTOMER MENU
        ========================================== */}

        {menuUrl && (
          <div className="px-4 pb-4">
            <a
              href={menuUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                if (mobile) {
                  setMobileOpen(false);
                }
              }}
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl border bg-gray-50 hover:bg-gray-100 transition"
            >
              <div className="w-9 h-9 rounded-lg bg-white border flex items-center justify-center">
                <ExternalLink size={17} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Customer Menu</p>

                <p className="text-xs text-gray-500 mt-0.5">
                  Preview your menu
                </p>
              </div>

              <ExternalLink size={14} className="text-gray-400" />
            </a>
          </div>
        )}

        {/* =========================================
            LOGOUT
        ========================================== */}

        <div className="p-4 border-t">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition"
          >
            <LogOut size={18} />

            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* =========================================
          DESKTOP SIDEBAR
      ========================================== */}

      <Sidebar />

      {/* =========================================
          MOBILE SIDEBAR
      ========================================== */}

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />

          <Sidebar mobile />
        </>
      )}

      {/* =========================================
          MAIN
      ========================================== */}

      <main className="flex-1 min-w-0">
        {/* =========================================
            HEADER
        ========================================== */}

        <header className="h-16 sm:h-[68px] bg-white border-b flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-30">
          {/* Mobile menu */}

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden w-10 h-10 rounded-xl border bg-white flex items-center justify-center hover:bg-gray-50 transition"
          >
            <Menu size={20} />
          </button>

          {/* Desktop title */}

          <div className="hidden lg:block">
            <p className="text-sm font-semibold">
              {restaurant?.name || "Restaurant Dashboard"}
            </p>

            <p className="text-xs text-gray-400 mt-0.5">
              Manage your VideoMenu
            </p>
          </div>

          {/* Mobile brand */}

          <div className="lg:hidden flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-bold text-sm">
              V
            </div>

            <span className="font-bold">VideoMenu</span>
          </div>

          {/* Right side */}

          <div className="flex items-center gap-3">
            {menuUrl && (
              <a
                href={menuUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
              >
                <ExternalLink size={16} />
                View Menu
              </a>
            )}

            {/* Restaurant avatar */}

            {restaurant?.logo_url ? (
              <img
                src={restaurant.logo_url}
                alt={restaurant.name || "Restaurant"}
                className="w-9 h-9 rounded-full object-cover border"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center text-sm font-semibold"
                title={restaurant?.name || "Restaurant"}
              >
                {restaurant?.name?.charAt(0)?.toUpperCase() || "R"}
              </div>
            )}
          </div>
        </header>

        {/* =========================================
            PAGE CONTENT
        ========================================== */}

        <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default RestaurantLayout;
