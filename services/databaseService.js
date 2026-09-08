const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create or connect to the database
const dbPath = path.join(__dirname, '../data/deconstruct.db');
const db = new sqlite3.Database(dbPath);

// Create tables if they don't exist
db.serialize(() => {
    // Breakdowns: one row per problem the user submits
    db.run(`CREATE TABLE IF NOT EXISTS breakdowns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        problem TEXT NOT NULL,
        dueDate TEXT,
        dailyMinutes INTEGER DEFAULT 60,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Steps: the smaller problems, each with its routine assignment
    db.run(`CREATE TABLE IF NOT EXISTS task_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        taskId INTEGER NOT NULL,
        stepOrder INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        durationMinutes INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        assignedDay TEXT,
        startTime TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (taskId) REFERENCES breakdowns (id)
    )`);
});

const databaseService = {
    // Save a breakdown and return its id
    saveBreakdown: function(userId, problem, dueDate, dailyMinutes) {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO breakdowns (userId, problem, dueDate, dailyMinutes) VALUES (?, ?, ?, ?)',
                [userId, problem, dueDate || null, dailyMinutes || 60],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },

    // Save all steps for a breakdown (resolved only after every insert completes)
    saveTaskItems: function(taskId, items) {
        return new Promise((resolve, reject) => {
            if (!items || items.length === 0) return resolve([]);

            const stmt = db.prepare(
                'INSERT INTO task_items (taskId, stepOrder, title, description, durationMinutes, status, assignedDay, startTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );

            let pending = items.length;
            let failed = false;
            const ids = [];

            items.forEach(item => {
                stmt.run(
                    [taskId, item.stepOrder, item.title, item.description || '', item.durationMinutes, item.status || 'pending', item.assignedDay || null, item.startTime || null],
                    function(err) {
                        pending -= 1;
                        if (err) {
                            failed = true;
                            reject(err);
                        } else if (!failed) {
                            ids.push(this.lastID);
                            if (pending === 0) resolve(ids);
                        }
                    }
                );
            });

            stmt.finalize();
        });
    },

    // Get all breakdowns for a user, newest first
    getBreakdowns: function(userId) {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM breakdowns WHERE userId = ? ORDER BY createdAt DESC, id DESC', [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    // Get a specific breakdown
    getBreakdown: function(taskId) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM breakdowns WHERE id = ?', [taskId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    // Get the steps of a breakdown, in order
    getTaskItems: function(taskId) {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM task_items WHERE taskId = ? ORDER BY stepOrder ASC', [taskId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    // Mark a single step as done / pending
    updateItemStatus: function(itemId, status) {
        return new Promise((resolve, reject) => {
            db.run('UPDATE task_items SET status = ? WHERE id = ?', [status, itemId], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    },

    // Delete a breakdown and its steps
    deleteBreakdown: function(taskId) {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('DELETE FROM task_items WHERE taskId = ?', [taskId]);
                db.run('DELETE FROM breakdowns WHERE id = ?', [taskId], function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                });
            });
        });
    }
};

module.exports = databaseService;