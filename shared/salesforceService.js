const jsforce = require("jsforce");
const axios = require("axios");

let conn = null;

async function authenticate() {
    if (conn && conn.accessToken) return conn;

    const env = {
        loginUrl: (process.env.SALESFORCE_LOGIN_URL || "").trim(),
        clientId: (process.env.SALESFORCE_CLIENT_ID || "").trim(),
        clientSecret: (process.env.SALESFORCE_CLIENT_SECRET || "").trim(),
        username: (process.env.SALESFORCE_USERNAME || "").trim(),
        password: (process.env.SALESFORCE_PASSWORD || "").trim(),
        token: (process.env.SALESFORCE_SECURITY_TOKEN || "").trim()
    };

    if (!env.loginUrl) throw new Error("Missing SALESFORCE_LOGIN_URL");
    if (!env.clientId) throw new Error("Missing SALESFORCE_CLIENT_ID");
    if (!env.username) throw new Error("Missing SALESFORCE_USERNAME");

    const sanitizedLoginUrl = env.loginUrl.replace(/\/$/, "");

    console.log(`Attempting Salesforce Auth: ${sanitizedLoginUrl}`);

    try {
        const params = new URLSearchParams({
            grant_type: "password",
            client_id: env.clientId,
            client_secret: env.clientSecret,
            username: env.username,
            password: env.password + env.token
        });

        const res = await axios.post(`${sanitizedLoginUrl}/services/oauth2/token`, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const data = res.data;

        conn = new jsforce.Connection({
            instanceUrl: data.instance_url,
            accessToken: data.access_token
        });

        console.log("Salesforce connected successfully");
        return conn;
    } catch (err) {
        const errorData = err.response ? err.response.data : { message: err.message };
        console.error("OAuth Error detail:", JSON.stringify(errorData));

        const errorDetail = typeof errorData === "string" ? errorData : JSON.stringify(errorData);
        throw new Error(`Authentication failed: ${errorDetail}`);
    }
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

        const links = await connection.query(
            `SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = '${recordId}'`
        );

        if (links.totalSize > 0) {
            const docIds = links.records.map(r => `'${r.ContentDocumentId}'`).join(",");
            const existingFiles = await connection.query(
                `SELECT Id FROM ContentVersion WHERE Title = '${fileName}' AND IsLatest = true AND ContentDocumentId IN (${docIds})`
            );

            if (existingFiles.totalSize > 0) {
                console.log(`ℹFile already exists, skipping upload: ${fileName}`);
                return null;
            }
        }

        const result = await connection.sobject("ContentVersion").create({
            Title: fileName,
            PathOnClient: fileName,
            VersionData: safeBase64
        });

        if (!result.success) {
            throw new Error(`ContentVersion creation failed: ${JSON.stringify(result.errors)}`);
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

    let genderValue = patient.gender || null;
    if (genderValue) {
        genderValue = genderValue.trim();
        const lower = genderValue.toLowerCase();
        if (lower === "male") genderValue = "Male";
        else if (lower === "female") genderValue = "Female";
        else genderValue = "Other";
    }

    const patientData = {
        Patient_Name__c: patient.name,
        Email__c: patient.email,
        Phone__c: patient.phone,
        DOB__c: patient.dob || null,
        Age__c: patient.age || null,
        Gender__c: genderValue,
        Blood_Group__c: patient.bloodGroup || null,
        Registration_Date__c: patient.registrationDate || null,
        Patient_Address__c: patient.address || "N/A"
    };

    try {
        const result = await connection
            .sobject("Patient__c")
            .upsert(patientData, "Email__c");

        if (!result.success) {
            throw new Error(`Patient upsert failed: ${JSON.stringify(result.errors)}`);
        }

        const recordId = result.id;

        console.log(`Patient synced: ${patient.email}`);

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
        console.error(`Patient sync error (${patient.email}):`, err.message);
        throw err;
    }
}

async function syncAppointmentToSalesforce(appointment) {
    const connection = await authenticate();

    let apptTime = appointment.appointmentTime || null;
    if (apptTime && !apptTime.includes("-")) {
        const timeMap = {
            "09:00": "09:00 - 09:30", "09:30": "09:30 - 10:00",
            "10:00": "10:00 - 10:30", "10:30": "10:30 - 11:00",
            "11:00": "11:00 - 11:30", "11:30": "11:30 - 12:00",
            "12:00": "12:00 - 12:30", "14:00": "14:00 - 14:30",
            "14:30": "14:30 - 15:00", "15:00": "15:00 - 15:30",
            "15:30": "15:30 - 16:00", "16:00": "16:00 - 16:30",
            "16:30": "16:30 - 17:00", "17:00": "17:00 - 17:30"
        };
        apptTime = timeMap[apptTime] || apptTime;
    }

    const appointmentData = {
        Appointment_Date__c: appointment.appointmentDate,
        Appointment_Time__c: apptTime,
        Status__c: appointment.status || null,
        Symptoms__c: appointment.symptoms || null,
        Patient__r: {
            Email__c: appointment.patientEmail
        }
    };

    try {
        const existing = await connection.query(
            `SELECT Id FROM Appointment__c WHERE Appointment_Date__c = ${appointment.appointmentDate} AND Appointment_Time__c = '${apptTime}' AND Patient__r.Email__c = '${appointment.patientEmail}'`
        );

        if (existing.totalSize > 0) {
            const recordId = existing.records[0].Id;
            const result = await connection
                .sobject("Appointment__c")
                .update({
                    Id: recordId,
                    Status__c: appointment.status || null,
                    Symptoms__c: appointment.symptoms || null
                });

            if (!result.success) {
                throw new Error(`Appointment update failed: ${JSON.stringify(result.errors)}`);
            }

            console.log(`Appointment updated: ${recordId}`);
            return result;
        } else {
            const result = await connection
                .sobject("Appointment__c")
                .create(appointmentData);

            if (!result.success) {
                throw new Error(`Appointment setup failed: ${JSON.stringify(result.errors)}`);
            }

            console.log(`Appointment created: ${appointment.id || appointment.patientEmail}`);
            return result;
        }

    } catch (err) {
        console.error(`Appointment sync error:`, err.message);
        throw err;
    }
}

module.exports = {
    syncPatientToSalesforce,
    syncAppointmentToSalesforce
};