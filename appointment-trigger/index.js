const { syncAppointmentToSalesforce } = require("../shared/salesforceService");

module.exports = async function (context, documents) {
    if (!Array.isArray(documents) || documents.length === 0) {
        context.log("⚠️ No appointments received");
        return;
    }

    context.log(`Received ${documents.length} appointments`);

    for (const doc of documents) {
        try {
            if (!doc || !doc.patientEmail) {
                context.log("⚠️ Skipping invalid appointment:", doc);
                continue;
            }

            await syncAppointmentToSalesforce(doc);
            context.log(`✅ Appointment synced: ${doc.id}`);

        } catch (err) {
            context.log.error("❌ Appointment error:", err.message);
        }
    }
};