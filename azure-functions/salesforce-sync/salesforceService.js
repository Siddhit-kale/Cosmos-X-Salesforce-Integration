const jsforce = require("jsforce");

let conn = null;

async function authenticate() {
    if (conn && conn.accessToken) return conn;

    const loginUrl = process.env.SALESFORCE_LOGIN_URL;

    const params = new URLSearchParams({
        grant_type: "password",
        client_id: process.env.SALESFORCE_CLIENT_ID,
        client_secret: process.env.SALESFORCE_CLIENT_SECRET,
        username: process.env.SALESFORCE_USERNAME,
        password: process.env.SALESFORCE_PASSWORD + process.env.SALESFORCE_SECURITY_TOKEN
    });

    const res = await fetch(`${loginUrl}/services/oauth2/token`, {
        method: "POST",
        body: params
    });

    const data = await res.json();

    if (!res.ok) {
        console.error("OAuth Error:", data);
        throw new Error(data.error_description);
    }

    conn = new jsforce.Connection({
        instanceUrl: data.instance_url,
        accessToken: data.access_token
    });

    console.log("Salesforce connected");
    return conn;
}

async function uploadFile(connection, base64Data, patientName, recordId, label) {
    try {
        if (!base64Data) return;

        let extension = "pdf"; 
        let cleanBase64 = base64Data;

        const match = base64Data.match(/^data:(.*);base64,/);

        if (match) {
            const mimeType = match[1];

            if (mimeType.includes("jpeg")) extension = "jpg";
            else if (mimeType.includes("png")) extension = "png";
            else if (mimeType.includes("pdf")) extension = "pdf";

            cleanBase64 = base64Data.split("base64,")[1];
        }

        cleanBase64 = cleanBase64.replace(/\s/g, "");

        const buffer = Buffer.from(cleanBase64, "base64");
        const safeBase64 = buffer.toString("base64");

        const fileName = `${patientName}_${label}.${extension}`;

        const result = await connection.sobject("ContentVersion").create({
            Title: fileName,
            PathOnClient: fileName,
            VersionData: safeBase64
        });

        if (!result.success) {
            throw new Error(JSON.stringify(result.errors));
        }

        const file = await connection
            .sobject("ContentVersion")
            .retrieve(result.id);

        const documentId = file.ContentDocumentId;

        await connection.sobject("ContentDocumentLink").create({
            ContentDocumentId: documentId,
            LinkedEntityId: recordId,
            ShareType: "V"
        });

        console.log(`File uploaded: ${fileName}`);

        return documentId;

    } catch (err) {
        console.error("File upload error:", err.message);
        throw err;
    }
}

async function syncPatientToSalesforce(patient) {
    const connection = await authenticate();

    const patientData = {
        Patient_Name__c: patient.name,
        Email__c: patient.email, 
        Phone__c: patient.phone,
        DOB__c: patient.dob || null,
        Age__c: patient.age || null,
        Gender__c: patient.gender || null,
        Blood_Group__c: patient.bloodGroup || null,
        Registration_Date__c: patient.registrationDate || null,
        Patient_Address__c: patient.address || "N/A"
    };

    try {
        const result = await connection
            .sobject("Patient__c")
            .upsert(patientData, "Email__c");

        if (!result.success) {
            throw new Error(JSON.stringify(result.errors));
        }

        const recordId = result.id;

        console.log(`✅ Patient synced: ${patient.email}`);

        if (patient.identityProof) {
            await uploadFile(
                connection,
                patient.identityProof,
                patient.name,
                recordId,
                "IdentityProof"
            );
        }

        if (patient.medicalReport) {
            await uploadFile(
                connection,
                patient.medicalReport,
                patient.name,
                recordId,
                "MedicalReport"
            );
        }

        return result;

    } catch (err) {
        console.error(`Patient error (${patient.email}):`, err.message);
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
        console.error(`Appointment error (${appointment.id}):`, err.message);
        throw err;
    }
}

module.exports = {
    syncPatientToSalesforce,
    syncAppointmentToSalesforce
};