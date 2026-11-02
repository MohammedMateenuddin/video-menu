import { supabase } from "../lib/supabase";

export async function getCurrentRestaurant() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("User is not logged in");
  }

  // 1. Try finding an assignment in restaurant_users
  try {
    const { data, error } = await supabase
      .from("restaurant_users")
      .select(
        `
        restaurant_id,
        role,
        restaurants (
          id,
          name,
          slug,
          logo_url,
          pdf_menu_url,
          intro_video_url,
          background_music_url,
          description,
          phone,
          address,
          primary_color,
          secondary_color,
          view_count,
          is_active
        )
      `,
      )
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("restaurant_users query warning:", error);
    }

    // If assignment and restaurant found
    if (data?.restaurants) {
      return {
        ...data,
        isAdmin: false,
        user,
      };
    }

    // In case restaurant_id exists but joined restaurants was filtered
    if (data?.restaurant_id) {
      const { data: rest } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", data.restaurant_id)
        .maybeSingle();

      if (rest) {
        return {
          ...data,
          restaurants: rest,
          isAdmin: false,
          user,
        };
      }
    }
  } catch (err) {
    console.warn("Error checking restaurant_users:", err);
  }

  // 2. Check if the logged-in user is an ADMIN
  try {
    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (adminUser) {
      // Admin user can view and manage any restaurant
      const selectedId = localStorage.getItem("admin_selected_restaurant_id");
      let restaurant = null;

      if (selectedId) {
        const { data: rest } = await supabase
          .from("restaurants")
          .select("*")
          .eq("id", selectedId)
          .maybeSingle();
        restaurant = rest;
      }

      if (!restaurant) {
        const { data: rest } = await supabase
          .from("restaurants")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        restaurant = rest;
      }

      if (restaurant) {
        localStorage.setItem("admin_selected_restaurant_id", restaurant.id);
        return {
          restaurant_id: restaurant.id,
          role: "admin",
          isAdmin: true,
          restaurants: restaurant,
          user,
        };
      }

      // Admin has no restaurants created yet
      return {
        restaurant_id: null,
        role: "admin",
        isAdmin: true,
        restaurants: null,
        user,
      };
    }
  } catch (err) {
    console.warn("Error checking admin_users:", err);
  }

  // 3. User is not an admin and has no restaurant assigned in restaurant_users
  console.log("getCurrentRestaurant returned: unassigned user", user.email);
  return {
    restaurant_id: null,
    role: null,
    isAdmin: false,
    restaurants: null,
    unassigned: true,
    user,
  };
}

export async function getAllRestaurantsForAdmin() {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id, name, slug, logo_url, is_active")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching all restaurants for admin:", error);
    return [];
  }

  return data || [];
}

export function setAdminSelectedRestaurant(restaurantId) {
  if (restaurantId) {
    localStorage.setItem("admin_selected_restaurant_id", restaurantId);
  } else {
    localStorage.removeItem("admin_selected_restaurant_id");
  }
}
