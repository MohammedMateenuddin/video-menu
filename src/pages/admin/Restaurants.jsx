import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Pencil,
  ExternalLink,
  Search,
  Store,
  CheckCircle2,
  XCircle,
  RefreshCw,
  LogOut,
  LayoutDashboard
} from "lucide-react";

import { supabase } from "../../lib/supabase";

export default function Restaurants() {
  const navigate = useNavigate();

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    slug: "",
    logo_url: "",
    description: "",
    phone: "",
    address: "",
    primary_color: "#000000",
    secondary_color: "#ffffff",
    is_active: true,
  });

  useEffect(() => {
    loadRestaurants();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  }

  async function loadRestaurants() {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      setRestaurants(data || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load restaurants.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      name: "",
      slug: "",
      logo_url: "",
      description: "",
      phone: "",
      address: "",
      primary_color: "#000000",
      secondary_color: "#ffffff",
      is_active: true,
    });
  }

  function handleNameChange(value) {
    const slug = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    setForm((previous) => ({
      ...previous,
      name: value,
      slug,
    }));
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function openCreateForm() {
    resetForm();
    setError("");
    setSuccess("");
    setShowForm(true);

    setTimeout(() => {
      document.getElementById("restaurant-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function closeCreateForm() {
    setShowForm(false);
    setError("");
    resetForm();
  }

  async function createRestaurant(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const name = form.name.trim();
      const slug = form.slug.trim().toLowerCase();

      if (!name) {
        throw new Error("Restaurant name is required.");
      }

      if (!slug) {
        throw new Error("Restaurant slug is required.");
      }

      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new Error(
          "Slug can only contain lowercase letters, numbers, and hyphens.",
        );
      }

      const { error } = await supabase.from("restaurants").insert([
        {
          name,
          slug,
          logo_url: form.logo_url.trim() || null,
          description: form.description.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          primary_color: form.primary_color,
          secondary_color: form.secondary_color,
          is_active: form.is_active,
        },
      ]);

      if (error) {
        if (error.code === "23505") {
          throw new Error("A restaurant with this slug already exists.");
        }

        throw error;
      }

      await loadRestaurants();

      setSuccess(`${name} was created successfully.`);
      closeCreateForm();

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to create restaurant.");
    } finally {
      setSaving(false);
    }
  }

  const filteredRestaurants = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return restaurants;
    }

    return restaurants.filter((restaurant) => {
      return (
        restaurant.name?.toLowerCase().includes(query) ||
        restaurant.slug?.toLowerCase().includes(query) ||
        restaurant.phone?.toLowerCase().includes(query) ||
        restaurant.address?.toLowerCase().includes(query)
      );
    });
  }, [restaurants, search]);

  const activeCount = restaurants.filter(
    (restaurant) => restaurant.is_active,
  ).length;

  const inactiveCount = restaurants.length - activeCount;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-black text-white flex items-center justify-center">
                  <Store size={21} />
                </div>

                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Restaurants
                  </h1>

                  <p className="text-sm text-gray-500 mt-1">
                    Manage all restaurants on your VideoMenu platform.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/admin"
                className="inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-3 rounded-xl font-medium hover:bg-gray-200 transition"
              >
                <LayoutDashboard size={18} />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              
              <button
                onClick={openCreateForm}
                className="inline-flex items-center justify-center gap-2 bg-black text-white px-5 py-3 rounded-xl font-medium hover:bg-gray-800 transition"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Add Restaurant</span>
                <span className="sm:hidden">Add</span>
              </button>

              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 border bg-white text-gray-700 px-4 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <XCircle size={19} className="mt-0.5 shrink-0" />

            <div className="text-sm">
              <p className="font-medium">Something went wrong</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />

            <div className="text-sm">
              <p className="font-medium">Success</p>
              <p className="mt-1">{success}</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border rounded-2xl p-5">
            <p className="text-sm text-gray-500">Total Restaurants</p>

            <p className="text-3xl font-bold mt-2">{restaurants.length}</p>
          </div>

          <div className="bg-white border rounded-2xl p-5">
            <p className="text-sm text-gray-500">Active</p>

            <p className="text-3xl font-bold mt-2">{activeCount}</p>

            <p className="text-xs text-gray-500 mt-1">
              Currently visible to customers
            </p>
          </div>

          <div className="bg-white border rounded-2xl p-5">
            <p className="text-sm text-gray-500">Inactive</p>

            <p className="text-3xl font-bold mt-2">{inactiveCount}</p>
          </div>
        </div>

        {/* Create Restaurant */}
        {showForm && (
          <div
            id="restaurant-form"
            className="bg-white border rounded-2xl p-5 sm:p-7 mb-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Add Restaurant</h2>

                <p className="text-sm text-gray-500 mt-1">
                  Create a new restaurant and prepare its VideoMenu.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateForm}
                className="text-sm text-gray-500 hover:text-black"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={createRestaurant} className="mt-7 space-y-6">
              {/* Basic information */}
              <div>
                <h3 className="font-medium">Basic information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Restaurant Name *
                    </label>

                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Example: Spice Garden"
                      className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Menu URL Slug *
                    </label>

                    <input
                      type="text"
                      name="slug"
                      value={form.slug}
                      onChange={handleChange}
                      placeholder="spice-garden"
                      className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                      required
                    />

                    <p className="text-xs text-gray-500 mt-2">
                      Customer URL: /r/
                      {form.slug || "restaurant-name"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div>
                <h3 className="font-medium">Contact information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Phone
                    </label>

                    <input
                      type="text"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="+91 98765 43210"
                      className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Address
                    </label>

                    <input
                      type="text"
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      placeholder="Bangalore, Karnataka"
                      className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Description
                </label>

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Short description of the restaurant..."
                  rows={4}
                  className="w-full border rounded-xl px-4 py-3 outline-none resize-none focus:ring-2 focus:ring-black/10 focus:border-black"
                />
              </div>

              {/* Branding */}
              <div>
                <h3 className="font-medium">Branding</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Logo URL
                    </label>

                    <input
                      type="url"
                      name="logo_url"
                      value={form.logo_url}
                      onChange={handleChange}
                      placeholder="https://..."
                      className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Primary Color
                    </label>

                    <div className="flex gap-3">
                      <input
                        type="color"
                        name="primary_color"
                        value={form.primary_color}
                        onChange={handleChange}
                        className="w-14 h-12 border rounded-xl cursor-pointer"
                      />

                      <input
                        type="text"
                        value={form.primary_color}
                        onChange={(e) =>
                          setForm((previous) => ({
                            ...previous,
                            primary_color: e.target.value,
                          }))
                        }
                        className="flex-1 border rounded-xl px-4"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Secondary Color
                    </label>

                    <div className="flex gap-3">
                      <input
                        type="color"
                        name="secondary_color"
                        value={form.secondary_color}
                        onChange={handleChange}
                        className="w-14 h-12 border rounded-xl cursor-pointer"
                      />

                      <input
                        type="text"
                        value={form.secondary_color}
                        onChange={(e) =>
                          setForm((previous) => ({
                            ...previous,
                            secondary_color: e.target.value,
                          }))
                        }
                        className="flex-1 border rounded-xl px-4"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Active */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={handleChange}
                  className="w-4 h-4"
                />

                <div>
                  <p className="text-sm font-medium">Restaurant is active</p>

                  <p className="text-xs text-gray-500 mt-0.5">
                    Active restaurants can be accessed by customers.
                  </p>
                </div>
              </label>

              {/* Submit */}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeCreateForm}
                  className="px-5 py-3 rounded-xl border hover:bg-gray-50 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 transition"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={17} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={17} />
                      Create Restaurant
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Restaurant List */}
        <div className="bg-white border rounded-2xl overflow-hidden">
          <div className="px-5 sm:px-6 py-5 border-b">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold text-lg">All Restaurants</h2>

                <p className="text-sm text-gray-500 mt-1">
                  {filteredRestaurants.length} restaurant
                  {filteredRestaurants.length !== 1 ? "s" : ""}
                  {search ? " matching your search" : ""}
                </p>
              </div>

              <div className="relative w-full md:w-80">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search restaurants..."
                  className="w-full border rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="animate-pulse flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-100" />

                  <div className="flex-1">
                    <div className="h-4 bg-gray-100 rounded w-40" />
                    <div className="h-3 bg-gray-100 rounded w-28 mt-2" />
                  </div>

                  <div className="h-8 w-20 bg-gray-100 rounded-lg" />
                </div>
              ))}
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="p-10 sm:p-14 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center">
                <Store size={24} className="text-gray-500" />
              </div>

              <h3 className="font-semibold mt-5">
                {search ? "No restaurants found" : "No restaurants yet"}
              </h3>

              <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">
                {search
                  ? "Try searching with a different restaurant name or slug."
                  : "Create your first restaurant to start building VideoMenus."}
              </p>

              {!search && (
                <button
                  onClick={openCreateForm}
                  className="mt-5 inline-flex items-center gap-2 bg-black text-white px-5 py-3 rounded-xl font-medium hover:bg-gray-800 transition"
                >
                  <Plus size={17} />
                  Add Restaurant
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredRestaurants.map((restaurant) => (
                <RestaurantRow key={restaurant.id} restaurant={restaurant} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function RestaurantRow({ restaurant }) {
  return (
    <div className="px-5 sm:px-6 py-5 hover:bg-gray-50/70 transition">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Restaurant info */}
        <div className="flex items-start gap-4 min-w-0">
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={`${restaurant.name} logo`}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border shrink-0"
            />
          ) : (
            <div
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gray-100 flex items-center justify-center font-semibold text-lg shrink-0"
              style={{
                backgroundColor: restaurant.primary_color || "#f3f4f6",
              }}
            >
              <span
                style={{
                  color: restaurant.secondary_color || "#000000",
                }}
              >
                {restaurant.name?.charAt(0)?.toUpperCase() || "R"}
              </span>
            </div>
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-base truncate">
                {restaurant.name}
              </h3>

              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  restaurant.is_active
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {restaurant.is_active ? "Active" : "Inactive"}
              </span>
            </div>

            <p className="text-sm text-gray-500 mt-1 truncate">
              /r/{restaurant.slug}
            </p>

            {restaurant.address && (
              <p className="text-xs text-gray-400 mt-1 truncate">
                {restaurant.address}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 lg:shrink-0">
          <a
            href={`/r/${restaurant.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-white transition"
            title="Open VideoMenu"
          >
            <ExternalLink size={16} />
            <span className="hidden sm:inline">View Menu</span>
          </a>

          <Link
            to={`/admin/restaurants/${restaurant.id}`}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition"
            title="Manage restaurant"
          >
            <Pencil size={16} />
            Manage
          </Link>
        </div>
      </div>
    </div>
  );
}
