/* ============================================
   PHYSICS LAB ADMIN PORTAL - JAVASCRIPT
   ============================================ */

let adminToken = localStorage.getItem('physics_admin_token') || null;
let currentDb = { groups: [], nextGroupId: 1 };
let editingGroupId = null;

document.addEventListener('DOMContentLoaded', () => {
    if (adminToken) {
        verifyAndInitAdmin();
    } else {
        showLoginOverlay();
    }
});

function showLoginOverlay() {
    document.getElementById('loginOverlay').classList.remove('hidden');
    document.getElementById('adminApp').classList.add('hidden');
}

function hideLoginOverlay() {
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('adminApp').classList.remove('hidden');
}

// ---- Admin Login ----
async function handleLogin(e) {
    e.preventDefault();
    const passwordInput = document.getElementById('adminPassword');
    const password = passwordInput.value.trim();
    const loginBtn = document.getElementById('loginBtn');
    const errorEl = document.getElementById('loginErrorMsg');

    // Reset error styles
    passwordInput.classList.remove('error');
    if (errorEl) {
        errorEl.classList.remove('visible');
        errorEl.textContent = '';
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Verifying...';

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await res.json();
        if (data.success) {
            adminToken = data.token;
            localStorage.setItem('physics_admin_token', adminToken);
            hideLoginOverlay();
            loadAdminData();
            Swal.fire({
                icon: 'success',
                title: 'Welcome, Admin!',
                text: 'Authentication successful.',
                timer: 1500,
                showConfirmButton: false,
                background: '#1a1f35',
                color: '#f1f5f9',
            });
        } else {
            // Wrong Password
            passwordInput.classList.add('error');
            passwordInput.select();
            if (errorEl) {
                errorEl.textContent = '❌ ' + (data.message || 'Incorrect admin password. Please try again.');
                errorEl.classList.add('visible');
            }
            Swal.fire({
                icon: 'error',
                title: 'Access Denied',
                text: data.message || 'Incorrect admin password.',
                background: '#1a1f35',
                color: '#f1f5f9',
            });
        }
    } catch (err) {
        passwordInput.classList.add('error');
        if (errorEl) {
            errorEl.textContent = '❌ Server connection failed. Check your internet or backend status.';
            errorEl.classList.add('visible');
        }
        Swal.fire({
            icon: 'error',
            title: 'Connection Error',
            text: 'Could not communicate with the server: ' + err.message,
            background: '#1a1f35',
            color: '#f1f5f9',
        });
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Unlock Admin Panel';
    }
}

function handleLogout() {
    localStorage.removeItem('physics_admin_token');
    adminToken = null;
    showLoginOverlay();
}

async function verifyAndInitAdmin() {
    try {
        const res = await fetch('/api/admin/db', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.ok) {
            hideLoginOverlay();
            loadAdminData();
        } else {
            handleLogout();
        }
    } catch (e) {
        handleLogout();
    }
}

