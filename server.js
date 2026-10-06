const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin password hash (SHA-256 of @@Jhon__mosses12345)
const ADMIN_PASSWORD_HASH = 'e008eb4d708ba9ad7df3f0369afa77bf12d0713faa201952e2e93e6f49dd88f2';
// Simple token hash
const ADMIN_TOKEN_SECRET = 'physics-lab-admin-token-2026';

// Environment & File paths
const IS_VERCEL = !!process.env.VERCEL;
const LOCAL_DB_FILE = path.join(__dirname, 'db.json');
const DB_FILE = IS_VERCEL ? path.join('/tmp', 'db.json') : LOCAL_DB_FILE;

// Hostinger MySQL Configuration (Defaults pre-configured for instant deployment)
const MYSQL_CONFIG = {
    host: process.env.MYSQL_HOST || 'srv1768.hstgr.io',
    user: process.env.MYSQL_USER || 'u132832831_physic',
    password: process.env.MYSQL_PASSWORD || 'D^g+ng22o',
    database: process.env.MYSQL_DATABASE || 'u132832831_physic',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

let dbPool = null;
try {
    dbPool = mysql.createPool(MYSQL_CONFIG);
} catch (e) {
    console.error('Failed to create MySQL pool:', e.message);
}

// In-memory cache for fast reads and rate-limit avoidance
let memoryCache = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 2000; // 2 seconds cache

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to normalize Vercel serverless rewritten paths
app.use((req, res, next) => {
    const matched = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'];
    if (matched) {
        req.url = matched.split('?')[0];
    } else if (req.query && req.query.__route) {
        req.url = '/api/' + req.query.__route;
    }
    next();
});

// Serve admin page on /admin route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ============================================
// STORAGE & DATABASE LAYER (Hostinger MySQL)
// ============================================

async function ensureMySQLTables() {
    if (!dbPool) return;
    try {
        await dbPool.query(`
            CREATE TABLE IF NOT EXISTS app_groups (
                id INT PRIMARY KEY,
                group_name VARCHAR(50) NOT NULL,
                type VARCHAR(20) NOT NULL,
                registered_at VARCHAR(60) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await dbPool.query(`
            CREATE TABLE IF NOT EXISTS app_members (
                id INT AUTO_INCREMENT PRIMARY KEY,
                group_id INT NOT NULL,
                name VARCHAR(150) NOT NULL,
                reg_no VARCHAR(50) NOT NULL,
                whatsapp VARCHAR(50) NOT NULL,
                role VARCHAR(50) NOT NULL,
                INDEX idx_group (group_id),
                INDEX idx_regno (reg_no),
                FOREIGN KEY (group_id) REFERENCES app_groups(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await dbPool.query(`
            CREATE TABLE IF NOT EXISTS app_meta (
                meta_key VARCHAR(50) PRIMARY KEY,
                meta_value TEXT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
    } catch (err) {
        console.error('MySQL table verification error:', err.message);
    }
}

async function readDBFromMySQL() {
    if (!dbPool) return null;
    const [groupRows] = await dbPool.query('SELECT * FROM app_groups ORDER BY id ASC');
    const [memberRows] = await dbPool.query('SELECT * FROM app_members ORDER BY group_id ASC, id ASC');
    const [metaRows] = await dbPool.query('SELECT meta_value FROM app_meta WHERE meta_key = "nextGroupId"');

    const membersByGroup = {};
    for (const m of memberRows) {
        if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = [];
        membersByGroup[m.group_id].push({
            name: m.name,
            regNo: m.reg_no,
            whatsapp: m.whatsapp,
            role: m.role
        });
    }

    const groups = groupRows.map(g => ({
        id: g.id,
        groupName: g.group_name,
        type: g.type,
        members: membersByGroup[g.id] || [],
        registeredAt: g.registered_at
    }));

    let nextGroupId = metaRows.length > 0 ? parseInt(metaRows[0].meta_value) : null;
    if (!nextGroupId || isNaN(nextGroupId)) {
        const maxId = groups.reduce((max, g) => Math.max(max, g.id), 0);
        nextGroupId = maxId + 1;
    }

    return { groups, nextGroupId };
}

async function writeDBToMySQL(data) {
    if (!dbPool) return false;
    const conn = await dbPool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM app_members');
        await conn.query('DELETE FROM app_groups');

        for (const g of (data.groups || [])) {
            await conn.query(
                'INSERT INTO app_groups (id, group_name, type, registered_at) VALUES (?, ?, ?, ?)',
                [g.id, g.groupName, g.type, g.registeredAt || new Date().toISOString()]
            );
            for (const m of (g.members || [])) {
                await conn.query(
                    'INSERT INTO app_members (group_id, name, reg_no, whatsapp, role) VALUES (?, ?, ?, ?, ?)',
                    [g.id, m.name, m.regNo, m.whatsapp, m.role]
                );
            }
        }

        await conn.query(
            'INSERT INTO app_meta (meta_key, meta_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE meta_value = ?',
            ['nextGroupId', String(data.nextGroupId || 1), String(data.nextGroupId || 1)]
        );

        await conn.commit();
        return true;
    } catch (err) {
        await conn.rollback();
        console.error('MySQL write error:', err.message);
        throw err;
    } finally {
        conn.release();
    }
}

function syncLocalFile(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        // Ignore file errors in read-only filesystems
    }
}

async function readDB() {
    const now = Date.now();
    if (memoryCache && (now - lastCacheTime < CACHE_TTL_MS)) {
        return memoryCache;
    }

    // 1. Primary: Hostinger MySQL Database
    if (dbPool) {
        try {
            const sqlData = await readDBFromMySQL();
            if (sqlData) {
                memoryCache = sqlData;
                lastCacheTime = now;
                syncLocalFile(sqlData);
                return sqlData;
            }
        } catch (err) {
            console.error('MySQL read fallback to local:', err.message);
        }
    }

    // 2. Fallback: Local JSON file
    try {
        if (!fs.existsSync(DB_FILE)) {
            const initialData = { groups: [], nextGroupId: 1 };
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
            return initialData;
        }
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        memoryCache = parsed;
        lastCacheTime = now;
        return parsed;
    } catch (e) {
        return { groups: [], nextGroupId: 1 };
    }
}

async function writeDB(data) {
    memoryCache = data;
    lastCacheTime = Date.now();

    // 1. Write to MySQL
    if (dbPool) {
        try {
            await writeDBToMySQL(data);
        } catch (err) {
            console.error('Failed writing to MySQL:', err.message);
        }
    }

    // 2. Write to local file / /tmp backup
    syncLocalFile(data);
}

function getStorageInfo() {
    if (dbPool) {
        return {
            type: 'mysql',
            name: 'Hostinger MySQL Database',
            isPersistent: true,
            isVercel: IS_VERCEL,
            status: 'connected'
        };
    }
    return {
        type: 'local_file',
        name: IS_VERCEL ? 'Temporary Serverless (/tmp)' : 'Local File System (db.json)',
        isPersistent: !IS_VERCEL,
        isVercel: IS_VERCEL,
        status: IS_VERCEL ? 'warning' : 'local'
    };
}

// Auth Middleware for Admin Routes
function verifyAdminAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please login.' });
    }
    const token = authHeader.replace('Bearer ', '').trim();
    const expectedToken = crypto.createHash('sha256').update(ADMIN_PASSWORD_HASH + ADMIN_TOKEN_SECRET).digest('hex');
    if (token !== expectedToken) {
        return res.status(403).json({ success: false, message: 'Invalid or expired session.' });
    }
    next();
}

// ============================================
// PUBLIC API ROUTES
// ============================================

// GET all groups (Public API)
app.get(['/api/groups', '/groups'], async (req, res) => {
    try {
        const db = await readDB();
        res.json({ success: true, groups: db.groups, nextGroupId: db.nextGroupId });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to read database.' });
    }
});

// Check if a reg no already exists (Public & Admin API)
app.get(['/api/check-reg/:regNo', '/check-reg/:regNo'], async (req, res) => {
    try {
        const db = await readDB();
        const regNo = req.params.regNo.trim().toUpperCase();
        const excludeGroupId = req.query.excludeGroupId ? parseInt(req.query.excludeGroupId) : null;
        
        for (const group of db.groups) {
            if (excludeGroupId && group.id === excludeGroupId) continue;
            for (const member of group.members) {
                if (member.regNo && member.regNo.toUpperCase() === regNo) {
                    return res.json({
                        exists: true,
                        groupName: group.groupName,
                        memberName: member.name
                    });
                }
            }
        }
        
        res.json({ exists: false });
    } catch (err) {
        res.status(500).json({ exists: false, error: err.message });
    }
});

// Register a new group/individual (Public API)
app.post(['/api/register', '/register'], async (req, res) => {
    // Check deadline on backend (7 Oct 2026 09:00:00 PKT / UTC+5)
    const deadline = new Date('2026-10-07T09:00:00+05:00');
    if (new Date() > deadline) {
        return res.status(403).json({ 
            success: false, 
            message: 'Registration deadline has passed. Please contact CR or instructor.' 
        });
    }

    const { type, members } = req.body;
    
    if (!type || !members || !Array.isArray(members) || members.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid data provided.' });
    }
    
    if (type === 'team' && (members.length < 2 || members.length > 5)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Team must have minimum 2 and maximum 5 members.' 
        });
    }
    
    if (type === 'individual' && members.length !== 1) {
        return res.status(400).json({ 
            success: false, 
            message: 'Individual registration must have exactly 1 member.' 
        });
    }
    
    for (const member of members) {
        if (!member.name || !member.regNo || !member.whatsapp) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields (Name, Reg No, WhatsApp No) are required for every member.' 
            });
        }
        member.name = member.name.trim();
        member.regNo = member.regNo.trim().toUpperCase();
        member.whatsapp = member.whatsapp.trim();
    }
    
    const regNos = members.map(m => m.regNo);
    const uniqueRegNos = new Set(regNos);
    if (uniqueRegNos.size !== regNos.length) {
        return res.status(400).json({ 
            success: false, 
            message: 'Duplicate registration numbers found within the submission.' 
        });
    }
    
    try {
        const db = await readDB();
        for (const member of members) {
            for (const group of db.groups) {
                for (const existingMember of group.members) {
                    if (existingMember.regNo === member.regNo) {
                        return res.status(400).json({
                            success: false,
                            message: `Registration number "${member.regNo}" (${member.name}) is already registered in ${group.groupName}. A student cannot be in multiple groups.`
                        });
                    }
                }
            }
        }
        
        const groupId = db.nextGroupId || (db.groups.length + 1);
        const groupName = `G-${groupId < 10 ? '0' + groupId : groupId}`;
        
        const newGroup = {
            id: groupId,
            groupName: groupName,
            type: type,
            members: members.map((m, index) => ({
                ...m,
                role: (type === 'individual' || members.length === 1) ? 'Team Leader' : (index === 0 ? 'Team Leader' : 'Member')
            })),
            registeredAt: new Date().toISOString()
        };
        
        db.groups.push(newGroup);
        db.nextGroupId = groupId + 1;
        await writeDB(db);
        
        res.json({ 
            success: true, 
            message: `${groupName} registered successfully!`, 
            group: newGroup 
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ success: false, message: 'Server error saving registration.' });
    }
});

// ============================================
// ADMIN API ROUTES (Protected)
// ============================================

// Admin Login
app.post(['/api/admin/login', '/admin/login'], (req, res) => {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ success: false, message: 'Password is required.' });
    }

    const inputHash = crypto.createHash('sha256').update(password).digest('hex');
    if (inputHash === ADMIN_PASSWORD_HASH) {
        const token = crypto.createHash('sha256').update(ADMIN_PASSWORD_HASH + ADMIN_TOKEN_SECRET).digest('hex');
        return res.json({ success: true, message: 'Login successful', token });
    } else {
        return res.status(401).json({ success: false, message: 'Invalid admin password.' });
    }
});

// Admin: Storage Status
app.get(['/api/admin/storage-status', '/admin/storage-status'], verifyAdminAuth, (req, res) => {
    res.json({ success: true, storage: getStorageInfo() });
});

// Admin: Get Raw DB
app.get(['/api/admin/db', '/admin/db'], verifyAdminAuth, async (req, res) => {
    try {
        const db = await readDB();
        res.json({ success: true, data: db, storage: getStorageInfo() });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to read database.' });
    }
});

// Admin: Save Raw DB JSON
app.post(['/api/admin/db', '/admin/db'], verifyAdminAuth, async (req, res) => {
    const { rawData } = req.body;
    try {
        let parsed;
        if (typeof rawData === 'string') {
            parsed = JSON.parse(rawData);
        } else {
            parsed = rawData;
        }

        if (!parsed.groups || !Array.isArray(parsed.groups)) {
            return res.status(400).json({ success: false, message: 'Invalid JSON format: missing groups array.' });
        }

        await writeDB(parsed);
        res.json({ success: true, message: 'Database saved successfully!' });
    } catch (e) {
        res.status(400).json({ success: false, message: 'Invalid JSON: ' + e.message });
    }
});

// Admin: Add Group (Bypasses deadline, validates duplicates)
app.post(['/api/admin/group', '/admin/group'], verifyAdminAuth, async (req, res) => {
    const { type, groupName, members } = req.body;
    if (!members || !Array.isArray(members) || members.length === 0) {
        return res.status(400).json({ success: false, message: 'At least 1 member is required.' });
    }

    if (type === 'team' && members.length > 5) {
        return res.status(400).json({ success: false, message: 'A team can have a maximum of 5 members.' });
    }

    // Validate fields and trim
    for (const m of members) {
        if (!m.name || !m.name.trim()) {
            return res.status(400).json({ success: false, message: 'Full Name is required for all members.' });
        }
        if (!m.regNo || !m.regNo.trim()) {
            return res.status(400).json({ success: false, message: 'Registration Number is required for all members.' });
        }
        if (!m.whatsapp || !m.whatsapp.trim()) {
            return res.status(400).json({ success: false, message: 'WhatsApp Number is required for all members.' });
        }
        m.name = m.name.trim();
        m.regNo = m.regNo.trim().toUpperCase();
        m.whatsapp = m.whatsapp.trim();
    }

    // Check duplicate within the submission
    const regNos = members.map(m => m.regNo);
    const uniqueRegNos = new Set(regNos);
    if (uniqueRegNos.size !== regNos.length) {
        return res.status(400).json({ 
            success: false, 
            message: 'Duplicate registration numbers detected in this group submission.' 
        });
    }

    try {
        const db = await readDB();
        for (const member of members) {
            for (const existingGroup of db.groups) {
                for (const existingMember of existingGroup.members) {
                    if (existingMember.regNo && existingMember.regNo.toUpperCase() === member.regNo) {
                        return res.status(400).json({
                            success: false,
                            message: `Student with Reg No. "${member.regNo}" (${member.name}) is already registered in ${existingGroup.groupName}. Cannot add duplicate student!`
                        });
                    }
                }
            }
        }

        const groupId = db.nextGroupId || (db.groups.length + 1);
        const assignedName = groupName ? groupName.trim() : `G-${groupId < 10 ? '0' + groupId : groupId}`;

        let hasLeader = false;
        const mappedMembers = members.map((m, index) => {
            let role = 'Member';
            if (type === 'individual' || members.length === 1) {
                role = 'Team Leader';
            } else if (m.role === 'Team Leader' && !hasLeader) {
                role = 'Team Leader';
                hasLeader = true;
            }
            return {
                name: m.name,
                regNo: m.regNo,
                whatsapp: m.whatsapp,
                role: role
            };
        });
        if (type !== 'individual' && !hasLeader && mappedMembers.length > 0) {
            mappedMembers[0].role = 'Team Leader';
        }

        const newGroup = {
            id: groupId,
            groupName: assignedName,
            type: type || (members.length > 1 ? 'team' : 'individual'),
            members: mappedMembers,
            registeredAt: new Date().toISOString()
        };

        db.groups.push(newGroup);
        db.nextGroupId = groupId + 1;
        await writeDB(db);

        res.json({ success: true, message: `${assignedName} created successfully!`, group: newGroup });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error saving group.' });
    }
});

// Admin: Edit Group (Validates duplicates across other groups)
app.put(['/api/admin/group/:id', '/admin/group/:id'], verifyAdminAuth, async (req, res) => {
    const groupId = parseInt(req.params.id);
    const { groupName, type, members } = req.body;

    try {
        const db = await readDB();
        const group = db.groups.find(g => g.id === groupId);

        if (!group) {
            return res.status(404).json({ success: false, message: 'Group not found.' });
        }

        if (members && Array.isArray(members)) {
            if (members.length === 0) {
                return res.status(400).json({ success: false, message: 'At least 1 member is required.' });
            }
            if (type === 'team' && members.length > 5) {
                return res.status(400).json({ success: false, message: 'A team can have a maximum of 5 members.' });
            }

            // Validate fields and trim
            for (const m of members) {
                if (!m.name || !m.name.trim()) {
                    return res.status(400).json({ success: false, message: 'Full Name is required for all members.' });
                }
                if (!m.regNo || !m.regNo.trim()) {
                    return res.status(400).json({ success: false, message: 'Registration Number is required for all members.' });
                }
                if (!m.whatsapp || !m.whatsapp.trim()) {
                    return res.status(400).json({ success: false, message: 'WhatsApp Number is required for all members.' });
                }
                m.name = m.name.trim();
                m.regNo = m.regNo.trim().toUpperCase();
                m.whatsapp = m.whatsapp.trim();
            }

            // Check duplicate within the submission
            const regNos = members.map(m => m.regNo);
            const uniqueRegNos = new Set(regNos);
            if (uniqueRegNos.size !== regNos.length) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Duplicate registration numbers detected in this group submission.' 
                });
            }

            // Check against OTHER groups in DB (exclude this group itself)
            for (const member of members) {
                for (const otherGroup of db.groups) {
                    if (otherGroup.id === groupId) continue;
                    for (const existingMember of otherGroup.members) {
                        if (existingMember.regNo && existingMember.regNo.toUpperCase() === member.regNo) {
                            return res.status(400).json({
                                success: false,
                                message: `Student with Reg No. "${member.regNo}" (${member.name}) is already registered in ${otherGroup.groupName}. Cannot add duplicate student across groups!`
                            });
                        }
                    }
                }
            }

            let hasLeader = false;
            const mappedMembers = members.map((m, index) => {
                let role = 'Member';
                if (type === 'individual' || members.length === 1) {
                    role = 'Team Leader';
                } else if (m.role === 'Team Leader' && !hasLeader) {
                    role = 'Team Leader';
                    hasLeader = true;
                }
                return {
                    name: m.name,
                    regNo: m.regNo,
                    whatsapp: m.whatsapp,
                    role: role
                };
            });
            if (type !== 'individual' && !hasLeader && mappedMembers.length > 0) {
                mappedMembers[0].role = 'Team Leader';
            }

            group.members = mappedMembers;
        }

        if (groupName) group.groupName = groupName.trim();
        if (type) group.type = type;

        await writeDB(db);
        res.json({ success: true, message: `${group.groupName} updated successfully!`, group });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error updating group.' });
    }
});

// Admin: Add single member to existing group
app.post(['/api/admin/group/:id/member', '/admin/group/:id/member'], verifyAdminAuth, async (req, res) => {
    const groupId = parseInt(req.params.id);
    const { name, regNo, whatsapp, role } = req.body;

    if (!name || !name.trim() || !regNo || !regNo.trim() || !whatsapp || !whatsapp.trim()) {
        return res.status(400).json({ success: false, message: 'Name, Reg No, and WhatsApp No are required.' });
    }

    const cleanRegNo = regNo.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanWhatsapp = whatsapp.trim();

    try {
        const db = await readDB();
        const group = db.groups.find(g => g.id === groupId);
        if (!group) {
            return res.status(404).json({ success: false, message: 'Group not found.' });
        }

        if (group.members.length >= 5) {
            return res.status(400).json({ success: false, message: 'This group already has the maximum 5 members.' });
        }

        for (const g of db.groups) {
            for (const m of g.members) {
                if (m.regNo && m.regNo.toUpperCase() === cleanRegNo) {
                    return res.status(400).json({
                        success: false,
                        message: `Student with Reg No. "${cleanRegNo}" (${m.name}) is already registered in ${g.groupName}. Cannot add duplicate!`
                    });
                }
            }
        }

        const hasLeader = (group.members || []).some(m => m.role === 'Team Leader');
        const assignedRole = (group.type === 'individual') ? 'Team Leader' : (role === 'Team Leader' && !hasLeader ? 'Team Leader' : (hasLeader ? 'Member' : 'Team Leader'));

        const newMember = {
            name: cleanName,
            regNo: cleanRegNo,
            whatsapp: cleanWhatsapp,
            role: assignedRole
        };

        group.members.push(newMember);
        if (group.members.length > 1) {
            group.type = 'team';
        }
        await writeDB(db);

        res.json({ success: true, message: `${cleanName} added to ${group.groupName} successfully!`, group });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error adding member.' });
    }
});

// Admin: Delete Group
app.delete(['/api/admin/group/:id', '/admin/group/:id'], verifyAdminAuth, async (req, res) => {
    const groupId = parseInt(req.params.id);
    try {
        const db = await readDB();
        const index = db.groups.findIndex(g => g.id === groupId);

        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Group not found.' });
        }

        const deleted = db.groups.splice(index, 1);
        await writeDB(db);

        res.json({ success: true, message: `${deleted[0].groupName} deleted successfully.` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error deleting group.' });
    }
});

// Public Delete endpoint (compatibility)
app.delete(['/api/groups/:id', '/groups/:id'], verifyAdminAuth, async (req, res) => {
    const groupId = parseInt(req.params.id);
    try {
        const db = await readDB();
        const index = db.groups.findIndex(g => g.id === groupId);
        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Group not found.' });
        }
        db.groups.splice(index, 1);
        await writeDB(db);
        res.json({ success: true, message: 'Group deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error deleting group.' });
    }
});

if (require.main === module) {
    ensureMySQLTables().then(() => {
        app.listen(PORT, () => {
            const storage = getStorageInfo();
            console.log(`\n==============================================`);
            console.log(`Physics Lab Registration Server is running!`);
            console.log(`Public URL: http://localhost:${PORT}`);
            console.log(`Admin URL:  http://localhost:${PORT}/admin`);
            console.log(`Storage:    ${storage.name} [PERSISTENT]`);
            console.log(`==============================================\n`);
        });
    });
}

module.exports = app;
