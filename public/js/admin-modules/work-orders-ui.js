import {
    loadWorkOrders,
    loadWorkers,
    createWorkOrder,
    updateWorkOrderStatus,
    assignWorkOrder,
    subscribeWorkOrders
}
from "./work-orders.js";



// =================================
// Initialize Work Orders
// =================================

export async function initWorkOrders(){

    console.log(
        "Work Orders module loading..."
    );


    await populateWorkerDropdown();
    await renderWorkOrders();


    subscribeWorkOrders(()=>{

        renderWorkOrders();

    });


}



// =================================
// Render Table
// =================================

async function renderWorkOrders(){

    const container =
        document.getElementById(
            "work-orders-table"
        );


    if(!container)
        return;



    const orders =
        await loadWorkOrders();



    if(!orders.length){

        container.innerHTML = `

        <div class="empty-state">

            No work orders found

        </div>

        `;

        return;

    }



    container.innerHTML = orders.map(order=>`

        <tr>

            <td>
                ${order.work_order_number}
            </td>


            <td>
                ${order.title}
            </td>


            <td>
                ${order.priority}
            </td>


            <td>
                ${order.status}
            </td>


            <td>
                ${
                order.assigned_to?.full_name
                ||
                "Unassigned"
                }
            </td>


            <td>

                <button
                class="btn-small"
                onclick="
                window.changeWorkOrderStatus(
                '${order.id}',
                'In Progress'
                )
                ">
                Start
                </button>


                <button
                class="btn-small success"
                onclick="
                window.changeWorkOrderStatus(
                '${order.id}',
                'Completed'
                )
                ">
                Complete
                </button>

            </td>


        </tr>


    `).join("");

}



// =================================
// Create Work Order
// =================================

window.createNewWorkOrder =
async function(data){


    await createWorkOrder(data);


    await renderWorkOrders();


};

const modal =
document.getElementById(
"work-order-modal"
);


const openBtn =
document.getElementById(
"open-work-order-modal"
);


const closeBtn =
document.getElementById(
"close-work-order-modal"
);



async function populateWorkerDropdown(){

    const workerSelect =
    document.getElementById(
        "wo-worker"
    );


    if(!workerSelect)
        return;


    const workers =
    await loadWorkers();


    workerSelect.innerHTML = `
        <option value="">
            Select Worker
        </option>
    `;


    workers.forEach(worker=>{

        const option =
        document.createElement(
            "option"
        );

        option.value =
            worker.id;

        option.textContent =
            worker.full_name
            ||
            worker.department
            ||
            "Unnamed Worker";

        workerSelect.appendChild(
            option
        );

    });

}



openBtn?.addEventListener(
"click",
async()=>{

await populateWorkerDropdown();
modal.style.display="flex";

});


closeBtn?.addEventListener(
"click",
()=>{

modal.style.display="none";

});



document
.getElementById(
"work-order-form"
)
?.addEventListener(
"submit",
async(e)=>{


e.preventDefault();



await createWorkOrder({

title:
document.getElementById(
"wo-title"
).value,


description:
document.getElementById(
"wo-description"
).value,


category:
document.getElementById(
"wo-category"
).value,


priority:
document.getElementById(
"wo-priority"
).value,


due_date:
document.getElementById(
"wo-date"
).value,


assigned_to:
document.getElementById(
"wo-worker"
).value
||
null


});



modal.style.display="none";


e.target.reset();


await renderWorkOrders();


});



// =================================
// Update Status
// =================================


window.changeWorkOrderStatus =
async function(
id,
status
){


    await updateWorkOrderStatus(
        id,
        status
    );


    await renderWorkOrders();

};



// =================================
// Assign Worker
// =================================

window.assignWorkerToOrder =
async function(
id,
workerId
){

    await assignWorkOrder(
        id,
        workerId
    );


    await renderWorkOrders();

};