// ---- Load Admin DB ----
async function loadAdminData() {
    try {
        const res = await fetch('/api/admin/db', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        if (data.success) {
            currentDb = data.data;
            if (data.storage) {
                renderStorageStatus(data.storage);
            }
            renderAdminStats();
            renderAdminGroups();
            renderRawJson();
        }
    } catch (e) {
        console.error('Failed to load admin data:', e);
    }
}

// ---- Storage Status Indicator ----
let currentStorageInfo = null;

function renderStorageStatus(storage) {
    if (!storage) return;
    currentStorageInfo = storage;
    const badge = document.getElementById('storageStatusBadge');
    const banner = document.getElementById('storageWarningBanner');
    if (!badge) return;

    badge.classList.remove('hidden');

    if (storage.isPersistent) {
        badge.className = 'storage-status-pill storage-status-ok';
        badge.innerHTML = `🟢 <span>${storage.name}</span> <small>(Persistent)</small>`;
        if (banner) banner.classList.add('hidden');
    } else if (storage.isVercel) {
        badge.className = 'storage-status-pill storage-status-warn';
        badge.innerHTML = `⚠️ <span>Temporary Storage</span> <small>(Click to Fix)</small>`;
        if (banner) {
            banner.classList.remove('hidden');
            banner.innerHTML = `
                <div class="storage-banner-content">
                    <span class="storage-banner-icon">⚠️</span>
                    <div class="storage-banner-text">
                        <strong>Important: Temporary Serverless Storage Detected!</strong>
                        <p>Your app is on Vercel, which resets local files whenever serverless containers sleep. To prevent submissions from disappearing, connect <strong>Vercel KV</strong> or <strong>Upstash Redis</strong> (Free & 1-minute setup).</p>
                    </div>
                    <button class="storage-banner-btn" onclick="showStorageSetupModal()">How to Fix (1-Min Guide)</button>
                </div>
            `;
        }
    } else {
        badge.className = 'storage-status-pill storage-status-local';
        badge.innerHTML = `💻 <span>Local File System</span>`;
        if (banner) banner.classList.add('hidden');
    }
}

function showStorageSetupModal() {
    Swal.fire({
        title: 'Permanent Database Setup for Vercel',
        html: `
            <div style="text-align: left; font-size: 0.92rem; line-height: 1.6; color: #cbd5e1;">
                <p style="margin-bottom: 12px; color: #f8fafc;">
                    Vercel serverless functions restart periodically. To ensure student registrations are <strong>never lost</strong>, connect a free Cloud KV database in 3 quick steps:
                </p>
                <div style="background: rgba(124, 58, 237, 0.12); border: 1px solid rgba(124, 58, 237, 0.3); border-radius: 10px; padding: 14px; margin-bottom: 14px;">
                    <div style="font-weight: 700; color: #c084fc; margin-bottom: 6px;">⚡ Method 1 (Recommended): 1-Click Vercel KV</div>
                    <ol style="margin: 0; padding-left: 20px;">
                        <li>Open your project on <a href="https://vercel.com/dashboard" target="_blank" style="color: #38bdf8; text-decoration: underline;">vercel.com</a></li>
                        <li>Click the <strong>Storage</strong> tab at the top</li>
                        <li>Click <strong>Create</strong> or <strong>Connect Store</strong> &rarr; Select <strong>KV</strong></li>
                        <li>Click <strong>Create & Connect</strong> (Connects to this project automatically)</li>
                    </ol>
                </div>
                <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; padding: 14px; margin-bottom: 14px;">
                    <div style="font-weight: 700; color: #34d399; margin-bottom: 6px;">✨ Method 2: Free Upstash Redis</div>
                    <ol style="margin: 0; padding-left: 20px;">
                        <li>Sign up at <a href="https://upstash.com" target="_blank" style="color: #38bdf8; text-decoration: underline;">upstash.com</a> (100% free)</li>
                        <li>Create a database &rarr; Scroll down to <strong>REST API</strong></li>
                        <li>Copy <code>UPSTASH_REDIS_REST_URL</code> and <code>UPSTASH_REDIS_REST_TOKEN</code></li>
                        <li>Add them under Vercel &rarr; Settings &rarr; Environment Variables, then redeploy!</li>
                    </ol>
                </div>
                <p style="font-size: 0.85rem; color: #94a3b8; margin: 0;">
                    Once connected, all student registrations will automatically persist forever!
                </p>
            </div>
        `,
        confirmButtonText: 'Got It!',
        background: '#1a1f35',
        color: '#f1f5f9',
        width: 600
    });
}

function renderAdminStats() {
    const groups = currentDb.groups || [];
    let totalStudents = 0;
    groups.forEach(g => {
        totalStudents += (g.members || []).length;
    });

    document.getElementById('statGroupsCount').textContent = groups.length;
    document.getElementById('statStudentsCount').textContent = totalStudents;
    const nextId = currentDb.nextGroupId || (groups.length + 1);
    document.getElementById('statNextId').textContent = `G-${nextId < 10 ? '0' + nextId : nextId}`;
}

function renderAdminGroups() {
    const container = document.getElementById('adminGroupsList');
    const groups = currentDb.groups || [];
    container.innerHTML = '';

    if (groups.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;">No groups created yet. Click "+ Add New Group" to create one.</div>';
        return;
    }

    groups.forEach(group => {
        const card = document.createElement('div');
        card.className = 'admin-group-card';
        const members = group.members || [];
        const isIndiv = group.type === 'individual';
        const isFull = members.length >= 5 || isIndiv;
        const memberCountLabel = isIndiv ? '1 member' : `${members.length}/5 members`;

        let rowsHtml = '';
        let hasLeaderAssigned = false;
        members.forEach(m => {
            const isLeaderRole = m.role === 'Team Leader' || m.role === 'Individual';
            const isLeader = isIndiv || (isLeaderRole && !hasLeaderAssigned);
            if (isLeader) hasLeaderAssigned = true;
            rowsHtml += `
                <tr>
                    <td style="font-weight:600;color:${isLeader ? '#fbbf24' : '#f1f5f9'}">
                        ${isLeader ? '👑 ' : ''}${escapeHtml(m.name)}
                    </td>
                    <td><span class="member-role-tag ${isLeader ? 'leader-tag' : ''}">${isLeader ? 'Leader' : 'Member'}</span></td>
                    <td style="font-family:monospace;color:#94a3b8;">${escapeHtml(m.regNo)}</td>
                    <td style="color:#94a3b8;">${escapeHtml(m.whatsapp)}</td>
                </tr>
            `;
        });

        card.innerHTML = `
            <div class="admin-group-header">
                <div class="admin-group-title">
                    <span>${group.groupName}</span>
                    <span class="group-type-badge ${isIndiv ? 'individual-badge' : 'team-badge'}">${isIndiv ? 'Individual' : 'Team'}</span>
                    <span style="font-size:0.78rem;color:#94a3b8;background:rgba(255,255,255,0.06);padding:2px 8px;border-radius:10px;">${memberCountLabel}</span>
                </div>
                <div class="admin-group-actions">
                    ${isIndiv ? '<span class="badge-full">Individual (1/1)</span>' : (isFull ? '<span class="badge-full">Full (5/5)</span>' : `<button class="admin-btn-accent-sm" onclick="openQuickAddMember(${group.id}, '${escapeHtml(group.groupName)}')">+ Add Student</button>`)}
                    <button class="admin-btn-ghost-sm" onclick="openEditGroupModal(${group.id})">Edit</button>
                    <button class="admin-btn-danger" style="padding:6px 12px;font-size:0.8rem;" onclick="confirmDeleteGroup(${group.id})">Delete</button>
                </div>
            </div>
            <table class="admin-members-table">
                <thead>
                    <tr>
                        <th>Student Name</th>
                        <th>Role</th>
                        <th>Reg No.</th>
                        <th>WhatsApp No.</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        `;
        container.appendChild(card);
    });
}

function renderRawJson() {
    const textarea = document.getElementById('rawJsonTextarea');
    textarea.value = JSON.stringify(currentDb, null, 2);
}

// ---- Tab Switching ----
function switchTab(tab) {
    document.getElementById('tabGroupsBtn').classList.toggle('active', tab === 'groups');
    document.getElementById('tabJsonBtn').classList.toggle('active', tab === 'json');
    document.getElementById('tabGroupsContent').classList.toggle('hidden', tab !== 'groups');
    document.getElementById('tabJsonContent').classList.toggle('hidden', tab !== 'json');

    if (tab === 'json') {
        renderRawJson();
    }
}

// ---- Raw JSON Actions ----
async function saveRawJson() {
    const textarea = document.getElementById('rawJsonTextarea');
    const rawVal = textarea.value.trim();

    try {
        const parsed = JSON.parse(rawVal);
        const res = await fetch('/api/admin/db', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ rawData: parsed })
        });

        const data = await res.json();
        if (data.success) {
            Swal.fire({
                icon: 'success',
                title: 'Saved!',
                text: 'Database updated successfully.',
                background: '#1a1f35',
                color: '#f1f5f9',
            });
            loadAdminData();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: data.message,
                background: '#1a1f35',
                color: '#f1f5f9',
            });
        }
    } catch (e) {
        Swal.fire({
            icon: 'error',
            title: 'Invalid JSON',
            text: e.message,
            background: '#1a1f35',
            color: '#f1f5f9',
        });
    }
}

