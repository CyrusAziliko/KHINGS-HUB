import { supabase } from "../supabaseClient.js";


// ========================================
// Generate Work Order Number
// ========================================

function generateWorkOrderNumber() {

    const year = new Date().getFullYear();

    const random =
        Math.floor(100000 + Math.random() * 900000);

    return `WO-${year}-${random}`;
}



// ========================================
// Get All Work Orders
// ========================================

export async function loadWorkOrders(filters = {}) {

    let query = supabase
        .from("work_orders")
        .select(`
            *,
            equipment (
                name
            ),
            assigned_to (
                full_name,
                department
            ),
            created_by (
                full_name
            )
        `)
        .order(
            "created_at",
            {
                ascending:false
            }
        );


    if(filters.status){

        query = query.eq(
            "status",
            filters.status
        );

    }


    if(filters.priority){

        query = query.eq(
            "priority",
            filters.priority
        );

    }


    const {
        data,
        error
    } = await query;


    if(error){

        console.error(
            "Loading work orders failed:",
            error
        );

        throw error;

    }


    return data;

}



// ========================================
// Create Work Order
// ========================================

export async function loadWorkers(){

    const {
        data,
        error
    } = await supabase
        .from("profiles")
        .select(`
            id,
            full_name,
            department,
            employee_id,
            position
        `)
        .eq(
            "role",
            "worker"
        )
        .eq(
            "status",
            "active"
        )
        .order(
            "full_name",
            {
                ascending:true
            }
        );


    if(error){

        console.error(
            "Loading workers failed:",
            error
        );

        throw error;

    }


    console.log(
        "Workers found:",
        data
    );


    return data;

}



export async function createWorkOrder(workOrder){


    const {
        data:{
            user
        }
    } = await supabase.auth.getUser();


    if(!user){

        throw new Error(
            "No authenticated user found"
        );

    }


    const payload = {

        work_order_number:
            generateWorkOrderNumber(),

        title:
            workOrder.title,

        description:
            workOrder.description,


        category:
            workOrder.category,


        priority:
            workOrder.priority,


        equipment_id:
            workOrder.equipment_id || null,


        assigned_to:
            workOrder.assigned_to || null,


        due_date:
            workOrder.due_date || null,


        created_by:
            user.id

    };



    const {
        data,
        error
    } = await supabase
        .from("work_orders")
        .insert(payload)
        .select()
        .single();



    if(error){

        console.error(
            "Creating work order failed:",
            error
        );

        throw error;

    }


    return data;

}




// ========================================
// Update Status
// ========================================

export async function updateWorkOrderStatus(
    id,
    newStatus
){


    const {
        data,
        error
    } = await supabase
        .from("work_orders")
        .update({

            status:newStatus

        })
        .eq(
            "id",
            id
        )
        .select()
        .single();



    if(error){

        console.error(
            error
        );

        throw error;

    }


    return data;

}





// ========================================
// Assign Worker
// ========================================

export async function assignWorkOrder(
    id,
    workerId
){


    const {
        data,
        error
    } = await supabase
        .from("work_orders")
        .update({

            assigned_to:
                workerId,

            status:
                "Assigned"

        })
        .eq(
            "id",
            id
        )
        .select()
        .single();



    if(error){

        throw error;

    }


    return data;

}




// ========================================
// Delete Work Order
// ========================================

export async function deleteWorkOrder(id){


    const {
        error
    } = await supabase
        .from("work_orders")
        .delete()
        .eq(
            "id",
            id
        );


    if(error){

        throw error;

    }


    return true;

}





// ========================================
// Realtime Subscription
// ========================================

export function subscribeWorkOrders(
    callback
){


    return supabase
        .channel(
            "work-orders-channel"
        )
        .on(
            "postgres_changes",
            {
                event:"*",
                schema:"public",
                table:"work_orders"
            },

            payload=>{

                callback(payload);

            }

        )
        .subscribe();


}
