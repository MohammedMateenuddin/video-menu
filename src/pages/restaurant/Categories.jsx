import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Search,
  RefreshCw,
  FolderOpen,
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

import { supabase } from "../../lib/supabase";
import { getCurrentRestaurant } from "../../services/restaurantService";

function SortableCategory({ category, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: category.id,
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


function Categories() {
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  const [restaurantId, setRestaurantId] = useState(null);

  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  useEffect(() => {
    loadCategories();
  }, []);

  // =========================================
  // LOAD
  // =========================================

  async function loadCategories() {
    try {
      setLoading(true);
      setError("");

      const restaurantData = await getCurrentRestaurant();

      const id = restaurantData?.restaurants?.id;

      if (!id) {
        throw new Error("Unable to determine your restaurant.");
      }

      setRestaurantId(id);

      const [categoriesResult, menuItemsResult] = await Promise.all([
        supabase
          .from("categories")
          .select("*")
          .eq("restaurant_id", id)
          .order("display_order", {
            ascending: true,
          }),

        supabase
          .from("menu_items")
          .select("id, category_id")
          .eq("restaurant_id", id),
      ]);

      if (categoriesResult.error) {
        throw categoriesResult.error;
      }

      if (menuItemsResult.error) {
        throw menuItemsResult.error;
      }

      setCategories(categoriesResult.data || []);

      setMenuItems(menuItemsResult.data || []);
    } catch (error) {
      console.error("Load categories error:", error);

      setError(error?.message || "Unable to load categories.");
    } finally {
      setLoading(false);
    }
  }

  // =========================================
  // FORM
  // =========================================

  async function handleSubmit(e) {
    e.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Category name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (editingId) {
        const { error } = await supabase
          .from("categories")
          .update({
            name: trimmedName,
          })
          .eq("id", editingId)
          .eq("restaurant_id", restaurantId);

        if (error) {
          throw error;
        }

        setSuccess("Category updated successfully.");
      } else {
        const nextOrder =
          categories.length > 0
            ? Math.max(
                ...categories.map((category) => category.display_order || 0),
              ) + 1
            : 1;

        const { error } = await supabase.from("categories").insert({
          restaurant_id: restaurantId,
          name: trimmedName,
          display_order: nextOrder,
        });

        if (error) {
          throw error;
        }

        setSuccess("Category created successfully.");
      }

      setName("");
      setEditingId(null);

      await loadCategories();
    } catch (error) {
      console.error("Save category error:", error);

      setError(error?.message || "Unable to save category.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(category) {
    setEditingId(category.id);
    setName(category.name || "");

    setError("");
    setSuccess("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setName("");
    setError("");
    setSuccess("");
  }

  // =========================================
  // DELETE
  // =========================================

  async function deleteCategory(category) {
    const itemCount = menuItems.filter(
      (item) => item.category_id === category.id,
    ).length;

    if (itemCount > 0) {
      setError(
        `"${category.name}" contains ${itemCount} ${
          itemCount === 1 ? "dish" : "dishes"
        }. Move or delete those dishes before deleting this category.`,
      );

      return;
    }

    const confirmed = window.confirm(
      `Delete "${category.name}"?\n\nThis category is empty and can be safely deleted.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(category.id);
      setError("");
      setSuccess("");

      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", category.id)
        .eq("restaurant_id", restaurantId);

      if (error) {
        throw error;
      }

      setSuccess(`"${category.name}" was deleted successfully.`);

      await loadCategories();
    } catch (error) {
      console.error("Delete category error:", error);

      setError(error?.message || "Unable to delete category.");
    } finally {
      setDeletingId(null);
    }
  }

  // =========================================
  // DRAG & DROP REORDER
  // =========================================

  async function handleDragEnd(event) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = categories.findIndex((item) => item.id === active.id);
    const newIndex = categories.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reorderedCategories = arrayMove(categories, oldIndex, newIndex);

    setCategories(reorderedCategories);

    try {
      setSavingOrder(true);
      setError("");
      setSuccess("");

      for (let index = 0; index < reorderedCategories.length; index++) {
        const category = reorderedCategories[index];

        const { error } = await supabase
          .from("categories")
          .update({
            display_order: index + 1,
          })
          .eq("id", category.id)
          .eq("restaurant_id", restaurantId);

        if (error) {
          throw error;
        }
      }

      const normalizedCategories = reorderedCategories.map(
        (category, index) => ({
          ...category,
          display_order: index + 1,
        }),
      );

      setCategories(normalizedCategories);
      setSuccess("Category order saved successfully.");
    } catch (error) {
      console.error("Save category order error:", error);
      setError(error?.message || "Unable to save category order.");
      await loadCategories();
    } finally {
      setSavingOrder(false);
    }
  }

  // =========================================
  // SEARCH
  // =========================================

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return categories;
    }

    return categories.filter((category) =>
      category.name?.toLowerCase().includes(query),
    );
  }, [categories, search]);

  // =========================================
  // DISH COUNT
  // =========================================

  function getDishCount(categoryId) {
    return menuItems.filter((item) => item.category_id === categoryId).length;
  }

  // =========================================
  // STATS
  // =========================================

  const totalDishes = menuItems.length;

  const emptyCategories = categories.filter(
    (category) => getDishCount(category.id) === 0,
  ).length;

  // =========================================
  // LOADING
  // =========================================

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-9 bg-gray-200 rounded-lg w-48" />

          <div className="h-4 bg-gray-200 rounded w-80 mt-3" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-28 bg-white border rounded-2xl animate-pulse"
            />
          ))}
        </div>

        <div className="h-72 bg-white border rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* =========================================
          HEADER
      ========================================== */}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-black text-white flex items-center justify-center">
            <FolderOpen size={20} />
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">Categories</h1>

            <p className="text-gray-500 mt-1">
              Organize your menu into clear sections.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            cancelEditing();

            window.scrollTo({
              top: 0,
              behavior: "smooth",
            });
          }}
          className="inline-flex items-center justify-center gap-2 bg-black text-white px-5 py-3 rounded-xl font-medium hover:bg-gray-800 transition"
        >
          <Plus size={18} />
          Add Category
        </button>
      </div>

      {/* =========================================
          ALERTS
      ========================================== */}

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
          <X size={18} className="mt-0.5 shrink-0" />

          <div className="text-sm">
            <p className="font-medium">Something went wrong</p>

            <p className="mt-1">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />

          <p className="text-sm">{success}</p>
        </div>
      )}

      {/* =========================================
          STATS
      ========================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border rounded-2xl p-5">
          <p className="text-sm text-gray-500">Categories</p>

          <p className="text-3xl font-bold mt-2">{categories.length}</p>
        </div>

        <div className="bg-white border rounded-2xl p-5">
          <p className="text-sm text-gray-500">Menu dishes</p>

          <p className="text-3xl font-bold mt-2">{totalDishes}</p>
        </div>

        <div className="bg-white border rounded-2xl p-5">
          <p className="text-sm text-gray-500">Empty categories</p>

          <p className="text-3xl font-bold mt-2">{emptyCategories}</p>

          <p className="text-xs text-gray-500 mt-1">
            Categories without dishes
          </p>
        </div>
      </div>

      {/* =========================================
          ADD / EDIT
      ========================================== */}

      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="px-5 sm:px-7 py-5 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
              {editingId ? <Pencil size={17} /> : <Plus size={18} />}
            </div>

            <div>
              <h2 className="font-semibold">
                {editingId ? "Edit Category" : "Add Category"}
              </h2>

              <p className="text-xs text-gray-500 mt-1">
                {editingId
                  ? "Update the category name."
                  : "Create a new section for your menu."}
              </p>
            </div>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={cancelEditing}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
              title="Cancel editing"
            >
              <X size={19} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Example: Starters"
              className="flex-1 border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
              maxLength={80}
            />

            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="inline-flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 transition"
            >
              {saving ? (
                <>
                  <RefreshCw size={17} className="animate-spin" />
                  Saving...
                </>
              ) : editingId ? (
                <>
                  <CheckCircle2 size={17} />
                  Update Category
                </>
              ) : (
                <>
                  <Plus size={17} />
                  Add Category
                </>
              )}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancelEditing}
                className="px-5 py-3 border rounded-xl font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 mt-2">
            Keep category names short and easy for customers to understand.
          </p>
        </form>
      </div>

      {/* =========================================
          CATEGORY LIST
      ========================================== */}

      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="font-semibold text-lg">Your Categories</h2>

              <p className="text-sm text-gray-500 mt-1">
                {isReordering
                  ? `${categories.length} categories`
                  : `${filteredCategories.length} of ${categories.length} ${
                      categories.length === 1 ? "category" : "categories"
                    }`}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {!isReordering && (
                <div className="relative w-full lg:w-80">
                  <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search categories..."
                    className="w-full border rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-black/10 focus:border-black"
                  />
                </div>
              )}

              {categories.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsReordering((prev) => !prev);
                    setSearch("");
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
                  {isReordering ? "Done Reordering" : "Reorder"}
                </button>
              )}
            </div>
          </div>
        </div>

        {isReordering && (
          <div className="m-5 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0">
                <GripVertical size={18} className="text-blue-600" />
              </div>

              <div>
                <p className="text-sm font-semibold text-blue-900">
                  Reordering categories
                </p>

                <p className="text-sm text-blue-700 mt-1">
                  Drag the categories into the order you want them to appear.
                  Changes are saved automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        {filteredCategories.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center">
              {search ? (
                <Search size={25} className="text-gray-400" />
              ) : (
                <FolderOpen size={25} className="text-gray-400" />
              )}
            </div>

            <h3 className="font-semibold mt-5">
              {search ? "No categories found" : "No categories yet"}
            </h3>

            <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
              {search
                ? "Try a different search term."
                : "Create your first category to start organizing your menu."}
            </p>

            {!search && (
              <button
                type="button"
                onClick={() => {
                  document
                    .querySelector('input[placeholder="Example: Starters"]')
                    ?.focus();
                }}
                className="mt-5 inline-flex items-center gap-2 bg-black text-white px-5 py-3 rounded-xl font-medium hover:bg-gray-800 transition"
              >
                <Plus size={17} />
                Create Category
              </button>
            )}
          </div>
        ) : isReordering ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={categories.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y">
                {categories.map((category, index) => {
                  const dishCount = getDishCount(category.id);
                  return (
                    <SortableCategory key={category.id} category={category}>
                      {(listeners) => (
                        <div className="flex items-center gap-4 p-5 sm:px-6 bg-white">
                          <button
                            type="button"
                            {...listeners}
                            className="w-10 h-10 shrink-0 rounded-xl border border-dashed flex items-center justify-center text-gray-400 hover:text-black hover:bg-gray-50 cursor-grab active:cursor-grabbing touch-none"
                            title="Drag to reorder"
                          >
                            <GripVertical size={20} />
                          </button>

                          <div className="w-7 text-sm text-gray-400 font-medium shrink-0">
                            {index + 1}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate">{category.name}</p>
                            <p className="text-sm text-gray-500 mt-1">
                              {dishCount} {dishCount === 1 ? "dish" : "dishes"}
                            </p>
                          </div>

                          {savingOrder && index === 0 && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <RefreshCw size={14} className="animate-spin" />
                              Saving...
                            </div>
                          )}
                        </div>
                      )}
                    </SortableCategory>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="divide-y">
            {filteredCategories.map((category, index) => {
              const dishCount = getDishCount(category.id);

              return (
                <div
                  key={category.id}
                  className={`p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                    editingId === category.id
                      ? "bg-gray-50"
                      : "hover:bg-gray-50/70"
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                      <GripVertical size={17} />
                    </div>

                    <div className="w-7 text-sm text-gray-400 shrink-0">
                      {index + 1}
                    </div>

                    <div className="min-w-0">
                      <p className="font-semibold truncate">{category.name}</p>

                      <p className="text-sm text-gray-500 mt-1">
                        {dishCount} {dishCount === 1 ? "dish" : "dishes"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => startEditing(category)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-white transition"
                    >
                      <Pencil size={16} />
                      <span className="hidden sm:inline">Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteCategory(category)}
                      disabled={deletingId === category.id || dishCount > 0}
                      title={
                        dishCount > 0
                          ? "Move or delete the dishes in this category first."
                          : "Delete category"
                      }
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      {deletingId === category.id ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}

                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {categories.length > 0 && (
          <div className="px-5 sm:px-6 py-4 bg-gray-50 border-t">
            <button
              type="button"
              onClick={loadCategories}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-black transition"
            >
              <RefreshCw size={15} />
              Refresh categories
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Categories;
