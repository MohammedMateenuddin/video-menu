import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Star,
  Eye,
  EyeOff,
  Upload,
  Image as ImageIcon,
  Video,
  Search,
  RefreshCw,
  UtensilsCrossed,
  CheckCircle2,
  GripVertical,
} from "lucide-react";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import { uploadMenuMedia, deleteMenuMedia } from "../../services/storageService";
import { supabase } from "../../lib/supabase";
import { getCurrentRestaurant } from "../../services/restaurantService";

/*
 * =========================================================
 * SORTABLE MENU ITEM
 * =========================================================
 */

function SortableMenuItem({ item, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`relative transition ${
        isDragging
          ? "opacity-80 shadow-xl bg-white rounded-xl scale-[1.01]"
          : ""
      }`}
    >
      {children(listeners)}
    </div>
  );
}

/*
 * =========================================================
 * MENU
 * =========================================================
 */

function Menu() {
  const [restaurantId, setRestaurantId] = useState(null);

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const [savingOrder, setSavingOrder] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [imageFile, setImageFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category_id: "",
    is_bestseller: false,
    is_available: true,
    image_url: "",
    video_url: "",
  });

  /*
   * =========================================================
   * DRAG SENSORS
   * =========================================================
   */

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  /*
   * =========================================================
   * INITIAL LOAD
   * =========================================================
   */

  useEffect(() => {
    loadData();
  }, []);

  /*
   * =========================================================
   * LOAD DATA
   * =========================================================
   */

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const restaurantData = await getCurrentRestaurant();

      const id = restaurantData?.restaurants?.id;

      if (!id) {
        throw new Error("Unable to determine your restaurant.");
      }

      setRestaurantId(id);

      const [categoriesResult, menuResult] = await Promise.all([
        supabase
          .from("categories")
          .select("*")
          .eq("restaurant_id", id)
          .order("display_order", {
            ascending: true,
          }),

        supabase
          .from("menu_items")
          .select("*")
          .eq("restaurant_id", id)
          .order("display_order", {
            ascending: true,
          }),
      ]);

      if (categoriesResult.error) {
        throw categoriesResult.error;
      }

      if (menuResult.error) {
        throw menuResult.error;
      }

      setCategories(categoriesResult.data || []);
      setMenuItems(menuResult.data || []);
    } catch (error) {
      console.error("Load menu error:", error);

      setError(error?.message || "Unable to load your menu.");
    } finally {
      setLoading(false);
    }
  }

  /*
   * =========================================================
   * FORM CHANGE
   * =========================================================
   */

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));

    setError("");
    setSuccess("");
  }

  /*
   * =========================================================
   * RESET FORM
   * =========================================================
   */

  function resetForm() {
    setForm({
      name: "",
      description: "",
      price: "",
      category_id: "",
      is_bestseller: false,
      is_available: true,
      image_url: "",
      video_url: "",
    });

    setImageFile(null);
    setVideoFile(null);

    setEditingId(null);
    setShowForm(false);

    setError("");
  }

  /*
   * =========================================================
   * OPEN ADD FORM
   * =========================================================
   */

  function openAddForm() {
    resetForm();

    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /*
   * =========================================================
   * EDIT
   * =========================================================
   */

  function startEditing(item) {
    setForm({
      name: item.name || "",
      description: item.description || "",
      price:
        item.price !== null && item.price !== undefined
          ? String(item.price)
          : "",
      category_id: item.category_id || "",
      is_bestseller: item.is_bestseller || false,
      is_available: item.is_available ?? true,
      image_url: item.image_url || "",
      video_url: item.video_url || "",
    });

    setImageFile(null);
    setVideoFile(null);

    setEditingId(item.id);
    setShowForm(true);

    setError("");
    setSuccess("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /*
   * =========================================================
   * IMAGE UPLOAD
   * =========================================================
   */

  async function handleImageUpload(file) {
    if (!file || !restaurantId) {
      return;
    }

    try {
      setUploadingImage(true);
      setError("");
      setSuccess("");

      const url = await uploadMenuMedia(file, restaurantId, "images");

      setForm((previous) => ({
        ...previous,
        image_url: url,
      }));

      setImageFile(file);
    } catch (error) {
      console.error("Image upload error:", error);

      setError(error?.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  }

  /*
   * =========================================================
   * VIDEO UPLOAD
   * =========================================================
   */

  async function handleVideoUpload(file) {
    if (!file || !restaurantId) {
      return;
    }

    try {
      setUploadingVideo(true);
      setError("");
      setSuccess("");

      const url = await uploadMenuMedia(file, restaurantId, "videos");

      setForm((previous) => ({
        ...previous,
        video_url: url,
      }));

      setVideoFile(file);
    } catch (error) {
      console.error("Video upload error:", error);

      setError(error?.message || "Failed to upload video.");
    } finally {
      setUploadingVideo(false);
    }
  }

  /*
   * =========================================================
   * SAVE DISH
   * =========================================================
   */

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!restaurantId) {
      setError("Restaurant information is not available.");
      return;
    }

    if (!form.name.trim()) {
      setError("Dish name is required.");
      return;
    }

    if (
      form.price === "" ||
      Number.isNaN(Number(form.price)) ||
      Number(form.price) < 0
    ) {
      setError("Please enter a valid price.");
      return;
    }

    if (!form.category_id) {
      setError("Please select a category.");
      return;
    }

    try {
      setSaving(true);

      const dishData = {
        restaurant_id: restaurantId,
        category_id: form.category_id,
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        image_url: form.image_url || null,
        video_url: form.video_url || null,
        is_bestseller: form.is_bestseller,
        is_available: form.is_available,
      };

      if (editingId) {
        const oldDish = menuItems.find((item) => item.id === editingId);

        const { error } = await supabase
          .from("menu_items")
          .update(dishData)
          .eq("id", editingId)
          .eq("restaurant_id", restaurantId);

        if (error) {
          throw error;
        }

        if (oldDish) {
          if (oldDish.image_url && oldDish.image_url !== form.image_url) {
            await deleteMenuMedia(oldDish.image_url);
          }
          if (oldDish.video_url && oldDish.video_url !== form.video_url) {
            await deleteMenuMedia(oldDish.video_url);
          }
        }

        setSuccess("Dish updated successfully.");
      } else {
        const nextOrder =
          menuItems.length > 0
            ? Math.max(...menuItems.map((item) => item.display_order || 0)) + 1
            : 1;

        const { error } = await supabase.from("menu_items").insert({
          ...dishData,
          display_order: nextOrder,
        });

        if (error) {
          throw error;
        }

        setSuccess("Dish added successfully.");
      }

      resetForm();

      await loadData();
    } catch (error) {
      console.error("Save dish error:", error);

      setError(error?.message || "Unable to save this dish.");
    } finally {
      setSaving(false);
    }
  }

  /*
   * =========================================================
   * DELETE DISH
   * =========================================================
   */

  async function deleteDish(item) {
    const confirmed = window.confirm(
      `Delete "${item.name}"?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", item.id)
        .eq("restaurant_id", restaurantId);

      if (error) {
        throw error;
      }

      if (item.image_url) {
        await deleteMenuMedia(item.image_url);
      }
      if (item.video_url) {
        await deleteMenuMedia(item.video_url);
      }

      setSuccess(`"${item.name}" was deleted successfully.`);

      await loadData();
    } catch (error) {
      console.error("Delete dish error:", error);

      setError(error?.message || "Unable to delete this dish.");
    }
  }

  /*
   * =========================================================
   * AVAILABILITY
   * =========================================================
   */

  async function toggleAvailability(item) {
    try {
      setError("");
      setSuccess("");

      const nextValue = !item.is_available;

      const { error } = await supabase
        .from("menu_items")
        .update({
          is_available: nextValue,
        })
        .eq("id", item.id)
        .eq("restaurant_id", restaurantId);

      if (error) {
        throw error;
      }

      setMenuItems((previous) =>
        previous.map((menuItem) =>
          menuItem.id === item.id
            ? {
                ...menuItem,
                is_available: nextValue,
              }
            : menuItem,
        ),
      );
    } catch (error) {
      console.error("Toggle availability error:", error);

      setError(error?.message || "Unable to update availability.");
    }
  }

  /*
   * =========================================================
   * CATEGORY NAME
   * =========================================================
   */

  function getCategoryName(categoryId) {
    const category = categories.find((item) => item.id === categoryId);

    return category?.name || "Uncategorized";
  }

  /*
   * =========================================================
   * FILTERED MENU
   * =========================================================
   */

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return menuItems.filter((item) => {
      const matchesSearch =
        !query ||
        item.name?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query);

      const matchesCategory =
        selectedCategory === "all" || item.category_id === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [menuItems, search, selectedCategory]);

  /*
   * =========================================================
   * STATS
   * =========================================================
   */

  const availableCount = menuItems.filter((item) => item.is_available).length;

  const bestsellerCount = menuItems.filter((item) => item.is_bestseller).length;

  /*
   * =========================================================
   * DRAG & DROP REORDER
   * =========================================================
   */

  async function handleDragEnd(event) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = menuItems.findIndex((item) => item.id === active.id);

    const newIndex = menuItems.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reorderedItems = arrayMove(menuItems, oldIndex, newIndex);

    // Optimistic update
    setMenuItems(reorderedItems);

    try {
      setSavingOrder(true);
      setError("");
      setSuccess("");

      /*
       * Save every item's new position.
       *
       * We intentionally use the restaurant_id
       * condition as an additional safety check.
       */
      for (let index = 0; index < reorderedItems.length; index++) {
        const item = reorderedItems[index];

        const { error } = await supabase
          .from("menu_items")
          .update({
            display_order: index + 1,
          })
          .eq("id", item.id)
          .eq("restaurant_id", restaurantId);

        if (error) {
          throw error;
        }
      }

      const normalizedItems = reorderedItems.map((item, index) => ({
        ...item,
        display_order: index + 1,
      }));

      setMenuItems(normalizedItems);

      setSuccess("Menu order saved successfully.");
    } catch (error) {
      console.error("Save menu order error:", error);

      setError(error?.message || "Unable to save menu order.");

      // Restore database state
      await loadData();
    } finally {
      setSavingOrder(false);
    }
  }

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-9 w-40 bg-gray-200 rounded-lg animate-pulse" />

          <div className="h-5 w-72 bg-gray-100 rounded-lg mt-3 animate-pulse" />
        </div>

        <div className="bg-white border rounded-2xl p-8">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />

          <div className="h-20 w-full bg-gray-100 rounded-xl mt-6 animate-pulse" />

          <div className="h-20 w-full bg-gray-100 rounded-xl mt-3 animate-pulse" />
        </div>
      </div>
    );
  }

  /*
   * =========================================================
   * PAGE
   * =========================================================
   */

  return (
    <div className="max-w-[1400px]">
      {/* =========================================
          HEADER
      ========================================== */}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menu</h1>

          <p className="text-gray-500 mt-2">
            Manage your dishes, prices, videos and availability.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          disabled={isReordering}
          className="inline-flex items-center justify-center gap-2 bg-black text-white px-5 py-3 rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 transition"
        >
          <Plus size={18} />
          Add Dish
        </button>
      </div>

      {/* =========================================
          MESSAGES
      ========================================== */}

      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="font-semibold">Error</div>

            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-5 bg-green-50 border border-green-200 text-green-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={18} />

            <p className="text-sm font-medium">{success}</p>
          </div>
        </div>
      )}

      {/* =========================================
          QUICK STATS
      ========================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border rounded-2xl p-5">
          <p className="text-sm text-gray-500">Total dishes</p>

          <p className="text-2xl font-bold mt-1">{menuItems.length}</p>
        </div>

        <div className="bg-white border rounded-2xl p-5">
          <p className="text-sm text-gray-500">Available</p>

          <p className="text-2xl font-bold mt-1">{availableCount}</p>
        </div>

        <div className="bg-white border rounded-2xl p-5">
          <p className="text-sm text-gray-500">Bestsellers</p>

          <p className="text-2xl font-bold mt-1">{bestsellerCount}</p>
        </div>
      </div>

      {/* =========================================
          ADD / EDIT FORM
      ========================================== */}

      {showForm && (
        <div className="bg-white border rounded-2xl p-5 sm:p-6 mb-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold">
                {editingId ? "Edit Dish" : "Add New Dish"}
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Add the information customers will see on your VideoMenu.
              </p>
            </div>

            <button
              type="button"
              onClick={resetForm}
              disabled={saving || uploadingImage || uploadingVideo}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name + Price */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Dish Name
                </label>

                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Chicken Biryani"
                  className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Price</label>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                    ₹
                  </span>

                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={handleChange}
                    placeholder="220"
                    className="w-full border rounded-xl pl-9 pr-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Category */}

            <div>
              <label className="block text-sm font-medium mb-2">Category</label>

              <select
                name="category_id"
                value={form.category_id}
                onChange={handleChange}
                className="w-full border rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                required
              >
                <option value="">Select a category</option>

                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              {categories.length === 0 && (
                <p className="text-sm text-orange-600 mt-2">
                  Create a category first.
                </p>
              )}
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
                rows={4}
                placeholder="A short description of the dish..."
                className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black resize-none"
              />
            </div>

            {/* =========================================
                MEDIA
            ========================================== */}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* IMAGE */}

              <div className="border rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                    <ImageIcon size={18} />
                  </div>

                  <div>
                    <h3 className="font-semibold">Food Image</h3>

                    <p className="text-xs text-gray-500">JPG, PNG or WebP</p>
                  </div>
                </div>

                <label className="flex flex-col items-center justify-center gap-2 border border-dashed rounded-xl p-7 cursor-pointer hover:bg-gray-50 transition">
                  <Upload size={20} className="text-gray-500" />

                  <span className="text-sm font-medium text-center">
                    {uploadingImage
                      ? "Uploading..."
                      : imageFile
                        ? imageFile.name
                        : "Choose an image"}
                  </span>

                  <span className="text-xs text-gray-500">Click to browse</span>

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadingImage}
                    onChange={(e) => handleImageUpload(e.target.files?.[0])}
                  />
                </label>

                {form.image_url && (
                  <div className="relative mt-4">
                    <img
                      src={form.image_url}
                      alt="Dish preview"
                      className="w-full h-48 object-cover rounded-xl border"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setForm((previous) => ({
                          ...previous,
                          image_url: "",
                        }))
                      }
                      className="absolute top-2 right-2 bg-black/80 text-white p-2 rounded-lg hover:bg-black transition"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}
              </div>

              {/* VIDEO */}

              <div className="border rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Video size={18} />
                  </div>

                  <div>
                    <h3 className="font-semibold">Food Video</h3>

                    <p className="text-xs text-gray-500">MP4, WebM or MOV</p>
                  </div>
                </div>

                <label className="flex flex-col items-center justify-center gap-2 border border-dashed rounded-xl p-7 cursor-pointer hover:bg-gray-50 transition">
                  <Upload size={20} className="text-gray-500" />

                  <span className="text-sm font-medium text-center">
                    {uploadingVideo
                      ? "Uploading..."
                      : videoFile
                        ? videoFile.name
                        : "Choose a video"}
                  </span>

                  <span className="text-xs text-gray-500">Click to browse</span>

                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    disabled={uploadingVideo}
                    onChange={(e) => handleVideoUpload(e.target.files?.[0])}
                  />
                </label>

                {form.video_url && (
                  <div className="relative mt-4">
                    <video
                      src={form.video_url}
                      controls
                      className="w-full h-48 object-cover rounded-xl border"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setForm((previous) => ({
                          ...previous,
                          video_url: "",
                        }))
                      }
                      className="absolute top-2 right-2 bg-black/80 text-white p-2 rounded-lg hover:bg-black transition"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* OPTIONS */}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center justify-between border rounded-xl p-4 cursor-pointer hover:bg-gray-50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-yellow-50 flex items-center justify-center">
                    <Star size={17} className="text-yellow-600" />
                  </div>

                  <div>
                    <p className="font-medium text-sm">Bestseller</p>

                    <p className="text-xs text-gray-500">Highlight this dish</p>
                  </div>
                </div>

                <input
                  type="checkbox"
                  name="is_bestseller"
                  checked={form.is_bestseller}
                  onChange={handleChange}
                  className="w-5 h-5"
                />
              </label>

              <label className="flex items-center justify-between border rounded-xl p-4 cursor-pointer hover:bg-gray-50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                    <Eye size={17} className="text-green-600" />
                  </div>

                  <div>
                    <p className="font-medium text-sm">Available</p>

                    <p className="text-xs text-gray-500">
                      Visible to customers
                    </p>
                  </div>
                </div>

                <input
                  type="checkbox"
                  name="is_available"
                  checked={form.is_available}
                  onChange={handleChange}
                  className="w-5 h-5"
                />
              </label>
            </div>

            {/* BUTTONS */}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving || uploadingImage || uploadingVideo}
                className="px-5 py-3 border rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50 transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  saving ||
                  uploadingImage ||
                  uploadingVideo ||
                  categories.length === 0
                }
                className="inline-flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 transition"
              >
                {saving ? (
                  <>
                    <RefreshCw size={17} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={17} />

                    {editingId ? "Update Dish" : "Add Dish"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================
          MENU TOOLBAR
      ========================================== */}

      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Your Dishes</h2>

              <p className="text-sm text-gray-500 mt-1">
                {isReordering
                  ? `${menuItems.length} dishes`
                  : `${filteredItems.length} of ${menuItems.length} ${
                      menuItems.length === 1 ? "dish" : "dishes"
                    }`}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* SEARCH */}

              {!isReordering && (
                <div className="relative w-full sm:w-72 lg:w-80">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search dishes..."
                    className="w-full border rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                  />
                </div>
              )}

              {/* REORDER */}

              {menuItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsReordering((previous) => !previous);

                    setSearch("");
                    setSelectedCategory("all");

                    setError("");
                    setSuccess("");
                  }}
                  disabled={savingOrder}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition whitespace-nowrap ${
                    isReordering
                      ? "bg-black text-white border-black hover:bg-gray-800"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <GripVertical size={17} />

                  {isReordering ? "Done Reordering" : "Reorder Dishes"}
                </button>
              )}
            </div>
          </div>

          {/* REORDER INFO */}

          {isReordering && (
            <div className="mt-5 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0">
                  <GripVertical size={18} className="text-blue-600" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    Reordering menu
                  </p>

                  <p className="text-sm text-blue-700 mt-1">
                    Drag the dishes into the order you want customers to see.
                    Changes are saved automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CATEGORY FILTERS */}

          {!isReordering && (
            <div className="flex items-center gap-2 overflow-x-auto pt-5 pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                  selectedCategory === "all"
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                All dishes
              </button>

              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                    selectedCategory === category.id
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* =========================================
            ITEMS
        ========================================== */}

        {isReordering ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={menuItems.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y">
                {menuItems.map((item, index) => (
                  <SortableMenuItem key={item.id} item={item}>
                    {(listeners) => (
                      <div className="flex items-center gap-4 p-4 sm:p-5 bg-white">
                        {/* DRAG HANDLE */}

                        <button
                          type="button"
                          {...listeners}
                          className="w-10 h-10 shrink-0 rounded-xl border border-dashed flex items-center justify-center text-gray-400 hover:text-black hover:bg-gray-50 cursor-grab active:cursor-grabbing touch-none"
                          title="Drag to reorder"
                        >
                          <GripVertical size={20} />
                        </button>

                        {/* ORDER NUMBER */}

                        <div className="hidden sm:flex w-8 text-sm text-gray-400 font-medium">
                          {index + 1}
                        </div>

                        {/* IMAGE */}

                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon size={22} className="text-gray-300" />
                            </div>
                          )}
                        </div>

                        {/* DETAILS */}

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold truncate">
                              {item.name}
                            </h3>

                            {item.is_bestseller && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full">
                                <Star size={11} fill="currentColor" />
                                Bestseller
                              </span>
                            )}

                            {!item.is_available && (
                              <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                                Unavailable
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-gray-500 mt-1">
                            {getCategoryName(item.category_id)}
                          </p>

                          <p className="font-semibold mt-1">
                            ₹{Number(item.price).toFixed(2)}
                          </p>
                        </div>

                        {/* SAVING INDICATOR */}

                        {savingOrder && index === 0 && (
                          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
                            <RefreshCw size={14} className="animate-spin" />
                            Saving...
                          </div>
                        )}
                      </div>
                    )}
                  </SortableMenuItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center">
              {search || selectedCategory !== "all" ? (
                <Search size={25} className="text-gray-400" />
              ) : (
                <UtensilsCrossed size={25} className="text-gray-400" />
              )}
            </div>

            <h3 className="font-semibold mt-5">
              {search || selectedCategory !== "all"
                ? "No dishes found"
                : "No dishes yet"}
            </h3>

            <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
              {search || selectedCategory !== "all"
                ? "Try changing your search or category filter."
                : "Add your first dish to start building your digital menu."}
            </p>

            {!search && selectedCategory === "all" && (
              <button
                type="button"
                onClick={openAddForm}
                className="mt-5 inline-flex items-center gap-2 bg-black text-white px-5 py-3 rounded-xl font-medium hover:bg-gray-800 transition"
              >
                <Plus size={17} />
                Add First Dish
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className={`p-5 sm:p-6 flex flex-col lg:flex-row gap-5 transition ${
                  !item.is_available ? "bg-gray-50" : "bg-white"
                }`}
              >
                {/* IMAGE */}

                <div className="w-full lg:w-28 h-48 lg:h-28 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon size={25} className="text-gray-300" />
                    </div>
                  )}
                </div>

                {/* DETAILS */}

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{item.name}</h3>

                    {item.is_bestseller && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-yellow-50 text-yellow-700 px-2.5 py-1 rounded-full">
                        <Star size={12} fill="currentColor" />
                        Bestseller
                      </span>
                    )}

                    {!item.is_available && (
                      <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2.5 py-1 rounded-full">
                        Unavailable
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-500 mt-1">
                    {getCategoryName(item.category_id)}
                  </p>

                  {item.description && (
                    <p className="text-sm text-gray-500 mt-3 line-clamp-2 max-w-2xl">
                      {item.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 mt-4">
                    <span className="font-semibold">
                      ₹{Number(item.price).toFixed(2)}
                    </span>

                    {item.video_url && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                        <Video size={14} />
                        Video
                      </span>
                    )}

                    {item.image_url && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                        <ImageIcon size={14} />
                        Image
                      </span>
                    )}
                  </div>
                </div>

                {/* ACTIONS */}

                <div className="flex flex-wrap lg:flex-col xl:flex-row items-center gap-2 lg:self-center">
                  <button
                    type="button"
                    onClick={() => toggleAvailability(item)}
                    title={
                      item.is_available ? "Mark unavailable" : "Mark available"
                    }
                    className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition ${
                      item.is_available
                        ? "bg-green-50 text-green-700 hover:bg-green-100"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {item.is_available ? (
                      <>
                        <Eye size={16} />

                        <span className="hidden xl:inline">Available</span>
                      </>
                    ) : (
                      <>
                        <EyeOff size={16} />

                        <span className="hidden xl:inline">Unavailable</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => startEditing(item)}
                    title="Edit dish"
                    className="p-2.5 rounded-xl border hover:bg-gray-50 transition"
                  >
                    <Pencil size={17} />
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteDish(item)}
                    title="Delete dish"
                    className="p-2.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* =========================================
            FOOTER
        ========================================== */}

        {menuItems.length > 0 && !isReordering && (
          <div className="px-5 sm:px-6 py-4 bg-gray-50 border-t">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-black disabled:opacity-50 transition"
            >
              <RefreshCw size={15} />
              Refresh menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Menu;
