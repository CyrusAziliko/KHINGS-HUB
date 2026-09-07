import { supabase } from "./supabaseClient.js";


export async function requireAdmin(){

    const {
        data:{
            user
        },
        error
    } = await supabase.auth.getUser();



    // No login session

    if(error || !user){

        window.location.href="./Page.html";

        return false;
    }



    // Get profile

    const {
        data:profile,
        error:profileError

    } = await supabase

    .from("profiles")

    .select(`
        id,
        role,
        full_name,
        avatar_url,
        department,
        position
    `)

    .eq(
        "id",
        user.id
    )

    .single();



    if(profileError || !profile){

        console.error(
            "Profile missing",
            profileError
        );


        window.location.href="./Page.html";

        return false;

    }



    // Role check


    if(profile.role !== "admin"){


        console.warn(
            "Unauthorized admin access"
        );


        window.location.href="./worker-dashboard.html";


        return false;

    }



    // Save admin details

    window.currentAdmin = profile;


    return true;


}