function copyRawJson() {
    const textarea = document.getElementById('rawJsonTextarea');
    textarea.select();
    navigator.clipboard.writeText(textarea.value);
    Swal.fire({
        icon: 'success',
        title: 'Copied!',
        text: 'JSON copied to clipboard.',
        timer: 1500,
        showConfirmButton: false,
        background: '#1a1f35',
        color: '#f1f5f9',
    });
}

function downloadJsonFile() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentDb, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `physic_lab_db_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

// ============================================
// ADD / EDIT GROUP MODAL (WITH DUPLICATE CHECK)
// ============================================
let checkAdminRegTimeout = null;

function openAddGroupModal() {
    editingGroupId = null;
    document.getElementById('modalTitle').textContent = 'Add New Group (Admin)';
    const nextId = currentDb.nextGroupId || (currentDb.groups.length + 1);
    document.getElementById('modalGroupName').value = `G-${nextId < 10 ? '0' + nextId : nextId}`;
    document.getElementById('modalGroupType').value = 'team';
    document.getElementById('modalGroupId').value = '';

    const container = document.getElementById('modalMembersContainer');
    container.innerHTML = '';
    addModalMemberRow('Team Leader');
    addModalMemberRow('Member');

    updateModalMembersHeader();
    document.getElementById('groupModalOverlay').classList.remove('hidden');
}

function openEditGroupModal(id) {
    editingGroupId = id;
    const group = currentDb.groups.find(g => g.id === id);
    if (!group) return;

    document.getElementById('modalTitle').textContent = `Edit Group (${group.groupName})`;
    document.getElementById('modalGroupName').value = group.groupName;
    document.getElementById('modalGroupType').value = group.type;
    document.getElementById('modalGroupId').value = group.id;

    const container = document.getElementById('modalMembersContainer');
    container.innerHTML = '';

    (group.members || []).forEach(m => {
        addModalMemberRow(m.role, m.name, m.regNo, m.whatsapp);
    });

    updateModalMembersHeader();
    document.getElementById('groupModalOverlay').classList.remove('hidden');
}

function closeGroupModal() {
    document.getElementById('groupModalOverlay').classList.add('hidden');
    editingGroupId = null;
}

function handleModalTypeChange() {
    const type = document.getElementById('modalGroupType').value;
    const container = document.getElementById('modalMembersContainer');
    const cards = container.querySelectorAll('.admin-member-card');

    if (type === 'individual') {
        // Individual: keep exactly 1 member
        if (cards.length > 1) {
            for (let i = 1; i < cards.length; i++) cards[i].remove();
        } else if (cards.length === 0) {
            addModalMemberRow('Team Leader');
        }

        const firstCard = container.querySelector('.admin-member-card');
        if (firstCard) {
            const roleSelect = firstCard.querySelector('.admin-card-role-select');
            if (roleSelect) {
                roleSelect.innerHTML = '<option value="Team Leader" selected style="background-color:#0f172a;color:#ffffff;">Team Leader</option>';
                roleSelect.value = 'Team Leader';
                roleSelect.disabled = true;
            }
            updateModalCardHeader(firstCard);
            const removeBtn = firstCard.querySelector('.admin-card-remove-btn');
            if (removeBtn) removeBtn.style.display = 'none';
        }
    } else {
        // Team mode: allow 2-5 members
        const firstCard = container.querySelector('.admin-member-card');
        if (firstCard) {
            const roleSelect = firstCard.querySelector('.admin-card-role-select');
            if (roleSelect) {
                roleSelect.disabled = false;
                roleSelect.innerHTML = `
                    <option value="Team Leader" selected style="background-color:#0f172a;color:#ffffff;">Team Leader</option>
                    <option value="Member" style="background-color:#0f172a;color:#ffffff;">Member</option>
                `;
                roleSelect.value = 'Team Leader';
            }
            const removeBtn = firstCard.querySelector('.admin-card-remove-btn');
            if (removeBtn) removeBtn.style.display = 'flex';
            updateModalCardHeader(firstCard);
        }
        if (cards.length <= 1) {
            addModalMemberRow('Member');
        }
    }
    updateModalMembersHeader();
}

function addModalMemberRow(role = 'Member', name = '', regNo = '', whatsapp = '') {
    const type = document.getElementById('modalGroupType').value;
    const container = document.getElementById('modalMembersContainer');
    const currentCards = container.querySelectorAll('.admin-member-card');

    if (type === 'individual' && currentCards.length >= 1) {
        Swal.fire({
            icon: 'info',
            title: 'Individual Registration',
            text: 'Individual registration is strictly limited to 1 member.',
            background: '#1a1f35',
            color: '#f1f5f9'
        });
        return;
    }

    if (currentCards.length >= 5) {
        Swal.fire({
            icon: 'warning',
            title: 'Maximum Reached',
            text: 'A team can have a maximum of 5 members.',
            background: '#1a1f35',
            color: '#f1f5f9'
        });
        return;
    }

    const card = document.createElement('div');
    card.className = 'admin-member-card';

    const isIndivType = type === 'individual';
    let effectiveRole = role;
    if (isIndivType) {
        effectiveRole = 'Team Leader';
    } else {
        const hasExistingLeader = Array.from(currentCards).some(c => {
            const s = c.querySelector('.admin-card-role-select');
            return s && s.value === 'Team Leader';
        });
        if (hasExistingLeader && effectiveRole === 'Team Leader') {
            effectiveRole = 'Member';
        } else if (!hasExistingLeader && currentCards.length === 0) {
            effectiveRole = 'Team Leader';
        }
    }

    const isLeader = effectiveRole === 'Team Leader';
    const badgeClass = isLeader ? 'leader' : 'member';
    const badgeText = isLeader ? '👑 Team Leader' : 'Member';

    const roleOptionsHTML = isIndivType ? `
        <option value="Team Leader" selected style="background-color:#0f172a;color:#ffffff;">Team Leader</option>
    ` : `
        <option value="Team Leader" ${isLeader ? 'selected' : ''} style="background-color:#0f172a;color:#ffffff;">Team Leader</option>
        <option value="Member" ${!isLeader ? 'selected' : ''} style="background-color:#0f172a;color:#ffffff;">Member</option>
    `;

    card.innerHTML = `
        <div class="admin-member-card-header">
            <span class="admin-member-role-badge ${badgeClass}">${badgeText}</span>
            <div class="admin-card-actions">
                <select class="admin-card-role-select" onchange="handleCardRoleChange(this)" ${isIndivType ? 'disabled' : ''}>
                    ${roleOptionsHTML}
                </select>
                <button type="button" class="admin-card-remove-btn" onclick="removeModalMember(this)" title="Remove member" style="${isIndivType ? 'display:none;' : ''}">&#10005;</button>
            </div>
        </div>
        <div class="admin-member-grid">
            <div class="admin-input-col">
                <label>Student Full Name *</label>
                <input type="text" name="name" placeholder="e.g. Muhammad Abbas" value="${escapeHtml(name)}" required autocomplete="off">
                <span class="field-error name-error"></span>
            </div>
            <div class="admin-input-col">
                <label>Registration No. *</label>
                <input type="text" name="regNo" placeholder="e.g. 5112326..." value="${escapeHtml(regNo)}" required autocomplete="off" oninput="checkAdminRegNo(this)">
                <span class="field-error reg-error"></span>
            </div>
            <div class="admin-input-col">
                <label>WhatsApp No. *</label>
                <input type="text" name="whatsapp" placeholder="e.g. 03XX-XXXXXXX" value="${escapeHtml(whatsapp)}" required autocomplete="off">
                <span class="field-error whatsapp-error"></span>
            </div>
        </div>
    `;

    container.appendChild(card);
    updateModalMembersHeader();
}

function removeModalMember(btn) {
    const container = document.getElementById('modalMembersContainer');
    const cards = container.querySelectorAll('.admin-member-card');
    if (cards.length <= 1) {
        Swal.fire({
            icon: 'warning',
            title: 'Cannot Remove',
            text: 'A group must contain at least 1 member.',
            background: '#1a1f35',
            color: '#f1f5f9'
        });
        return;
    }
    const card = btn.closest('.admin-member-card');
    const wasLeader = card.querySelector('.admin-card-role-select')?.value === 'Team Leader';
    card.remove();

    // If the removed member was the leader, promote first remaining member to Leader
    if (wasLeader) {
        const remainingCards = container.querySelectorAll('.admin-member-card');
        if (remainingCards.length > 0) {
            const firstRoleSelect = remainingCards[0].querySelector('.admin-card-role-select');
            if (firstRoleSelect) {
                firstRoleSelect.value = 'Team Leader';
                updateModalCardHeader(remainingCards[0]);
            }
        }
    }

    updateModalMembersHeader();
}

function handleCardRoleChange(select) {
    const card = select.closest('.admin-member-card');
    const type = document.getElementById('modalGroupType').value;
    const newRole = select.value;

    // Enforce strictly 1 Team Leader per group: demote others automatically
    if (type === 'team' && newRole === 'Team Leader') {
        const container = document.getElementById('modalMembersContainer');
        const cards = container.querySelectorAll('.admin-member-card');
        cards.forEach(c => {
            if (c !== card) {
                const otherSelect = c.querySelector('.admin-card-role-select');
                if (otherSelect && otherSelect.value === 'Team Leader') {
                    otherSelect.value = 'Member';
                    updateModalCardHeader(c);
                }
            }
        });
    }

    updateModalCardHeader(card);
}

function updateModalCardHeader(card) {
    const type = document.getElementById('modalGroupType').value;
    const role = card.querySelector('.admin-card-role-select').value;
    const badge = card.querySelector('.admin-member-role-badge');
    const isLeader = role === 'Team Leader' || role === 'Individual' || type === 'individual';

    badge.className = `admin-member-role-badge ${isLeader ? 'leader' : 'member'}`;
    badge.textContent = isLeader ? '👑 Team Leader' : 'Member';
}

function updateModalMembersHeader() {
    const type = document.getElementById('modalGroupType').value;
    const container = document.getElementById('modalMembersContainer');
    const cards = container.querySelectorAll('.admin-member-card');
    const count = cards.length;
    const badge = document.getElementById('modalMemberCountBadge');
    const addBtn = document.getElementById('modalAddMemberBtn');

    if (type === 'individual') {
        if (badge) badge.textContent = '1/1 (Individual)';
        if (addBtn) {
            addBtn.disabled = true;
            addBtn.style.display = 'none';
        }
    } else {
        if (badge) badge.textContent = `${count}/5`;
        if (addBtn) {
            addBtn.style.display = 'inline-block';
            addBtn.disabled = count >= 5;
            addBtn.style.opacity = count >= 5 ? '0.5' : '1';
        }
    }
}

// Real-time Reg No verification inside Admin Add/Edit Modal
function checkAdminRegNo(input) {
    clearTimeout(checkAdminRegTimeout);
    const regNo = input.value.trim().toUpperCase();
    const card = input.closest('.admin-member-card');
    const errorEl = card.querySelector('.reg-error');

    if (!regNo) {
        input.classList.remove('error', 'valid');
        card.classList.remove('has-error');
        errorEl.classList.remove('visible', 'success');
        errorEl.textContent = '';
        return;
    }

    // 1. Check duplicate within other cards in the same modal form
    const container = document.getElementById('modalMembersContainer');
    const allRegInputs = container.querySelectorAll('input[name="regNo"]');
    let duplicateInModal = false;

    allRegInputs.forEach(otherInput => {
        if (otherInput !== input && otherInput.value.trim().toUpperCase() === regNo) {
            duplicateInModal = true;
        }
    });

    if (duplicateInModal) {
        input.classList.add('error');
        input.classList.remove('valid');
        card.classList.add('has-error');
        errorEl.innerHTML = '⚠️ Duplicate: Reg No is already entered in another card in this form.';
        errorEl.className = 'field-error reg-error visible';
        return;
    }

    // 2. Check against database (excluding current group if editing)
    checkAdminRegTimeout = setTimeout(async () => {
        try {
            const excludeParam = editingGroupId ? `?excludeGroupId=${editingGroupId}` : '';
            const res = await fetch(`/api/check-reg/${encodeURIComponent(regNo)}${excludeParam}`);
            const data = await res.json();

            if (data.exists) {
                input.classList.add('error');
                input.classList.remove('valid');
                card.classList.add('has-error');
                errorEl.innerHTML = `❌ Already registered in <strong>${escapeHtml(data.groupName)}</strong> (${escapeHtml(data.memberName)}). Cannot add!`;
                errorEl.className = 'field-error reg-error visible';
            } else {
                input.classList.remove('error');
                input.classList.add('valid');
                card.classList.remove('has-error');
                errorEl.innerHTML = '✓ Student Reg No is unique and available';
                errorEl.className = 'field-error reg-error visible success';
            }
        } catch (e) {
            // network error
        }
    }, 300);
}

// Handle Save Group in Admin Modal
async function handleSaveGroup(e) {
    e.preventDefault();
    const groupName = document.getElementById('modalGroupName').value.trim();
    const type = document.getElementById('modalGroupType').value;
    const container = document.getElementById('modalMembersContainer');
    const cards = container.querySelectorAll('.admin-member-card');

    if (type === 'individual') {
        if (cards.length !== 1) {
            Swal.fire({ icon: 'warning', title: 'Individual Limit', text: 'Individual registration must contain exactly 1 member.', background: '#1a1f35', color: '#f1f5f9' });
            return;
        }
    } else {
        if (cards.length < 2 || cards.length > 5) {
            Swal.fire({ icon: 'warning', title: 'Invalid Team Size', text: 'A team must have between 2 and 5 members.', background: '#1a1f35', color: '#f1f5f9' });
            return;
        }
    }

    const members = [];
    let hasValidationError = false;
    let errorMessage = '';

    cards.forEach((card, index) => {
        const nameInput = card.querySelector('input[name="name"]');
        const regInput = card.querySelector('input[name="regNo"]');
        const whatsappInput = card.querySelector('input[name="whatsapp"]');
        const roleSelect = card.querySelector('.admin-card-role-select');

        const name = nameInput.value.trim();
        const regNo = regInput.value.trim().toUpperCase();
        const whatsapp = whatsappInput.value.trim();
        const role = type === 'individual' ? 'Team Leader' : roleSelect.value;

        if (!name || !regNo || !whatsapp) {
            hasValidationError = true;
            errorMessage = 'All fields (Name, Reg No, WhatsApp) are required for every member.';
        }

        if (regInput.classList.contains('error')) {
            hasValidationError = true;
            errorMessage = `Student Reg No "${regNo}" is invalid or already registered in another group!`;
        }

        members.push({ name, regNo, whatsapp, role });
    });

    // Check duplicate regNo within submission
    const regNos = members.map(m => m.regNo);
    const uniqueRegNos = new Set(regNos);
    if (uniqueRegNos.size !== regNos.length) {
        hasValidationError = true;
        errorMessage = 'Duplicate registration numbers detected in this group submission.';
    }

    // Ensure strictly 1 Team Leader per team
    if (type === 'team') {
        const leaderIndices = [];
        members.forEach((m, idx) => {
            if (m.role === 'Team Leader') leaderIndices.push(idx);
        });

        if (leaderIndices.length === 0) {
            members[0].role = 'Team Leader';
        } else if (leaderIndices.length > 1) {
            for (let i = 1; i < leaderIndices.length; i++) {
                members[leaderIndices[i]].role = 'Member';
            }
        }
    }

    if (hasValidationError) {
        Swal.fire({
            icon: 'error',
            title: 'Cannot Save Group',
            text: errorMessage,
            background: '#1a1f35',
            color: '#f1f5f9'
        });
        return;
    }

    const saveBtn = document.getElementById('saveGroupBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        let res;
        if (editingGroupId) {
            res = await fetch(`/api/admin/group/${editingGroupId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify({ groupName, type, members })
            });
        } else {
            res = await fetch('/api/admin/group', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify({ groupName, type, members })
            });
        }

        const data = await res.json();
        if (data.success) {
            closeGroupModal();
            loadAdminData();
            Swal.fire({
                icon: 'success',
                title: 'Saved Successfully!',
                text: data.message,
                timer: 1800,
                showConfirmButton: false,
                background: '#1a1f35',
                color: '#f1f5f9',
            });
        } else {
            Swal.fire({ icon: 'error', title: 'Save Failed', text: data.message, background: '#1a1f35', color: '#f1f5f9' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1a1f35', color: '#f1f5f9' });
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Group';
    }
}

// ============================================
// QUICK ADD SINGLE STUDENT TO AN EXISTING GROUP
// ============================================
let quickAddCheckTimeout = null;

function openQuickAddMember(groupId, groupName) {
    const group = (currentDb.groups || []).find(g => g.id === groupId);
    if (group && (group.members || []).length >= 5) {
        Swal.fire({
            icon: 'info',
            title: 'Group is Full',
            text: `${group.groupName} already has maximum 5 members. Cannot add more.`,
            background: '#1a1f35',
            color: '#f1f5f9'
        });
        return;
    }

    document.getElementById('quickAddGroupId').value = groupId;
    document.getElementById('quickAddModalTitle').textContent = `Add Student to ${groupName}`;
    document.getElementById('quickAddName').value = '';
    document.getElementById('quickAddReg').value = '';
    document.getElementById('quickAddReg').classList.remove('error', 'valid');
    document.getElementById('quickAddRegError').classList.remove('visible', 'success');
    document.getElementById('quickAddRegError').textContent = '';
    document.getElementById('quickAddWhatsapp').value = '';

    const hasLeader = (group?.members || []).some(m => m.role === 'Team Leader');
    const roleSelect = document.getElementById('quickAddRole');
    if (hasLeader) {
        roleSelect.innerHTML = '<option value="Member" selected style="background-color:#0f172a;color:#ffffff;">Member</option>';
        roleSelect.disabled = true;
    } else {
        roleSelect.innerHTML = `
            <option value="Team Leader" selected style="background-color:#0f172a;color:#ffffff;">Team Leader</option>
            <option value="Member" style="background-color:#0f172a;color:#ffffff;">Member</option>
        `;
        roleSelect.disabled = false;
    }

    document.getElementById('quickAddMemberOverlay').classList.remove('hidden');
}

function closeQuickAddMemberModal() {
    document.getElementById('quickAddMemberOverlay').classList.add('hidden');
    document.getElementById('quickAddRole').disabled = false;
}

function checkQuickAddReg(input) {
    clearTimeout(quickAddCheckTimeout);
    const regNo = input.value.trim().toUpperCase();
    const errorEl = document.getElementById('quickAddRegError');

    if (!regNo) {
        input.classList.remove('error', 'valid');
        errorEl.classList.remove('visible', 'success');
        errorEl.textContent = '';
        return;
    }

    quickAddCheckTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`/api/check-reg/${encodeURIComponent(regNo)}`);
            const data = await res.json();
            if (data.exists) {
                input.classList.add('error');
                input.classList.remove('valid');
                errorEl.innerHTML = `❌ Already registered in <strong>${escapeHtml(data.groupName)}</strong> (${escapeHtml(data.memberName)}). Cannot add!`;
                errorEl.className = 'field-error visible';
            } else {
                input.classList.remove('error');
                input.classList.add('valid');
                errorEl.innerHTML = '✓ Reg No is available';
                errorEl.className = 'field-error visible success';
            }
        } catch (e) {
            // network error
        }
    }, 300);
}

