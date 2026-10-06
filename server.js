const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin password hash (SHA-256 of @@Jhon__mosses12345)
const ADMIN_PASSWORD_HASH = 'e008eb4d708ba9ad7df3f0369afa77bf12d0713faa201952e2e93e6f49dd88f2';
// Simple token hash
const ADMIN_TOKEN_SECRET = 'physics-lab-admin-token-2026';

// On Vercel, the local folder is read-only, so use /tmp for runtime DB storage
const IS_VERCEL = !!process.env.VERCEL;
const LOCAL_DB_FILE = path.join(__dirname, 'db.json');
const DB_FILE = IS_VERCEL ? path.join('/tmp', 'db.json') : LOCAL_DB_FILE;

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

// Initialize DB if not exists
function initDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            if (IS_VERCEL && fs.existsSync(LOCAL_DB_FILE)) {
                fs.copyFileSync(LOCAL_DB_FILE, DB_FILE);
            } else {
                const initialData = { groups: [], nextGroupId: 1 };
                fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
            }
        }
    } catch (e) {
        console.error('DB init error:', e);
    }
}

function readDB() {
    initDB();
    try {
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return { groups: [], nextGroupId: 1 };
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('DB write error:', e);
    }
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

// GET all groups (Public API)
app.get(['/api/groups', '/groups'], (req, res) => {
    const db = readDB();
    res.json({ success: true, groups: db.groups, nextGroupId: db.nextGroupId });
});

// Check if a reg no already exists (Public & Admin API)
app.get(['/api/check-reg/:regNo', '/check-reg/:regNo'], (req, res) => {
    const db = readDB();
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
});

// Register a new group/individual (Public API)
app.post(['/api/register', '/register'], (req, res) => {
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
    
    const db = readDB();
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
    writeDB(db);
    
    res.json({ 
        success: true, 
        message: `${groupName} registered successfully!`, 
        group: newGroup 
    });
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

// Admin: Get Raw DB
app.get(['/api/admin/db', '/admin/db'], verifyAdminAuth, (req, res) => {
    const db = readDB();
    res.json({ success: true, data: db });
});

// Admin: Save Raw DB JSON
app.post(['/api/admin/db', '/admin/db'], verifyAdminAuth, (req, res) => {
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

        writeDB(parsed);
        res.json({ success: true, message: 'Database saved successfully!' });
    } catch (e) {
        res.status(400).json({ success: false, message: 'Invalid JSON: ' + e.message });
    }
});

// Admin: Add Group (Bypasses deadline, validates duplicates)
app.post(['/api/admin/group', '/admin/group'], verifyAdminAuth, (req, res) => {
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

    // Check against ALL existing groups in DB
    const db = readDB();
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
    writeDB(db);

    res.json({ success: true, message: `${assignedName} created successfully!`, group: newGroup });
});

// Admin: Edit Group (Validates duplicates across other groups)
app.put(['/api/admin/group/:id', '/admin/group/:id'], verifyAdminAuth, (req, res) => {
    const groupId = parseInt(req.params.id);
    const { groupName, type, members } = req.body;

    const db = readDB();
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

    writeDB(db);
    res.json({ success: true, message: `${group.groupName} updated successfully!`, group });
});

// Admin: Add single member to existing group
app.post(['/api/admin/group/:id/member', '/admin/group/:id/member'], verifyAdminAuth, (req, res) => {
    const groupId = parseInt(req.params.id);
    const { name, regNo, whatsapp, role } = req.body;

    if (!name || !name.trim() || !regNo || !regNo.trim() || !whatsapp || !whatsapp.trim()) {
        return res.status(400).json({ success: false, message: 'Name, Reg No, and WhatsApp No are required.' });
    }

    const cleanRegNo = regNo.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanWhatsapp = whatsapp.trim();

    const db = readDB();
    const group = db.groups.find(g => g.id === groupId);
    if (!group) {
        return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    if (group.members.length >= 5) {
        return res.status(400).json({ success: false, message: 'This group already has the maximum 5 members.' });
    }

    // Check if student exists in any group (including this one)
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
    writeDB(db);

    res.json({ success: true, message: `${cleanName} added to ${group.groupName} successfully!`, group });
});

// Admin: Delete Group
app.delete(['/api/admin/group/:id', '/admin/group/:id'], verifyAdminAuth, (req, res) => {
    const groupId = parseInt(req.params.id);
    const db = readDB();
    const index = db.groups.findIndex(g => g.id === groupId);

    if (index === -1) {
        return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const deleted = db.groups.splice(index, 1);
    writeDB(db);

    res.json({ success: true, message: `${deleted[0].groupName} deleted successfully.` });
});

// Public Delete endpoint (compatibility)
app.delete(['/api/groups/:id', '/groups/:id'], verifyAdminAuth, (req, res) => {
    const groupId = parseInt(req.params.id);
    const db = readDB();
    const index = db.groups.findIndex(g => g.id === groupId);
    if (index === -1) {
        return res.status(404).json({ success: false, message: 'Group not found.' });
    }
    db.groups.splice(index, 1);
    writeDB(db);
    res.json({ success: true, message: 'Group deleted successfully.' });
});

if (require.main === module) {
    initDB();
    app.listen(PORT, () => {
        console.log(`\nPhysics Lab Registration Server is running!`);
        console.log(`Public URL: http://localhost:${PORT}`);
        console.log(`Admin URL:  http://localhost:${PORT}/admin`);
        console.log(`Database:   ${DB_FILE}\n`);
    });
}

module.exports = app;
