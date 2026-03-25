const { syncPatientToSalesforce, syncAppointmentToSalesforce } = require("../shared/salesforceService");

module.exports = async function (context, req) {
    context.log("HTTP trigger function processed a manual sync request.");

    if (req.method === "GET") {
        context.res = {
            status: 200,
            body: "✅ Manual Sync Endpoint is ACTIVE. Please POST a JSON body to sync data."
        };
        return;
    }

    let body = req.body;
    if (typeof body === "string") {
        try {
            body = JSON.parse(body);
        } catch (e) {
            context.res = { status: 400, body: "❌ Invalid JSON in request body." };
            return;
        }
    }

    let type = body.type;
    let data = body.data || body;

    if (!type) {
        if (data.patientEmail) type = "appointment";
        else if (data.email) type = "patient";
    }

    if (!type || (Object.keys(data).length === 0 && data.constructor === Object)) {
        context.res = {
            status: 400,
            body: {
                message: "❌ Could not determine sync type or data is empty.",
                receivedBody: body,
                hint: "Ensure you send 'email' for patients or 'patientEmail' for appointments."
            }
        };
        return;
    }

    try {
        if (type === "patient") {
            context.log(`🔄 Syncing patient: ${data.email}`);
            await syncPatientToSalesforce(data);
            context.res = { status: 200, body: { message: "✅ Patient synced successfully", data } };
        } else if (type === "appointment") {
            context.log(`🔄 Syncing appointment: ${data.patientEmail}`);
            await syncAppointmentToSalesforce(data);
            context.res = { status: 200, body: { message: "✅ Appointment synced successfully", data } };
        } else {
            context.res = { status: 400, body: `❌ Invalid sync type: '${type}'.` };
        }
    } catch (err) {
        context.log.error("❌ Sync error:", err.message);
        context.res = { status: 500, body: { message: "❌ Sync failed", error: err.message } };
    }
};
