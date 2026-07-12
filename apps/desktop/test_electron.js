const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');

app.whenReady().then(() => {
    try {
        const dbPath = 'C:/Users/ahmad/AppData/Roaming/pharmacypro-desktop/data/pharmacy.db';
        const db = new Database(dbPath);

        // 1. SELECT the last 5 medicines by id
        const last5 = db.prepare('SELECT id, name FROM medicines ORDER BY id DESC LIMIT 5').all();
        console.log('Last 5 medicines:');
        console.log(JSON.stringify(last5, null, 2));

        // 2. Insert one uniquely named test medicine
        const testName = 'Test Medicine ' + Date.now();
        const info = db.prepare('INSERT INTO medicines (name) VALUES (?)').run(testName);
        console.log('Insert success. Row ID: ' + info.lastInsertRowid);

        // 3. SELECT it back
        const inserted = db.prepare('SELECT id, name FROM medicines WHERE id = ?').get(info.lastInsertRowid);
        console.log('Inserted row:');
        console.log(JSON.stringify(inserted, null, 2));

        db.close();
    } catch (err) {
        console.error('Error:', err.message);
    }
    app.quit();
});
