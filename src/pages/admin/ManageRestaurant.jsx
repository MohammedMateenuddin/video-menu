import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  Save,
  UserPlus,
  UserMinus,
  Store,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

export default function ManageRestaurant() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();

  const [ownerEmail, setOwnerEmail] = useState("");
  const [currentOwner, setCurrentOwner] = useState(null);
  const [loadingOwner, setLoadingOwner] = useState(true);
  const [assigningOwner, setAssigningOwner] = useState(false);
  const [ownerMessage, setOwnerMessage] = useState("");

  const [restaurant, setRestaurant] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingViews, setResettingViews] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadRestaurant();
  }, [restaurantId]);

  async function loadRestaurant() {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        setError("Restaurant not found.");
        return;
      }

      setRestaurant(data);

      // Load current owner after restaurant is loaded
      loadCurrentOwner();
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load restaurant.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCurrentOwner() {
    try {
      setLoadingOwner(true);

      const { data, error } = await supabase.functions.invoke(
        "assign-restaurant-owner",
        {
          body: {
            action: "get",
            restaurantId: restaurantId,
          },
        },
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setCurrentOwner(data?.owner || null);
    } catch (error) {
      console.error("Load owner error:", error);
      setCurrentOwner(null);
    } finally {
      setLoadingOwner(false);
    }
  }

  async function assignOwner() {
    if (!ownerEmail.trim()) {
      setOwnerMessage("Please enter the owner's email.");
      return;
    }

    try {
      setAssigningOwner(true);
      setOwnerMessage("");

      const { data, error } = await supabase.functions.invoke(
        "assign-restaurant-owner",
        {
          body: {
            restaurantId: restaurant.id,
            ownerEmail: ownerEmail.trim(),
          },
        },
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setOwnerMessage(
        data?.message || "Restaurant owner assigned successfully.",
      );

      // Immediately update the displayed owner
      setCurrentOwner(data?.owner || null);

      setOwnerEmail("");
    } catch (error) {
      console.error("Assign owner error:", error);

      setOwnerMessage(error.message || "Failed to assign restaurant owner.");
    } finally {
      setAssigningOwner(false);
    }
  }

  async function revokeOwner() {
    if (!currentOwner) return;
    if (!window.confirm("Are you sure you want to revoke this owner's access?")) return;

    try {
      setAssigningOwner(true);
      setOwnerMessage("");

      const { error } = await supabase
        .from("restaurant_users")
        .delete()
        .eq("restaurant_id", restaurantId)
        .eq("user_id", currentOwner.id);

      if (error) {
        throw error;
      }

      setOwnerMessage("Owner access revoked successfully.");
      setCurrentOwner(null);
      setOwnerEmail("");
    } catch (error) {
      console.error("Revoke owner error:", error);
      setOwnerMessage(error.message || "Failed to revoke owner access.");
    } finally {
      setAssigningOwner(false);
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    setRestaurant((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));

    setSuccess("");
    setError("");
  }

  async function saveChanges(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!restaurant.name?.trim()) {
        throw new Error("Restaurant name is required.");
      }

      if (!restaurant.slug?.trim()) {
        throw new Error("Restaurant slug is required.");
      }

      const slug = restaurant.slug.trim().toLowerCase();

      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new Error(
          "Slug can only contain lowercase letters, numbers, and hyphens.",
        );
      }

      const { data, error } = await supabase
        .from("restaurants")
        .update({
          name: restaurant.name.trim(),
          slug,
          logo_url: restaurant.logo_url?.trim() || null,
          description: restaurant.description?.trim() || null,
          phone: restaurant.phone?.trim() || null,
          address: restaurant.address?.trim() || null,
          primary_color: restaurant.primary_color,
          secondary_color: restaurant.secondary_color,
          is_active: restaurant.is_active,
        })
        .eq("id", restaurantId)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("A restaurant with this slug already exists.");
        }

        throw error;
      }

      setRestaurant(data);
      setSuccess("Restaurant updated successfully.");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function resetAnalytics() {
    if (!window.confirm("Are you sure you want to permanently reset all view counts to zero for this restaurant? This will delete all historical view data.")) return;
    
    try {
      setResettingViews(true);
      setError("");
      
      const { error } = await supabase.rpc("reset_restaurant_views", {
        restaurant_id_param: restaurantId
      });
      
      if (error) throw error;
      
      setSuccess("Restaurant analytics reset successfully.");
      
      setRestaurant(prev => ({ ...prev, view_count: 0 }));
      
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to reset analytics.");
    } finally {
      setResettingViews(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  async function deleteRestaurant() {
    try {
      setLoading(true);
      setError("");

      // Delete associated records first to satisfy foreign key constraints
      await supabase.from("restaurant_users").delete().eq("restaurant_id", restaurantId);
      await supabase.from("menu_items").delete().eq("restaurant_id", restaurantId);
      await supabase.from("categories").delete().eq("restaurant_id", restaurantId);

      const { data, error } = await supabase
        .from("restaurants")
        .delete()
        .eq("id", restaurantId)
        .select();

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error("Delete blocked by database Row Level Security. You are missing DELETE policies for admins.");
      }

      navigate("/admin/restaurants", { replace: true });
    } catch (error) {
      console.error("Delete restaurant error:", error);
      const errorMsg = error.message || "Failed to delete restaurant.";
      setError(errorMsg);
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      alert(`Deletion Failed: ${errorMsg}\n\nPlease let me know exactly what this error message says so I can fix the database policy!`);
    }
  }

  // -----------------------------------------
  // Loading
  // -----------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-5 bg-gray-200 rounded w-36" />

            <div className="h-10 bg-gray-200 rounded w-72" />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-96 bg-white border rounded-2xl" />
              <div className="h-72 bg-white border rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------
  // Restaurant not found
  // -----------------------------------------

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to="/admin/restaurants"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black transition"
          >
            <ArrowLeft size={17} />
            Back to Restaurants
          </Link>

          <div className="mt-8 bg-white border rounded-2xl p-8">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <XCircle size={22} />
            </div>

            <h2 className="text-xl font-semibold mt-5">Restaurant not found</h2>

            <p className="text-gray-500 mt-2">
              {error || "The restaurant you're looking for doesn't exist."}
            </p>

            <Link
              to="/admin/restaurants"
              className="inline-flex items-center gap-2 mt-6 bg-black text-white px-5 py-3 rounded-xl font-medium hover:bg-gray-800 transition"
            >
              <ArrowLeft size={17} />
              Back to Restaurants
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const menuUrl = `${window.location.origin}/r/${restaurant.slug}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* =========================================
          HEADER
      ========================================== */}

      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            to="/admin/restaurants"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black transition mb-5"
          >
            <ArrowLeft size={17} />
            Back to Restaurants
          </Link>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              {restaurant.logo_url ? (
                <img
                  src={restaurant.logo_url}
                  alt={`${restaurant.name} logo`}
                  className="w-14 h-14 rounded-xl object-cover border shrink-0"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl shrink-0"
                  style={{
                    backgroundColor: restaurant.primary_color || "#000000",
                    color: restaurant.secondary_color || "#ffffff",
                  }}
                >
                  {restaurant.name?.charAt(0)?.toUpperCase() || "R"}
                </div>
              )}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-bold truncate">
                    {restaurant.name}
                  </h1>

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

                <p className="text-sm text-gray-500 mt-1">
                  /r/{restaurant.slug}
                </p>
              </div>
            </div>

            <a
              href={menuUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 border bg-white px-5 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
            >
              <ExternalLink size={18} />
              Open VideoMenu
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* =========================================
            MESSAGES
        ========================================== */}

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
              <p className="font-medium">Changes saved</p>

              <p className="mt-1">{success}</p>
            </div>
          </div>
        )}

        <form onSubmit={saveChanges}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* =========================================
                MAIN CONTENT
            ========================================== */}

            <div className="lg:col-span-2 space-y-6">
              {/* Restaurant Information */}

              <div className="bg-white border rounded-2xl p-5 sm:p-7">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Store size={19} />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold">
                      Restaurant Information
                    </h2>

                    <p className="text-sm text-gray-500 mt-1">
                      Basic information displayed throughout VideoMenu.
                    </p>
                  </div>
                </div>

                <div className="mt-7 space-y-5">
                  {/* Name */}

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Restaurant Name
                    </label>

                    <input
                      type="text"
                      name="name"
                      value={restaurant.name || ""}
                      onChange={handleChange}
                      className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                      required
                    />
                  </div>

                  {/* Slug */}

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Menu URL Slug
                    </label>

                    <input
                      type="text"
                      name="slug"
                      value={restaurant.slug || ""}
                      onChange={handleChange}
                      className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                      required
                    />

                    <p className="text-xs text-gray-500 mt-2 break-all">
                      Customer URL: {menuUrl}
                    </p>
                  </div>

                  {/* Phone + Address */}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Phone
                      </label>

                      <input
                        type="text"
                        name="phone"
                        value={restaurant.phone || ""}
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
                        value={restaurant.address || ""}
                        onChange={handleChange}
                        placeholder="Bangalore, Karnataka"
                        className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                      />
                    </div>
                  </div>

                  {/* Description */}

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Description
                    </label>

                    <textarea
                      name="description"
                      value={restaurant.description || ""}
                      onChange={handleChange}
                      rows={4}
                      placeholder="Short description of the restaurant..."
                      className="w-full border rounded-xl px-4 py-3 outline-none resize-none focus:ring-2 focus:ring-black/10 focus:border-black"
                    />
                  </div>

                  {/* Logo */}

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Logo URL
                    </label>

                    <input
                      type="url"
                      name="logo_url"
                      value={restaurant.logo_url || ""}
                      onChange={handleChange}
                      placeholder="https://..."
                      className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                    />
                  </div>
                </div>
              </div>

              {/* =========================================
                  RESTAURANT OWNER
              ========================================== */}

              <div className="bg-white border rounded-2xl p-5 sm:p-7">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <UserPlus size={19} />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold">Restaurant Owner</h2>

                    <p className="text-sm text-gray-500 mt-1">
                      Manage the user who has access to this restaurant.
                    </p>
                  </div>
                </div>

                {/* Current Owner */}

                <div className="mt-6">
                  <p className="text-sm font-medium text-gray-700">
                    Current owner
                  </p>

                  {loadingOwner ? (
                    <div className="mt-3 flex items-center gap-3 p-4 bg-gray-50 border rounded-xl">
                      <RefreshCw
                        size={18}
                        className="animate-spin text-gray-400"
                      />

                      <span className="text-sm text-gray-500">
                        Loading owner information...
                      </span>
                    </div>
                  ) : currentOwner ? (
                    <div className="mt-3 flex items-center gap-3 p-4 bg-gray-50 border rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-medium shrink-0">
                        {currentOwner.email?.charAt(0)?.toUpperCase() || "U"}
                      </div>

                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {currentOwner.email || "Unknown email"}
                        </p>

                        <p className="text-xs text-gray-500 mt-1">
                          Restaurant Owner
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 p-4 bg-gray-50 border rounded-xl">
                      <p className="text-sm font-medium">No owner assigned</p>

                      <p className="text-sm text-gray-500 mt-1">
                        Assign a registered user to give them access to this
                        restaurant.
                      </p>
                    </div>
                  )}
                </div>

                {/* Assign / Change Owner */}

                <div className="mt-6 pt-6 border-t">
                  <p className="text-sm font-medium text-gray-700">
                    {currentOwner ? "Change owner" : "Assign owner"}
                  </p>

                  <div className="mt-3 flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      value={ownerEmail}
                      onChange={(e) => {
                        setOwnerEmail(e.target.value);
                        setOwnerMessage("");
                      }}
                      placeholder="Owner email address"
                      className="flex-1 border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                    />

                    <button
                      type="button"
                      onClick={assignOwner}
                      disabled={assigningOwner}
                      className="inline-flex items-center justify-center gap-2 bg-black text-white px-5 py-3 rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 transition"
                    >
                      {assigningOwner ? (
                        <>
                          <RefreshCw size={17} className="animate-spin" />
                          Assigning...
                        </>
                      ) : (
                        <>
                          <UserPlus size={17} />
                          {currentOwner ? "Change Owner" : "Assign Owner"}
                        </>
                      )}
                    </button>

                    {currentOwner && (
                      <button
                        type="button"
                        onClick={revokeOwner}
                        disabled={assigningOwner}
                        className="inline-flex items-center justify-center gap-2 border bg-white text-red-600 border-red-200 px-5 py-3 rounded-xl font-medium hover:bg-red-50 disabled:opacity-50 transition"
                      >
                        <UserMinus size={17} />
                        Revoke Access
                      </button>
                    )}
                  </div>

                  {ownerMessage && (
                    <div
                      className={`mt-4 rounded-xl border p-4 text-sm ${
                        ownerMessage.toLowerCase().includes("success")
                          ? "bg-green-50 border-green-200 text-green-700"
                          : "bg-gray-50 border-gray-200 text-gray-700"
                      }`}
                    >
                      {ownerMessage}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* =========================================
                SIDEBAR
            ========================================== */}

            <div className="space-y-6">
              {/* Status */}

              <div className="bg-white border rounded-2xl p-5 sm:p-6">
                <h2 className="text-lg font-semibold">Restaurant Status</h2>

                <label className="flex items-start gap-3 mt-5 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={!!restaurant.is_active}
                    onChange={handleChange}
                    className="w-5 h-5 mt-0.5"
                  />

                  <div>
                    <p className="font-medium">Restaurant is active</p>

                    <p className="text-sm text-gray-500 mt-1">
                      Customers can access this VideoMenu.
                    </p>
                  </div>
                </label>
              </div>

              {/* Branding */}

              <div className="bg-white border rounded-2xl p-5 sm:p-6">
                <h2 className="text-lg font-semibold">Branding</h2>

                <div className="mt-5 space-y-5">
                  {/* Primary */}

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Primary Color
                    </label>

                    <div className="flex gap-3">
                      <input
                        type="color"
                        name="primary_color"
                        value={restaurant.primary_color || "#000000"}
                        onChange={handleChange}
                        className="w-14 h-12 border rounded-xl cursor-pointer"
                      />

                      <input
                        type="text"
                        value={restaurant.primary_color || ""}
                        onChange={(e) => {
                          setRestaurant((previous) => ({
                            ...previous,
                            primary_color: e.target.value,
                          }));

                          setSuccess("");
                        }}
                        className="flex-1 border rounded-xl px-3"
                      />
                    </div>
                  </div>

                  {/* Secondary */}

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Secondary Color
                    </label>

                    <div className="flex gap-3">
                      <input
                        type="color"
                        name="secondary_color"
                        value={restaurant.secondary_color || "#ffffff"}
                        onChange={handleChange}
                        className="w-14 h-12 border rounded-xl cursor-pointer"
                      />

                      <input
                        type="text"
                        value={restaurant.secondary_color || ""}
                        onChange={(e) => {
                          setRestaurant((previous) => ({
                            ...previous,
                            secondary_color: e.target.value,
                          }));

                          setSuccess("");
                        }}
                        className="flex-1 border rounded-xl px-3"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* VideoMenu URL */}

              <div className="bg-white border rounded-2xl p-5 sm:p-6">
                <h2 className="text-lg font-semibold">VideoMenu URL</h2>

                <p className="text-sm text-gray-500 mt-1">
                  This is the public link customers will use.
                </p>

                <div className="mt-4 bg-gray-50 border rounded-xl p-3 text-sm break-all">
                  {menuUrl}
                </div>

                <a
                  href={menuUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium hover:underline"
                >
                  View customer menu
                  <ExternalLink size={15} />
                </a>
              </div>

              {/* Save */}

              <div className="bg-white border rounded-2xl p-5 sm:p-6">
                <h2 className="text-lg font-semibold">Save Changes</h2>

                <p className="text-sm text-gray-500 mt-1">
                  Save any changes you've made to this restaurant.
                </p>

                <button
                  type="submit"
                  disabled={saving}
                  className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-black text-white px-5 py-3 rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 transition"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={17} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={17} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>

              {/* Reset Analytics */}
              
              <div className="bg-white border rounded-2xl p-5 sm:p-6 mt-6">
                <h2 className="text-lg font-semibold">Analytics</h2>
                
                <p className="text-sm text-gray-500 mt-1">
                  Reset the customer view tracking for this restaurant.
                </p>

                <button
                  type="button"
                  onClick={resetAnalytics}
                  disabled={resettingViews}
                  className="mt-5 w-full inline-flex items-center justify-center gap-2 border bg-white px-5 py-3 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50 transition"
                >
                  <RefreshCw size={17} className={resettingViews ? "animate-spin" : ""} />
                  {resettingViews ? "Resetting..." : "Reset View Count to Zero"}
                </button>
              </div>

              {/* Danger Zone */}
              <div className="bg-white border border-red-200 rounded-2xl p-5 sm:p-6 mt-6">
                <h2 className="text-lg font-semibold text-red-600">
                  Danger Zone
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Permanently delete this restaurant and all of its data.
                </p>

                {showConfirmDelete ? (
                  <div className="mt-5 space-y-3">
                    <p className="text-sm font-medium text-red-600">Are you absolutely sure?</p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={deleteRestaurant}
                        className="flex-1 bg-red-600 text-white px-5 py-3 rounded-xl font-medium hover:bg-red-700 transition"
                      >
                        Yes, Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowConfirmDelete(false)}
                        className="flex-1 bg-gray-100 text-gray-700 px-5 py-3 rounded-xl font-medium hover:bg-gray-200 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowConfirmDelete(true)}
                    className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-red-50 text-red-600 px-5 py-3 rounded-xl font-medium hover:bg-red-100 transition"
                  >
                    <Trash2 size={17} />
                    Delete Restaurant
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
