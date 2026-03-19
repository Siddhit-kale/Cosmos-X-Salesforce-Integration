const { CosmosClient } = require("@azure/cosmos");
const { syncPatientToSalesforce, syncAppointmentToSalesforce } = require("./salesforceService");

module.exports = async function (context, req) {
    context.log("[Sync-Function] Starting Salesforce synchronization process...");

    const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
    const databaseId = "HealthcareCRM";

    if (!connectionString) {
        const errorMsg = "Missing COSMOS_DB_CONNECTION_STRING in local.settings.json.";
        context.log.error(`${errorMsg}`);
        context.res = { status: 500, body: errorMsg };
        return;
    }

    const errors = [];

    try {
        const client = new CosmosClient(connectionString);

        const database = client.database(databaseId);

        let patients = [];
        try {
            const { resources } = await database.container("patients").items.readAll().fetchAll();
            patients = resources;
            context.log(`Found ${patients.length} patients`);

            if (patients.length > 0) {
                context.log(`Sample Patient: ${JSON.stringify(patients[0])}`);
            }

        } catch (e) {
            context.log.warn("Patients fetch error:", e.message);
        }

        let patientsSyncedCount = 0;

        for (const patient of patients) {
            try {
                if (!patient.email) {
                    throw new Error("Missing email (required for External ID)");
                }

                await syncPatientToSalesforce(patient);
                patientsSyncedCount++;

            } catch (err) {
                errors.push({
                    type: "Patient",
                    id: patient.id,
                    error: err.message
                });
            }
        }

        context.log(`Patients synced: ${patientsSyncedCount}`);

        await new Promise(resolve => setTimeout(resolve, 1500));

        let appointments = [];
        try {
            const { resources } = await database.container("appointments").items.readAll().fetchAll();
            appointments = resources;
            context.log(`Found ${appointments.length} appointments`);

            if (appointments.length > 0) {
                context.log(`Sample Appointment: ${JSON.stringify(appointments[0])}`);
            }

        } catch (e) {
            context.log.warn("Appointments fetch error:", e.message);
        }

        let appointmentsSyncedCount = 0;

        for (const appt of appointments) {
            try {
                if (!appt.patientEmail) {
                    throw new Error("Missing patientEmail (required for lookup)");
                }

                await syncAppointmentToSalesforce(appt);
                appointmentsSyncedCount++;

            } catch (err) {
                errors.push({
                    type: "Appointment",
                    id: appt.id,
                    error: err.message
                });
            }
        }

        context.log(`Appointments synced: ${appointmentsSyncedCount}`);

        context.res = {
            status: 200,
            body: {
                message: "Sync process completed.",
                summary: {
                    patientsSynced: patientsSyncedCount,
                    appointmentsSynced: appointmentsSyncedCount,
                    totalErrors: errors.length
                },
                errors: errors.length > 0 ? errors : undefined
            }
        };

    } catch (err) {
        context.log.error("Critical error:", err.message);

        context.res = {
            status: 500,
            body: {
                error: err.message
            }
        };
    }
};