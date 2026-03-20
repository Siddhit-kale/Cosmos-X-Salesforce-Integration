const jsforce = require("jsforce");

let conn = null;

async function authenticate() {
    if (conn && conn.accessToken) return conn;

    const params = new URLSearchParams({
        grant_type: "password",
        client_id: process.env.SALESFORCE_CLIENT_ID,
        client_secret: process.env.SALESFORCE_CLIENT_SECRET,
        username: process.env.SALESFORCE_USERNAME,
        password: process.env.SALESFORCE_PASSWORD + process.env.SALESFORCE_SECURITY_TOKEN
    });

    const res = await fetch(`${process.env.SALESFORCE_LOGIN_URL}/services/oauth2/token`, {
        method: "POST",
        body: params
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error_description);

    conn = new jsforce.Connection({
        instanceUrl: data.instance_url,
        accessToken: data.access_token
    });

    return conn;
}

async function uploadFile(connection, base64Data, patientName, recordId, label) {
    if (!base64Data) return;

    let extension = "pdf";
    let cleanBase64 = base64Data;

    const match = base64Data.match(/^data:(.*);base64,/);

    if (match) {
        const mime = match[1];
        if (mime.includes("jpeg")) extension = "jpg";
        else if (mime.includes("png")) extension = "png";
        else if (mime.includes("pdf")) extension = "pdf";

        cleanBase64 = base64Data.split("base64,")[1];
    }

    cleanBase64 = cleanBase64.replace(/\s/g, "");

    const buffer = Buffer.from(cleanBase64, "base64");

    const fileName = `${patientName}_${label}.${extension}`;

    const result = await connection.sobject("ContentVersion").create({
        Title: fileName,
        PathOnClient: fileName,
        VersionData: buffer.toString("base64")
    });

    const file = await connection.sobject("ContentVersion").retrieve(result.id);

    await connection.sobject("ContentDocumentLink").create({
        ContentDocumentId: file.ContentDocumentId,
        LinkedEntityId: recordId,
        ShareType: "V"
    });
}

async function syncPatientToSalesforce(patient) {
    const conn = await authenticate();

    const data = {
        Patient_Name__c: patient.name,
        Email__c: patient.email,
        Phone__c: patient.phone,
        DOB__c: patient.dob || null,
        Age__c: patient.age || null,
        Gender__c: patient.gender,
        Blood_Group__c: patient.bloodGroup,
        Registration_Date__c: patient.registrationDate,
        Patient_Address__c: patient.address || "N/A"
    };

    const result = await conn.sobject("Patient__c").upsert(data, "Email__c");

    const id = result.id;

    await uploadFile(conn, patient.identityProof, patient.name, id, "IdentityProof");
    await uploadFile(conn, patient.medicalReport, patient.name, id, "MedicalReport");
}

async function syncAppointmentToSalesforce(appt) {
    const conn = await authenticate();

    await conn.sobject("Appointment__c").create({
        Appointment_Date__c: appt.appointmentDate,
        Appointment_Time__c: appt.appointmentTime,
        Status__c: appt.status,
        Symptoms__c: appt.symptoms,
        Patient__r: {
            Email__c: appt.patientEmail
        }
    });
}

module.exports = {
    syncPatientToSalesforce,
    syncAppointmentToSalesforce
};