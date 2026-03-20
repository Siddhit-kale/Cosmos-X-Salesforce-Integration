const { syncPatientToSalesforce } = require("../shared/salesforceService");

module.exports = async function (context, documents) {
    try {
        // ✅ HARD CHECK
        if (!Array.isArray(documents) || documents.length === 0) {
            context.log("⚠️ No valid patient documents received");
            return;
        }

        context.log(`📥 Received ${documents.length} patient docs`);

        for (const doc of documents) {
            try {
                // ✅ SKIP NULL / INVALID
                if (!doc || typeof doc !== "object") {
                    context.log("⚠️ Skipping null/invalid doc");
                    continue;
                }

                if (!doc.email) {
                    context.log("⚠️ Missing email, skipping:", doc);
                    continue;
                }

                await syncPatientToSalesforce(doc);

                context.log("✅ Patient synced:", doc.email);

            } catch (err) {
                context.log.error("❌ Patient processing error:", err.message);
            }
        }

    } catch (err) {
        context.log.error("❌ Trigger-level error:", err.message);
    }
};