async function handleQuickAddMemberSubmit(e) {
    e.preventDefault();
    const groupId = document.getElementById('quickAddGroupId').value;
    const name = document.getElementById('quickAddName').value.trim();
    const regInput = document.getElementById('quickAddReg');
    const regNo = regInput.value.trim().toUpperCase();
    const whatsapp = document.getElementById('quickAddWhatsapp').value.trim();
    const role = document.getElementById('quickAddRole').value;

    if (regInput.classList.contains('error')) {
        Swal.fire({
            icon: 'error',
            title: 'Cannot Add Student',
            text: `Student with Reg No. "${regNo}" is already registered in another group!`,
            background: '#1a1f35',
            color: '#f1f5f9'
        });
        return;
    }

    const btn = document.getElementById('quickAddSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Adding...';

    try {
        const res = await fetch(`/api/admin/group/${groupId}/member`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ name, regNo, whatsapp, role })
        });

        const data = await res.json();
        if (data.success) {
            closeQuickAddMemberModal();
            loadAdminData();
            Swal.fire({
                icon: 'success',
                title: 'Student Added!',
                text: data.message,
                timer: 1800,
                showConfirmButton: false,
                background: '#1a1f35',
                color: '#f1f5f9'
            });
        } else {
            Swal.fire({ icon: 'error', title: 'Failed to Add', text: data.message, background: '#1a1f35', color: '#f1f5f9' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1a1f35', color: '#f1f5f9' });
    } finally {
        btn.disabled = false;
        btn.textContent = 'Add Student';
    }
}

// Delete Group
async function confirmDeleteGroup(id) {
    const result = await Swal.fire({
        title: 'Delete this group?',
        text: 'This action cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Delete',
        cancelButtonText: 'Cancel',
        background: '#1a1f35',
        color: '#f1f5f9',
        confirmButtonColor: '#ef4444'
    });

    if (result.isConfirmed) {
        try {
            const res = await fetch(`/api/admin/group/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            const data = await res.json();
            if (data.success) {
                loadAdminData();
                Swal.fire({ icon: 'success', title: 'Deleted', text: data.message, timer: 1500, showConfirmButton: false, background: '#1a1f35', color: '#f1f5f9' });
            }
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Error', text: e.message, background: '#1a1f35', color: '#f1f5f9' });
        }
    }
}

// ============================================
// PDF GENERATION (Admin side - Exact university layout)
// ============================================
function generateAndDownloadPDF() {
    const groups = currentDb.groups || [];
    if (groups.length === 0) {
        Swal.fire({ icon: 'info', title: 'No Groups', text: 'No groups available to export.', background: '#1a1f35', color: '#f1f5f9' });
        return;
    }

    let totalStudents = 0;
    const tbody = document.getElementById('pdfTableBody');
    tbody.innerHTML = '';

    groups.forEach((group) => {
        const members = group.members || [];
        totalStudents += members.length;
        const rowSpanCount = members.length;

        let hasLeaderAssigned = false;
        members.forEach((member, mIndex) => {
            const tr = document.createElement('tr');
            if (mIndex === 0) {
                const tdGroup = document.createElement('td');
                tdGroup.rowSpan = rowSpanCount;
                tdGroup.className = 'pdf-group-cell';
                tdGroup.textContent = group.groupName;
                tr.appendChild(tdGroup);
            }

            const tdRole = document.createElement('td');
            const isLeaderRole = member.role === 'Team Leader' || member.role === 'Individual';
            const isLeader = group.type === 'individual' || (isLeaderRole && !hasLeaderAssigned);
            if (isLeader) hasLeaderAssigned = true;
            tdRole.className = isLeader ? 'pdf-role-leader' : 'pdf-role-member';
            tdRole.textContent = isLeader ? 'Leader' : 'Member';
            tr.appendChild(tdRole);

            const tdName = document.createElement('td');
            tdName.className = isLeader ? 'pdf-name-leader' : 'pdf-name-member';
            tdName.textContent = member.name;
            tr.appendChild(tdName);

            const tdReg = document.createElement('td');
            tdReg.className = 'pdf-reg-cell';
            tdReg.textContent = member.regNo;
            tr.appendChild(tdReg);

            tbody.appendChild(tr);
        });
    });

    document.getElementById('pdfTotalLine').innerHTML = `<strong>Total: ${totalStudents} students in ${groups.length} groups</strong>`;

    const container = document.getElementById('pdfReportContainer');
    const element = document.getElementById('pdfPage');

    // Temporarily bring into viewport under SweetAlert overlay so html2canvas captures properly
    container.classList.add('pdf-rendering');

    const opt = {
        margin: [8, 8, 8, 8],
        filename: `Physics_Lab_Groups_Official_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            backgroundColor: '#ffffff'
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    Swal.fire({
        title: 'Generating Official PDF...',
        text: 'Preparing official departmental format, please wait...',
        allowOutsideClick: false,
        background: '#1a1f35',
        color: '#f1f5f9',
        didOpen: () => Swal.showLoading()
    });

    html2pdf().set(opt).from(element).save().then(() => {
        container.classList.remove('pdf-rendering');
        Swal.fire({ icon: 'success', title: 'Downloaded!', timer: 2000, showConfirmButton: false, background: '#1a1f35', color: '#f1f5f9' });
    }).catch(err => {
        container.classList.remove('pdf-rendering');
        Swal.fire({ icon: 'error', title: 'PDF Error', text: err.message, background: '#1a1f35', color: '#f1f5f9' });
    });
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
