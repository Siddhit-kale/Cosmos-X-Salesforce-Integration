const jsforce = require("jsforce");
const axios = require("axios");
require('dotenv').config(); 

async function testConnection() {
    console.log("🔍 Starting Standalone Salesforce Test...");

    const config = {
        loginUrl: process.env.SALESFORCE_LOGIN_URL,
        clientId: process.env.SALESFORCE_CLIENT_ID,
        clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
        username: process.env.SALESFORCE_USERNAME,
        password: process.env.SALESFORCE_PASSWORD,
        token: process.env.SALESFORCE_SECURITY_TOKEN
    };

    console.log("Config keys found:", Object.keys(config).filter(k => config[k]));

    try {
        console.log("🔐 Step 1: Requesting OAuth Token...");
        const params = new URLSearchParams({
            grant_type: "password",
            client_id: config.clientId,
            client_secret: config.clientSecret,
            username: config.username,
            password: config.password + (config.token || "")
        });

        const res = await axios.post(`${config.loginUrl}/services/oauth2/token`, params.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });

        console.log("✅ Step 1 Success: Token received.");

        const conn = new jsforce.Connection({
            instanceUrl: res.data.instance_url,
            accessToken: res.data.access_token
        });

        console.log("🔐 Step 2: Testing Object Metadata...");
        try {
            const patientMeta = await conn.sobject("Patient__c").describe();
            console.log("✅ Step 2 Success: Patient__c object found.");
            console.log("Fields found:", patientMeta.fields.map(f => f.name).filter(n => n.endsWith('__c')));
        } catch (e) {
            console.error("❌ Step 2 Failed: Patient__c object error:", e.message);
        }

        try {
            const apptMeta = await conn.sobject("Appointment__c").describe();
            console.log("✅ Step 3 Success: Appointment__c object found.");
            console.log("Fields found:", apptMeta.fields.map(f => f.name).filter(n => n.endsWith('__c')));
        } catch (e) {
            console.error("❌ Step 3 Failed: Appointment__c object error:", e.message);
        }

    } catch (err) {
        console.error("❌ CRITICAL ERROR:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

testConnection();
