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
    throw error;
  }
  
  console.log("getCurrentRestaurant returned:", data);

  return data;
}
