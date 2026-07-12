const { app } = require("electron");
const Database = require("better-sqlite3");
const path = require("path");
const os = require("os");

app.whenReady().then(() => {
    const dbPath = path.join(os.homedir(), "AppData/Roaming/pharmacypro-desktop/data/pharmacy.db");
    const db = new Database(dbPath);

    try {
        const data = {
            name: "LogTest LTBrand",
            dosage_form: "Tab",
            strength: "175mg",
            purchase_price: 8,
            selling_price: 18,
            quantity: 18,
            manufacturing_date: "2024-01-01",
            expiry_date: "2027-12-31"
        };

        const keys = Object.keys(data);
        const values = keys.map(k => data[k]);
        const placeholders = keys.map(() => "?").join(", ");
        const sql = `INSERT INTO medicines (${keys.join(", ")}) VALUES (${placeholders})`;
        
        const stmt = db.prepare(sql);
        const result = stmt.run(...values);
        console.log("Insert Success:", result);
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        db.close();
        app.quit();
    }
});
