const { syncAppointmentToSalesforce } = require("../src/salesforceService");

module.exports = async function (context, documents) {
    try {
        if (!Array.isArray(documents) || documents.length === 0) {
            context.log("⚠️ No valid appointment docs");
            return;
        }

        context.log(`📥 Received ${documents.length} appointments`);

        for (const doc of documents) {
            try {
                if (!doc || typeof doc !== "object") {
                    context.log("⚠️ Skipping null doc");
                    continue;
                }

                if (!doc.patientEmail) {
                    context.log("⚠️ Missing patientEmail:", doc);
                    continue;
                }

                await syncAppointmentToSalesforce(doc);

                context.log("✅ Appointment synced:", doc.id);

            } catch (err) {
                context.log.error("❌ Appointment error:", err.message);
            }
        }

    } catch (err) {
        context.log.error("❌ Trigger-level error:", err.message);
    }
};