const Database = require("better-sqlite3");
const path = require("path");
const os = require("os");

const dbPath = path.join(os.homedir(), "AppData/Roaming/pharmacypro-desktop/data/pharmacy.db");
console.log("Database path:", dbPath);

const db = new Database(dbPath);

try {
    const columns = db.prepare("PRAGMA table_info(medicines)").all();
    console.log("Current Columns:", columns.map(c => c.name).join(", "));

    const data = {
        name: "LogTest LTBrand",
        generic_name: "LogTest",
        brand: "LTBrand",
        dosage: "Tab",
        strength: "175mg",
        purchase_price: 8,
        selling_price: 18,
        stock_quantity: 18,
        quantity: 18,
        manufacturing_date: "2024-01-01",
        expiry_date: "2027-12-31"
    };

    const existingColumns = columns.map(c => c.name);
    const keys = Object.keys(data).filter(k => existingColumns.includes(k));
    const values = keys.map(k => data[k]);
    
    const placeholders = keys.map(() => "?").join(", ");
    const sql = `INSERT INTO medicines (${keys.join(", ")}) VALUES (${placeholders})`;
    
    console.log("Executing SQL:", sql);
    const stmt = db.prepare(sql);
    const result = stmt.run(...values);
    console.log("Insert Success:", result);
} catch (err) {
    console.error("Error:", err.message);
} finally {
    db.close();
}
