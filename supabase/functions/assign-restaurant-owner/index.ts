import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  // -----------------------------------------
  // CORS
  // -----------------------------------------
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    // -----------------------------------------
    // METHOD CHECK
    // -----------------------------------------
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Method not allowed",
        }),
        {
          status: 405,
          headers: jsonHeaders,
        },
      );
    }

    // -----------------------------------------
    // AUTHENTICATION
    // -----------------------------------------
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: "Not authenticated",
        }),
        {
          status: 401,
          headers: jsonHeaders,
        },
      );
    }

    // -----------------------------------------
    // CLIENT USING LOGGED-IN USER
    // -----------------------------------------
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    );

    // -----------------------------------------
    // GET CURRENT USER
    // -----------------------------------------
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: "Invalid authentication",
        }),
        {
          status: 401,
          headers: jsonHeaders,
        },
      );
    }

    // -----------------------------------------
    // CHECK ADMIN ACCESS
    // -----------------------------------------
    const { data: adminUser, error: adminError } = await userClient
      .from("admin_users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (adminError) {
      console.error("Admin check error:", adminError);

      return new Response(
        JSON.stringify({
          error: "Unable to verify admin access",
        }),
        {
          status: 500,
          headers: jsonHeaders,
        },
      );
    }

    if (!adminUser) {
      return new Response(
        JSON.stringify({
          error: "Admin access required",
        }),
        {
          status: 403,
          headers: jsonHeaders,
        },
      );
    }

    // -----------------------------------------
    // READ REQUEST BODY
    // -----------------------------------------
    const body = await req.json();

    const { restaurantId, ownerEmail, action = "assign" } = body;

    if (!restaurantId) {
      return new Response(
        JSON.stringify({
          error: "restaurantId is required",
        }),
        {
          status: 400,
          headers: jsonHeaders,
        },
      );
    }

    // -----------------------------------------
    // SERVICE ROLE CLIENT
    // -----------------------------------------
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // -----------------------------------------
    // CHECK RESTAURANT
    // -----------------------------------------
    const { data: restaurant, error: restaurantError } = await serviceClient
      .from("restaurants")
      .select("id, name")
      .eq("id", restaurantId)
      .maybeSingle();

    if (restaurantError) {
      console.error("Restaurant lookup error:", restaurantError);

      return new Response(
        JSON.stringify({
          error: "Failed to find restaurant",
          details: restaurantError.message,
        }),
        {
          status: 500,
          headers: jsonHeaders,
        },
      );
    }

    if (!restaurant) {
      return new Response(
        JSON.stringify({
          error: "Restaurant not found",
        }),
        {
          status: 404,
          headers: jsonHeaders,
        },
      );
    }

    // -----------------------------------------
    // GET CURRENT OWNER
    // -----------------------------------------
    if (action === "get") {
      const { data: existingOwner, error: existingOwnerError } =
        await serviceClient
          .from("restaurant_users")
          .select("id, user_id, role")
          .eq("restaurant_id", restaurantId)
          .eq("role", "owner")
          .maybeSingle();

      if (existingOwnerError) {
        console.error("Current owner lookup error:", existingOwnerError);

        return new Response(
          JSON.stringify({
            error: "Failed to find current owner",
            details: existingOwnerError.message,
          }),
          {
            status: 500,
            headers: jsonHeaders,
          },
        );
      }

      // No owner assigned
      if (!existingOwner) {
        return new Response(
          JSON.stringify({
            success: true,
            owner: null,
          }),
          {
            status: 200,
            headers: jsonHeaders,
          },
        );
      }

      // Continue in Part 2...
      // -----------------------------------------
      // GET OWNER EMAIL FROM SUPABASE AUTH
      // -----------------------------------------
      const { data: ownerUser, error: ownerUserError } =
        await serviceClient.auth.admin.getUserById(existingOwner.user_id);

      if (ownerUserError) {
        console.error("Owner auth lookup error:", ownerUserError);

        return new Response(
          JSON.stringify({
            error: "Failed to retrieve owner information",
            details: ownerUserError.message,
          }),
          {
            status: 500,
            headers: jsonHeaders,
          },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          owner: {
            id: existingOwner.user_id,
            email: ownerUser?.user?.email || null,
            role: existingOwner.role,
          },
        }),
        {
          status: 200,
          headers: jsonHeaders,
        },
      );
    }

    // -----------------------------------------
    // ASSIGN OWNER
    // -----------------------------------------
    if (action !== "assign") {
      return new Response(
        JSON.stringify({
          error: "Invalid action",
        }),
        {
          status: 400,
          headers: jsonHeaders,
        },
      );
    }

    if (!ownerEmail?.trim()) {
      return new Response(
        JSON.stringify({
          error: "ownerEmail is required",
        }),
        {
          status: 400,
          headers: jsonHeaders,
        },
      );
    }

    // -----------------------------------------
    // FIND USER BY EMAIL
    // -----------------------------------------
    const {
      data: { users },
      error: usersError,
    } = await serviceClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (usersError) {
      console.error("User lookup error:", usersError);

      return new Response(
        JSON.stringify({
          error: "Failed to find users",
          details: usersError.message,
        }),
        {
          status: 500,
          headers: jsonHeaders,
        },
      );
    }

    let owner = users.find(
      (u) => u.email?.toLowerCase() === ownerEmail.trim().toLowerCase(),
    );

    if (!owner) {
      // User doesn't exist, create a new one
      const tempPassword = "Welcome123!";
      
      const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
        email: ownerEmail.trim(),
        email_confirm: true,
        password: tempPassword,
      });

      if (createError || !newUser.user) {
        console.error("Create user error:", createError);
        return new Response(
          JSON.stringify({
            error: "Failed to create new user for this email",
            details: createError?.message,
          }),
          {
            status: 500,
            headers: jsonHeaders,
          },
        );
      }

      owner = newUser.user;
      console.log(`Created new user with email ${owner.email}`);
    }

    // -----------------------------------------
    // CHECK EXISTING OWNER
    // -----------------------------------------
    const { data: existingOwner, error: existingOwnerError } =
      await serviceClient
        .from("restaurant_users")
        .select("id, user_id, role")
        .eq("restaurant_id", restaurantId)
        .eq("role", "owner")
        .maybeSingle();

    if (existingOwnerError) {
      console.error("Existing owner lookup error:", existingOwnerError);

      return new Response(
        JSON.stringify({
          error: "Failed to check existing owner",
          details: existingOwnerError.message,
        }),
        {
          status: 500,
          headers: jsonHeaders,
        },
      );
    }

    // -----------------------------------------
    // REMOVE OLD OWNER
    // -----------------------------------------
    if (existingOwner) {
      const { error: removeOwnerError } = await serviceClient
        .from("restaurant_users")
        .delete()
        .eq("id", existingOwner.id);

      if (removeOwnerError) {
        console.error("Remove existing owner error:", removeOwnerError);

        return new Response(
          JSON.stringify({
            error: "Failed to remove existing owner",
            details: removeOwnerError.message,
          }),
          {
            status: 500,
            headers: jsonHeaders,
          },
        );
      }
    }

    // -----------------------------------------
    // CHECK EXISTING USER ASSIGNMENT
    // -----------------------------------------
    const { data: existingAssignment, error: assignmentCheckError } =
      await serviceClient
        .from("restaurant_users")
        .select("id, role")
        .eq("restaurant_id", restaurantId)
        .eq("user_id", owner.id)
        .maybeSingle();

    if (assignmentCheckError) {
      console.error("Assignment check error:", assignmentCheckError);

      return new Response(
        JSON.stringify({
          error: "Failed to check restaurant assignment",
          details: assignmentCheckError.message,
        }),
        {
          status: 500,
          headers: jsonHeaders,
        },
      );
    }

    // -----------------------------------------
    // UPDATE EXISTING ASSIGNMENT
    // -----------------------------------------
    if (existingAssignment) {
      const { error: updateError } = await serviceClient
        .from("restaurant_users")
        .update({
          role: "owner",
        })
        .eq("id", existingAssignment.id);

      if (updateError) {
        console.error("Update owner error:", updateError);

        return new Response(
          JSON.stringify({
            error: "Failed to assign owner",
            details: updateError.message,
          }),
          {
            status: 500,
            headers: jsonHeaders,
          },
        );
      }
    } else {
      // -----------------------------------------
      // CREATE NEW OWNER ASSIGNMENT
      // -----------------------------------------
      const { error: insertError } = await serviceClient
        .from("restaurant_users")
        .insert({
          restaurant_id: restaurantId,
          user_id: owner.id,
          role: "owner",
        });

      if (insertError) {
        console.error("Insert owner error:", insertError);

        return new Response(
          JSON.stringify({
            error: "Failed to assign restaurant owner",
            details: insertError.message,
          }),
          {
            status: 500,
            headers: jsonHeaders,
          },
        );
      }
    }

    // -----------------------------------------
    // SUCCESS
    // -----------------------------------------
    console.log(`Restaurant "${restaurant.name}" assigned to ${owner.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Restaurant owner assigned successfully",
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
        },
        owner: {
          id: owner.id,
          email: owner.email,
        },
      }),
      {
        status: 200,
        headers: jsonHeaders,
      },
    );
  } catch (error) {
    console.error("Assign restaurant owner error:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
