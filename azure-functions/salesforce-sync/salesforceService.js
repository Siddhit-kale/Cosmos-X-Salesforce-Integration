const jsforce = require("jsforce");

let conn = null;

async function authenticate() {
    if (conn && conn.accessToken) return conn;

    const loginUrl = process.env.SALESFORCE_LOGIN_URL || "https://login.salesforce.com";

    const params = new URLSearchParams({
        grant_type: "password",
        client_id: process.env.SALESFORCE_CLIENT_ID,
        client_secret: process.env.SALESFORCE_CLIENT_SECRET,
        username: process.env.SALESFORCE_USERNAME,
        password: process.env.SALESFORCE_PASSWORD + process.env.SALESFORCE_SECURITY_TOKEN
    });

    try {
        const response = await fetch(`${loginUrl}/services/oauth2/token`, {
            method: "POST",
            body: params
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("OAuth Error:", data);
            throw new Error(data.error_description || "OAuth failed");
        }

        conn = new jsforce.Connection({
            instanceUrl: data.instance_url,
            accessToken: data.access_token
        });

        console.log("Salesforce connected via OAuth");
        return conn;

    } catch (err) {
        console.error("Authentication failed:", err.message);
        throw err;
    }
}

async function syncPatientToSalesforce(patient) {
    const connection = await authenticate();

    const patientData = {
        Patient_Name__c: patient.name,
        Email__c: patient.email, // External ID
        Phone__c: patient.phone,
        DOB__c: patient.dob || null,
        Gender__c: patient.gender || null,
        Blood_Group__c: patient.bloodGroup || null,
        Registration_Date__c: patient.registrationDate || null
    };

    try {
        const result = await connection
            .sobject("Patient__c")
            .upsert(patientData, "Email__c");

        if (!result.success) {
            throw new Error(JSON.stringify(result.errors));
        }

        console.log(`Patient synced: ${patient.email}`);
        return result;

    } catch (err) {
        console.error(`Patient sync error (${patient.email}):`, err.message);
        throw err;
    }
}

async function syncAppointmentToSalesforce(appointment) {
    const connection = await authenticate();

    const appointmentData = {
        Appointment_Date__c: appointment.appointmentDate,
        Appointment_Time__c: appointment.appointmentTime || null,
        Status__c: appointment.status || "submitted",
        Symptoms__c: appointment.symptoms || null,

        // 🔥 LOOKUP TO PATIENT USING EMAIL (External ID)
        Patient__r: {
            Email__c: appointment.patientEmail
        }
    };

    try {
        const result = await connection
            .sobject("Appointment__c")
            .create(appointmentData);

        if (!result.success) {
            throw new Error(JSON.stringify(result.errors));
        }

        console.log(`Appointment synced: ${appointment.id}`);
        return result;

    } catch (err) {
        console.error(`Appointment sync error (${appointment.id}):`, err.message);
        throw err;
    }
}

module.exports = {
    syncPatientToSalesforce,
    syncAppointmentToSalesforce
};