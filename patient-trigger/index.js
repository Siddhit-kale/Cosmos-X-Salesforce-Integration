const { syncPatientToSalesforce } = require("../shared/salesforceService");

module.exports = async function (context, documents) {
    if (!Array.isArray(documents) || documents.length === 0) {
        context.log("⚠️ No patients received");
        return;
    }

    context.log(`📥 Received ${documents.length} patients`);

    for (const doc of documents) {
        try {
            if (!doc || !doc.email) {
                context.log("⚠️ Skipping invalid patient:", doc);
                continue;
            }

            await syncPatientToSalesforce(doc);
            context.log(`✅ Patient synced: ${doc.email}`);

        } catch (err) {
            context.log.error("❌ Patient error:", err.message);
        }
    }
};