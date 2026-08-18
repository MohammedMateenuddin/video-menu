import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    restaurants: 0,
    activeRestaurants: 0,
    menuItems: 0,
  });

  const [recentRestaurants, setRecentRestaurants] = useState([]);
  const [monthlySignups, setMonthlySignups] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setLoading(true);

      // Total restaurants
      const { count: restaurantCount, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*", { count: "exact", head: true });

      if (restaurantError) {
        console.error("Restaurant count error:", restaurantError);
      }

      // Active restaurants
      const { count: activeCount, error: activeError } = await supabase
        .from("restaurants")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      if (activeError) {
        console.error("Active restaurant count error:", activeError);
      }

      // Total menu items
      const { count: menuCount, error: menuError } = await supabase
        .from("menu_items")
        .select("*", { count: "exact", head: true });

      if (menuError) {
        console.error("Menu item count error:", menuError);
      }

      // Recent signups
      const { data: recent, error: recentError } = await supabase
        .from("restaurants")
        .select("id, name, slug, created_at, is_active")
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentError) {
        console.error("Recent restaurants error:", recentError);
      }

      // Monthly Signups (Last 6 Months)
      const { data: allRestaurants, error: allRestError } = await supabase
        .from("restaurants")
        .select("created_at");

      if (allRestError) {
        console.error("All restaurants error:", allRestError);
      } else if (allRestaurants) {
        const months = {};
        const now = new Date();
        
        // Initialize last 6 months
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthName = d.toLocaleString("default", { month: "short" });
          months[monthName] = 0;
        }

        allRestaurants.forEach((r) => {
          const date = new Date(r.created_at);
          // Only count if it's within the last 6 months
          if (date >= new Date(now.getFullYear(), now.getMonth() - 5, 1)) {
             const monthName = date.toLocaleString("default", { month: "short" });
             if (months[monthName] !== undefined) {
               months[monthName]++;
             }
          }
        });

        const signupsData = Object.entries(months).map(([month, count]) => ({
          month,
          count,
        }));
        
        setMonthlySignups(signupsData);
      }

      setStats({
        restaurants: restaurantCount || 0,
        activeRestaurants: activeCount || 0,
        menuItems: menuCount || 0,
      });

      setRecentRestaurants(recent || []);
    } catch (error) {
      console.error("Failed to load admin statistics:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">VideoMenu Admin</h1>

          <p className="text-gray-500 mt-2">
            Manage your restaurants and VideoMenus.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="bg-black text-white px-5 py-3 rounded-lg hover:bg-gray-800 transition"
        >
          Logout
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
        {/* Restaurants */}
        <Link
          to="/admin/restaurants"
          className="bg-white border rounded-2xl p-6 hover:bg-gray-50 hover:shadow-sm transition"
        >
          <p className="text-gray-500">Restaurants</p>

          <p className="text-4xl font-bold mt-2">
            {loading ? "..." : stats.restaurants}
          </p>

          <p className="text-sm text-gray-500 mt-3">Manage restaurants →</p>
        </Link>

        {/* Active Restaurants */}
        <Link
          to="/admin/restaurants"
          className="bg-white border rounded-2xl p-6 hover:bg-gray-50 hover:shadow-sm transition"
        >
          <p className="text-gray-500">Active Restaurants</p>

          <p className="text-4xl font-bold mt-2">
            {loading ? "..." : stats.activeRestaurants}
          </p>

          <p className="text-sm text-gray-500 mt-3">
            View active restaurants →
          </p>
        </Link>

        {/* Menu Items */}
        <div className="bg-white border rounded-2xl p-6">
          <p className="text-gray-500">Menu Items</p>

          <p className="text-4xl font-bold mt-2">
            {loading ? "..." : stats.menuItems}
          </p>

          <p className="text-sm text-gray-500 mt-3">Total menu items</p>
        </div>
      </div>

      {/* Analytics Chart */}
      <div className="mt-8 bg-white border rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-6">Signups (Last 6 Months)</h2>

        {loading ? (
          <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
        ) : monthlySignups.length > 0 ? (
          <div className="flex items-end gap-2 h-48 mt-4">
            {monthlySignups.map((item, index) => {
              const maxCount = Math.max(...monthlySignups.map((d) => d.count), 1);
              const height = `${(item.count / maxCount) * 100}%`;
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="w-full bg-gray-100 rounded-t-lg relative h-full flex items-end">
                    <div 
                      className="w-full bg-black rounded-t-lg transition-all duration-500 relative" 
                      style={{ height }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                        {item.count} Signups
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{item.month}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center border-2 border-dashed rounded-xl text-gray-400">
            No signup data available
          </div>
        )}
      </div>

      {/* Quick Actions & Recent Signups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2 bg-white border rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-5">Recent Signups</h2>

          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-16 bg-gray-100 rounded-xl" />
              <div className="h-16 bg-gray-100 rounded-xl" />
            </div>
          ) : recentRestaurants.length > 0 ? (
            <div className="divide-y">
              {recentRestaurants.map((restaurant) => (
                <div key={restaurant.id} className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{restaurant.name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(restaurant.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        restaurant.is_active
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {restaurant.is_active ? "Active" : "Inactive"}
                    </span>
                    
                    <Link
                      to={`/admin/restaurants/${restaurant.id}`}
                      className="text-sm text-gray-500 hover:text-black transition"
                    >
                      Manage →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No recent signups found.</p>
          )}
        </div>

        <div className="bg-white border rounded-2xl p-6 h-fit">
          <h2 className="text-xl font-semibold">Quick Actions</h2>

          <div className="flex flex-col gap-3 mt-5">
            <Link
              to="/admin/restaurants"
              className="bg-black text-white px-5 py-3 rounded-lg hover:bg-gray-800 transition text-center"
            >
              Manage Restaurants
            </Link>

            <Link
              to="/admin/restaurants"
              className="border px-5 py-3 rounded-lg hover:bg-gray-50 transition text-center"
            >
              View All Restaurants
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
