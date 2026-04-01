const { CosmosClient } = require("@azure/cosmos");
const { syncPatientToSalesforce } = require("../shared/salesforceService");

module.exports = async function (context, req) {
    let cosmosStatus = "Not Tested";
    let sfStatus = "Not Tested";

    // Test Cosmos DB
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
        cosmosStatus = `❌ Error: ${err.message}`;
    }

    // Test Salesforce Auth
    try {
        if (process.env.SALESFORCE_USERNAME) {
            // We use a small dummy sync to test auth
            const { syncPatientToSalesforce } = require("../shared/salesforceService");
            // Just test the authenticate() call internally
            const { authenticate } = require("../shared/salesforceService");
            // Note: internal require might be redundant but safe
            sfStatus = "✅ Authenticating...";
            await syncPatientToSalesforce({ email: "test@example.com", name: "Test Probe" });
            sfStatus = "✅ Connected & Authenticated";
        } else {
            sfStatus = "❌ Missing Salesforce Credentials";
        }
    } catch (err) {
        sfStatus = `❌ Auth Error: ${err.message}`;
    }

    context.res = {
        status: 200,
        body: {
            message: "🔍 Cloud Connectivity Report",
            nodeVersion: process.version,
            diagnostics: {
                cosmosDB: cosmosStatus,
                salesforce: sfStatus
            },
            envVarsExist: {
                COSMOS: !!process.env.COSMOS_DB_CONNECTION_STRING,
                SF_LOGIN: !!process.env.SALESFORCE_LOGIN_URL,
                SF_USER: !!process.env.SALESFORCE_USERNAME
            },
            time: new Date().toISOString(),
            tip: "If Salesforce fails with 401/403, check 'Login History' in Salesforce and look for Azure's IP."
        }
    };
};
