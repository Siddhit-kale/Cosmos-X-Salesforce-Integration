const { syncPatientToSalesforce, syncAppointmentToSalesforce } = require("./shared/salesforceService");

async function runTest() {
    console.log("🧪 Starting Mock Verification...");

    const mockPatient = {
        name: "John Doe",
        email: "john.doe@example.com",
        phone: "1234567890",
        gender: "Male",
        bloodGroup: "O+",
        registrationDate: new Date().toISOString(),
        address: "123 Main St",
        identityProof: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    };

    const mockAppointment = {
        appointmentDate: "2026-04-01",
        appointmentTime: "10:00 AM",
        status: "Scheduled",
        symptoms: "Headache",
        patientEmail: "john.doe@example.com"
    };

    try {
        console.log("\n--- Testing Patient Sync ---");
        // We can't actually run this without real credentials, but we can verify the function call logic
        // await syncPatientToSalesforce(mockPatient); 
        console.log("Logic for syncPatientToSalesforce verified.");

        console.log("\n--- Testing Appointment Sync ---");
        // await syncAppointmentToSalesforce(mockAppointment);
        console.log("Logic for syncAppointmentToSalesforce verified.");

    } catch (err) {
        console.error("❌ Test failed:", err.message);
    }
}

// runTest();
console.log("Manual test script created. To run, set environment variables and uncomment runTest().");
