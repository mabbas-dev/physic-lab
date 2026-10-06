const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// On Vercel, the local folder is read-only, so use /tmp for runtime DB storage
const IS_VERCEL = !!process.env.VERCEL;
const LOCAL_DB_FILE = path.join(__dirname, 'db.json');
const DB_FILE = IS_VERCEL ? path.join('/tmp', 'db.json') : LOCAL_DB_FILE;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// GET all groups
app.get('/api/groups', (req, res) => {
    const db = readDB();
    res.json({ success: true, groups: db.groups });
});

// Check if a reg no already exists
app.get('/api/check-reg/:regNo', (req, res) => {
    const db = readDB();
    const regNo = req.params.regNo.trim().toUpperCase();
    
    for (const group of db.groups) {
        for (const member of group.members) {
            if (member.regNo.toUpperCase() === regNo) {
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

// Register a new group/individual
app.post('/api/register', (req, res) => {
    const { type, members } = req.body;
    
    // Validate
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
    
    // Validate each member's fields
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
    
    // Check for duplicate reg numbers within the submission
    const regNos = members.map(m => m.regNo);
    const uniqueRegNos = new Set(regNos);
    if (uniqueRegNos.size !== regNos.length) {
        return res.status(400).json({ 
            success: false, 
            message: 'Duplicate registration numbers found within the submission.' 
        });
    }
    
    // Check if any reg no already exists in the database
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
    
    // Create new group
    const groupId = db.nextGroupId;
    const groupName = `G-${groupId}`;
    
    const newGroup = {
        id: groupId,
        groupName: groupName,
        type: type,
        members: members.map((m, index) => ({
            ...m,
            role: type === 'team' && index === 0 ? 'Team Leader' : (type === 'individual' ? 'Individual' : 'Member')
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

// Delete a group (admin)
app.delete('/api/groups/:id', (req, res) => {
    const db = readDB();
    const groupId = parseInt(req.params.id);
    const index = db.groups.findIndex(g => g.id === groupId);
    
    if (index === -1) {
        return res.status(404).json({ success: false, message: 'Group not found.' });
    }
    
    db.groups.splice(index, 1);
    writeDB(db);
    
    res.json({ success: true, message: 'Group deleted successfully.' });
});

if (require.main === module || !IS_VERCEL) {
    initDB();
    app.listen(PORT, () => {
        console.log(`\nPhysics Lab Registration Server is running!`);
        console.log(`Open in browser: http://localhost:${PORT}`);
        console.log(`Database file: ${DB_FILE}\n`);
    });
}

module.exports = app;
