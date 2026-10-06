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
    const password = document.getElementById('adminPassword').value;
    const loginBtn = document.getElementById('loginBtn');

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
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Access Denied',
                text: data.message || 'Incorrect admin password.',
                background: '#1a1f35',
                color: '#f1f5f9',
            });
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Connection Error',
            text: 'Could not communicate with the server.',
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
            renderAdminStats();
            renderAdminGroups();
            renderRawJson();
        }
    } catch (e) {
        console.error('Failed to load admin data:', e);
    }
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

        let rowsHtml = '';
        (group.members || []).forEach(m => {
            rowsHtml += `
                <tr>
                    <td style="font-weight:600;color:${m.role === 'Team Leader' ? '#fbbf24' : '#f1f5f9'}">${escapeHtml(m.name)}</td>
                    <td><span class="member-role-tag ${m.role === 'Team Leader' ? 'leader-tag' : ''}">${m.role || 'Member'}</span></td>
                    <td style="font-family:monospace;color:#94a3b8;">${escapeHtml(m.regNo)}</td>
                    <td style="color:#94a3b8;">${escapeHtml(m.whatsapp)}</td>
                </tr>
            `;
        });

        card.innerHTML = `
            <div class="admin-group-header">
                <div class="admin-group-title">
                    <span>${group.groupName}</span>
                    <span class="group-type-badge ${group.type === 'team' ? 'team-badge' : 'individual-badge'}">${group.type}</span>
                </div>
                <div class="admin-group-actions">
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

// ---- Group Modals ----
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

    document.getElementById('groupModalOverlay').classList.remove('hidden');
}

function closeGroupModal() {
    document.getElementById('groupModalOverlay').classList.add('hidden');
}

function handleModalTypeChange() {
    const type = document.getElementById('modalGroupType').value;
    const container = document.getElementById('modalMembersContainer');
    const rows = container.querySelectorAll('.modal-member-row');
    if (type === 'individual' && rows.length > 1) {
        // Keep only 1
        for (let i = 1; i < rows.length; i++) rows[i].remove();
    }
}

function addModalMemberRow(role = 'Member', name = '', regNo = '', whatsapp = '') {
    const container = document.getElementById('modalMembersContainer');
    const row = document.createElement('div');
    row.className = 'modal-member-row';

    row.innerHTML = `
        <input type="text" placeholder="Full Name" value="${escapeHtml(name)}" required>
        <input type="text" placeholder="Reg No." value="${escapeHtml(regNo)}" required>
        <input type="text" placeholder="WhatsApp No." value="${escapeHtml(whatsapp)}" required>
        <select>
            <option value="Team Leader" ${role === 'Team Leader' ? 'selected' : ''}>Team Leader</option>
            <option value="Member" ${role === 'Member' ? 'selected' : ''}>Member</option>
            <option value="Individual" ${role === 'Individual' ? 'selected' : ''}>Individual</option>
        </select>
        <button type="button" class="remove-member-btn" onclick="this.closest('.modal-member-row').remove()">✕</button>
    `;
    container.appendChild(row);
}

async function handleSaveGroup(e) {
    e.preventDefault();
    const groupName = document.getElementById('modalGroupName').value.trim();
    const type = document.getElementById('modalGroupType').value;
    const container = document.getElementById('modalMembersContainer');
    const rows = container.querySelectorAll('.modal-member-row');

    const members = [];
    rows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        const roleSelect = row.querySelector('select');
        members.push({
            name: inputs[0].value.trim(),
            regNo: inputs[1].value.trim().toUpperCase(),
            whatsapp: inputs[2].value.trim(),
            role: roleSelect.value
        });
    });

    if (members.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Empty Group', text: 'Please add at least 1 member.', background: '#1a1f35', color: '#f1f5f9' });
        return;
    }

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
                title: 'Saved',
                text: data.message,
                timer: 1500,
                showConfirmButton: false,
                background: '#1a1f35',
                color: '#f1f5f9',
            });
        } else {
            Swal.fire({ icon: 'error', title: 'Failed', text: data.message, background: '#1a1f35', color: '#f1f5f9' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1a1f35', color: '#f1f5f9' });
    }
}

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

// ---- PDF Generation from Admin ----
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
            const isLeader = member.role === 'Team Leader';
            tdRole.className = isLeader ? 'pdf-role-leader' : 'pdf-role-member';
            tdRole.textContent = isLeader ? 'Leader' : (member.role === 'Individual' ? 'Individual' : 'Member');
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

    const element = document.getElementById('pdfPage');
    const opt = {
        margin: [10, 10, 10, 10],
        filename: `Physics_Lab_Groups_Official_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    Swal.fire({
        title: 'Generating PDF...',
        allowOutsideClick: false,
        background: '#1a1f35',
        color: '#f1f5f9',
        didOpen: () => Swal.showLoading()
    });

    html2pdf().set(opt).from(element).save().then(() => {
        Swal.fire({ icon: 'success', title: 'Downloaded!', timer: 2000, showConfirmButton: false, background: '#1a1f35', color: '#f1f5f9' });
    }).catch(err => {
        Swal.fire({ icon: 'error', title: 'PDF Error', text: err.message, background: '#1a1f35', color: '#f1f5f9' });
    });
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
