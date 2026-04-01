module.exports = async function (context, req) {
    let cosmosStatus = "Not Tested";
    let sfStatus = "Not Tested";
    let loadErrors = [];

    // 1. Test Module Loading
    let CosmosClient, salesforceService;
    try {
        CosmosClient = require("@azure/cosmos").CosmosClient;
    } catch (e) {
        loadErrors.push(`@azure/cosmos: ${e.message}`);
    }

    try {
        salesforceService = require("../shared/salesforceService");
    } catch (e) {
        loadErrors.push(`shared/salesforceService (or axios): ${e.message}`);
    }

    // 2. Test Cosmos DB
    if (CosmosClient) {
        try {
            const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
            if (connectionString) {
                const client = new CosmosClient(connectionString);
                const { resources } = await client.database("HealthcareCRM").container("patients").items.query("SELECT TOP 1 * FROM c").fetchAll();
                cosmosStatus = `✅ Connected (Found ${resources.length} records)`;
            } else {
                cosmosStatus = "❌ Missing Connection String";
            }
        } catch (err) {
            cosmosStatus = `❌ Runtime Error: ${err.message}`;
        }
    } else {
        cosmosStatus = "❌ Module Failed to Load";
    }

    // 3. Test Salesforce
    if (salesforceService) {
        try {
            if (process.env.SALESFORCE_USERNAME) {
                await salesforceService.syncPatientToSalesforce({ email: "test@example.com", name: "Test Probe" });
                sfStatus = "✅ Connected & Authenticated";
            } else {
                sfStatus = "❌ Missing Salesforce Credentials";
            }
        } catch (err) {
            sfStatus = `❌ Auth Error: ${err.message}`;
        }
    } else {
        sfStatus = "❌ Module Failed to Load";
    }

    context.res = {
        status: 200,
        body: {
            message: "🔍 Isolated Cloud Connectivity Report",
            nodeVersion: process.version,
            loadErrors: loadErrors.length > 0 ? loadErrors : "None",
            diagnostics: {
                cosmosDB: cosmosStatus,
                salesforce: sfStatus
            },
            time: new Date().toISOString()
        }
    };
};
