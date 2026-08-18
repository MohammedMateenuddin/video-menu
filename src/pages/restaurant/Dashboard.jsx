import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  UtensilsCrossed,
  FolderOpen,
  Video,
  CheckCircle2,
  Star,
  QrCode,
  ExternalLink,
  Plus,
  RefreshCw,
  ArrowRight,
  Eye,
} from "lucide-react";

import { supabase } from "../../lib/supabase";
import { getCurrentRestaurant } from "../../services/restaurantService";

function Dashboard() {
  const [restaurant, setRestaurant] = useState(null);

  const [stats, setStats] = useState({
    menuItems: 0,
    categories: 0,
    availableItems: 0,
    videos: 0,
    bestsellers: 0,
  });

  const [recentItems, setRecentItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  // =========================================
  // LOAD DASHBOARD
  // =========================================

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const restaurantData = await getCurrentRestaurant();

      const currentRestaurant = restaurantData?.restaurants;

      if (!currentRestaurant?.id) {
        throw new Error("Unable to determine your restaurant.");
      }

      const restaurantId = currentRestaurant.id;

      setRestaurant(currentRestaurant);

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      
      const startOfWeekDate = new Date(now);
      startOfWeekDate.setDate(now.getDate() - now.getDay());
      startOfWeekDate.setHours(0,0,0,0);
      const startOfWeek = startOfWeekDate.toISOString();
      
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [
        menuResult, 
        categoriesResult,
        dailyViews,
        weeklyViews,
        monthlyViews
      ] = await Promise.all([
        supabase
          .from("menu_items")
          .select(
            `
              id,
              name,
              description,
              price,
              image_url,
              video_url,
              is_bestseller,
              is_available,
              category_id,
              created_at,
              display_order
            `,
          )
          .eq("restaurant_id", restaurantId)
          .order("created_at", { ascending: false }),

        supabase
          .from("categories")
          .select("id, name")
          .eq("restaurant_id", restaurantId)
          .order("display_order", { ascending: true }),
          
        supabase
          .from("menu_views")
          .select("*", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId)
          .gte("created_at", startOfDay),
          
        supabase
          .from("menu_views")
          .select("*", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId)
          .gte("created_at", startOfWeek),
          
        supabase
          .from("menu_views")
          .select("*", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId)
          .gte("created_at", startOfMonth),
      ]);

      if (menuResult.error) throw menuResult.error;
      if (categoriesResult.error) throw categoriesResult.error;

      const items = menuResult.data || [];
      const categories = categoriesResult.data || [];

      setStats({
        menuItems: items.length,
        categories: categories.length,
        availableItems: items.filter((item) => item.is_available).length,
        videos: items.filter((item) => Boolean(item.video_url)).length,
        bestsellers: items.filter((item) => item.is_bestseller).length,
        views: {
          daily: dailyViews.count || 0,
          weekly: weeklyViews.count || 0,
          monthly: monthlyViews.count || 0,
          allTime: currentRestaurant.view_count || 0
        }
      });

      setRecentItems(items.slice(0, 5));
    } catch (error) {
      console.error("Dashboard error:", error);

      setError(error?.message || "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  // =========================================
  // CATEGORY LOOKUP
  // =========================================

  const categoryMap = useMemo(() => {
    const map = {};

    // Categories aren't currently stored
    // in recentItems, so this map can be
    // populated later if needed.
    return map;
  }, []);

  // =========================================
  // MENU URL
  // =========================================

  const menuUrl = restaurant?.slug
    ? `${
        import.meta.env.VITE_PUBLIC_URL || window.location.origin
      }/r/${restaurant.slug}`
    : null;

  // =========================================
  // LOADING
  // =========================================

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-9 bg-gray-200 rounded-lg w-72" />

          <div className="h-4 bg-gray-200 rounded w-80 mt-3" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-32 bg-white border rounded-2xl animate-pulse"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-white border rounded-2xl animate-pulse" />

          <div className="h-80 bg-white border rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* =========================================
          HEADER
      ========================================== */}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">
            Restaurant Dashboard
          </p>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-1">
            Good morning 👋
          </h1>

          <p className="text-gray-500 mt-2">
            Here's what's happening with{" "}
            <span className="font-medium text-gray-700">
              {restaurant?.name || "your VideoMenu"}
            </span>
            .
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/dashboard/menu"
            className="inline-flex items-center gap-2 bg-black text-white px-4 py-3 rounded-xl font-medium hover:bg-gray-800 transition"
          >
            <Plus size={17} />
            Add Dish
          </Link>

          {menuUrl && (
            <a
              href={menuUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 border bg-white px-4 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
            >
              <ExternalLink size={17} />
              View Menu
            </a>
          )}
        </div>
      </div>

      {/* =========================================
          ERROR
      ========================================== */}

      {error && (
        <div className="flex items-start justify-between gap-4 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="text-sm text-red-700">
            <p className="font-medium">Unable to load dashboard</p>

            <p className="mt-1">{error}</p>
          </div>

          <button
            type="button"
            onClick={loadDashboard}
            className="inline-flex items-center gap-2 text-sm font-medium text-red-700 hover:underline"
          >
            <RefreshCw size={15} />
            Retry
          </button>
        </div>
      )}

      {/* =========================================
          STATS
      ========================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {/* Menu Items */}

        <div className="bg-white border rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <UtensilsCrossed size={19} />
            </div>

            <span className="text-xs font-medium text-gray-400">TOTAL</span>
          </div>

          <p className="text-sm text-gray-500 mt-5">Menu Items</p>

          <p className="text-3xl font-bold mt-1">{stats.menuItems}</p>
        </div>

        {/* Categories */}

        <div className="bg-white border rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <FolderOpen size={19} />
            </div>

            <span className="text-xs font-medium text-gray-400">ORGANIZED</span>
          </div>

          <p className="text-sm text-gray-500 mt-5">Categories</p>

          <p className="text-3xl font-bold mt-1">{stats.categories}</p>
        </div>

        {/* Menu Views */}

        <div className="bg-white border rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Eye size={19} className="text-blue-600" />
            </div>

            <span className="text-xs font-medium text-blue-600">ANALYTICS</span>
          </div>

          <p className="text-sm text-gray-500 mt-5">All-time Views</p>

          <p className="text-3xl font-bold mt-1">{stats.views?.allTime || 0}</p>
          
          <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-2 text-center divide-x">
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Today</p>
              <p className="font-semibold text-sm">{stats.views?.daily || 0}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Week</p>
              <p className="font-semibold text-sm">{stats.views?.weekly || 0}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Month</p>
              <p className="font-semibold text-sm">{stats.views?.monthly || 0}</p>
            </div>
          </div>
        </div>

        {/* Available */}

        <div className="bg-white border rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle2 size={19} className="text-green-600" />
            </div>

            <span className="text-xs font-medium text-green-600">LIVE</span>
          </div>

          <p className="text-sm text-gray-500 mt-5">Available Dishes</p>

          <p className="text-3xl font-bold mt-1">{stats.availableItems}</p>
        </div>

        {/* Videos */}

        <div className="bg-white border rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <VideoIcon />
            </div>

            <span className="text-xs font-medium text-gray-400">MEDIA</span>
          </div>

          <p className="text-sm text-gray-500 mt-5">Food Videos</p>

          <p className="text-3xl font-bold mt-1">{stats.videos}</p>
        </div>
      </div>

      {/* =========================================
          SECONDARY STATS
      ========================================== */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bestseller */}

        <div className="bg-white border rounded-2xl p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-yellow-50 flex items-center justify-center">
              <Star size={20} className="text-yellow-600" fill="currentColor" />
            </div>

            <div>
              <p className="font-semibold">Bestseller Dishes</p>

              <p className="text-sm text-gray-500 mt-1">
                Dishes highlighted as customer favorites.
              </p>
            </div>
          </div>

          <p className="text-3xl font-bold">{stats.bestsellers}</p>
        </div>

        {/* Menu status */}

        <div className="bg-white border rounded-2xl p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white"
              style={{
                backgroundColor: restaurant?.primary_color || "#000000",
              }}
            >
              <Eye size={20} />
            </div>

            <div>
              <p className="font-semibold">Customer Menu</p>

              <p className="text-sm text-gray-500 mt-1">
                {restaurant?.is_active
                  ? "Your menu is currently active."
                  : "Your menu is currently inactive."}
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
              restaurant?.is_active
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {restaurant?.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {/* =========================================
          CONTENT GRID
      ========================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* =========================================
            RECENT MENU
        ========================================== */}

        <div className="lg:col-span-2 bg-white border rounded-2xl overflow-hidden">
          <div className="px-5 sm:px-6 py-5 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg">Recent Menu Items</h2>

              <p className="text-sm text-gray-500 mt-1">Your latest dishes.</p>
            </div>

            <Link
              to="/dashboard/menu"
              className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
            >
              View all
              <ArrowRight size={15} />
            </Link>
          </div>

          {recentItems.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center">
                <UtensilsCrossed size={23} className="text-gray-400" />
              </div>

              <h3 className="font-semibold mt-4">No dishes yet</h3>

              <p className="text-sm text-gray-500 mt-2">
                Add your first dish to start building your menu.
              </p>

              <Link
                to="/dashboard/menu"
                className="inline-flex items-center gap-2 bg-black text-white px-5 py-3 rounded-xl font-medium mt-5 hover:bg-gray-800 transition"
              >
                <Plus size={17} />
                Add Dish
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {recentItems.map((item) => (
                <div
                  key={item.id}
                  className="p-5 sm:px-6 flex items-center gap-4 hover:bg-gray-50 transition"
                >
                  {/* Image */}

                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UtensilsCrossed size={19} className="text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Details */}

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium truncate">{item.name}</p>

                      {item.is_bestseller && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">
                          <Star size={10} fill="currentColor" />
                          Bestseller
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-500 mt-1">
                      ₹{Number(item.price || 0).toFixed(0)}
                    </p>
                  </div>

                  {/* Status */}

                  <div className="hidden sm:flex items-center gap-3">
                    {item.video_url && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                        <VideoIcon />
                        Video
                      </span>
                    )}

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        item.is_available
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {item.is_available ? "Available" : "Unavailable"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* =========================================
            QUICK ACTIONS
        ========================================== */}

        <div className="bg-white border rounded-2xl overflow-hidden">
          <div className="px-5 sm:px-6 py-5 border-b">
            <h2 className="font-semibold text-lg">Quick Actions</h2>

            <p className="text-sm text-gray-500 mt-1">
              Manage your VideoMenu faster.
            </p>
          </div>

          <div className="p-5 sm:p-6 space-y-3">
            <Link
              to="/dashboard/menu"
              className="flex items-center gap-3 border rounded-xl p-4 hover:bg-gray-50 transition"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Plus size={18} />
              </div>

              <div className="flex-1">
                <p className="text-sm font-semibold">Add Dish</p>

                <p className="text-xs text-gray-500 mt-1">
                  Add food to your menu.
                </p>
              </div>

              <ArrowRight size={16} className="text-gray-400" />
            </Link>

            <Link
              to="/dashboard/categories"
              className="flex items-center gap-3 border rounded-xl p-4 hover:bg-gray-50 transition"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <FolderOpen size={18} />
              </div>

              <div className="flex-1">
                <p className="text-sm font-semibold">Categories</p>

                <p className="text-xs text-gray-500 mt-1">
                  Organize your dishes.
                </p>
              </div>

              <ArrowRight size={16} className="text-gray-400" />
            </Link>

            <Link
              to="/dashboard/qr"
              className="flex items-center gap-3 border rounded-xl p-4 hover:bg-gray-50 transition"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <QrCode size={18} />
              </div>

              <div className="flex-1">
                <p className="text-sm font-semibold">QR Code</p>

                <p className="text-xs text-gray-500 mt-1">
                  Download your restaurant QR.
                </p>
              </div>

              <ArrowRight size={16} className="text-gray-400" />
            </Link>

            {menuUrl && (
              <a
                href={menuUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 border rounded-xl p-4 hover:bg-gray-50 transition"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                  style={{
                    backgroundColor: restaurant?.primary_color || "#000000",
                  }}
                >
                  <ExternalLink size={18} />
                </div>

                <div className="flex-1">
                  <p className="text-sm font-semibold">Preview Menu</p>

                  <p className="text-xs text-gray-500 mt-1">
                    See what customers see.
                  </p>
                </div>

                <ArrowRight size={16} className="text-gray-400" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* =========================================
          REFRESH
      ========================================== */}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={loadDashboard}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black transition"
        >
          <RefreshCw size={15} />
          Refresh dashboard
        </button>
      </div>
    </div>
  );
}

// =========================================
// SMALL VIDEO ICON
// =========================================

function VideoIcon() {
  return <Video size={15} className="text-gray-500" />;
}

export default Dashboard;
