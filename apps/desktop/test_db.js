const Database = require('better-sqlite3');
const db = new Database('C:/Users/ahmad/AppData/Roaming/pharmacypro-desktop/data/pharmacy.db');

try {
    // 1. SELECT the last 5 medicines by id
    const last5 = db.prepare('SELECT id, name FROM medicines ORDER BY id DESC LIMIT 5').all();
    console.log('Last 5 medicines:', JSON.stringify(last5, null, 2));

    // 2. Insert one uniquely named test medicine
    const testName = 'Test Medicine ' + Date.now();
    const info = db.prepare('INSERT INTO medicines (name) VALUES (?)').run(testName);
    console.log('Insert success. Row ID:', info.lastInsertRowid);

    // 3. SELECT it back
    const inserted = db.prepare('SELECT id, name FROM medicines WHERE id = ?').get(info.lastInsertRowid);
    console.log('Inserted row:', JSON.stringify(inserted, null, 2));
} catch (err) {
    if (err.message.includes('NOT NULL constraint failed')) {
        console.log('Initial insert failed due to missing fields. Attempting to inspect table structure...');
        const columns = db.prepare("PRAGMA table_info(medicines)").all();
        console.log('Table structure:', JSON.stringify(columns, null, 2));
    } else {
        console.error('Error:', err.message);
    }
} finally {
    db.close();
}
