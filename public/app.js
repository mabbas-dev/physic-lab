/* ============================================
   PHYSICS LAB REGISTRATION - APPLICATION JS
   ============================================ */

const API_BASE = '';
let registrationType = null;
let memberCount = 0;
let currentGroups = [];

// Deadline: 7th October 2026, 9:00 AM PKT (UTC+5)
const DEADLINE = new Date('2026-10-07T09:00:00+05:00');
let isExpired = false;

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    startCountdown();
    loadGroups();
    showWelcomePopup();
});

// ---- Welcome Popup ----
function showWelcomePopup() {
    const overlay = document.getElementById('welcomeOverlay');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeWelcomePopup() {
    const overlay = document.getElementById('welcomeOverlay');
    overlay.classList.add('closing');
    document.body.style.overflow = '';
    setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('closing');
    }, 350);
}

// ---- Countdown Timer ----
function startCountdown() {
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

function updateCountdown() {
    const now = new Date();
    const diff = DEADLINE - now;

    if (diff <= 0) {
        if (!isExpired) {
            isExpired = true;
            onTimeExpired();
        }
        return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    document.getElementById('cdHours').textContent = String(hours).padStart(2, '0');
    document.getElementById('cdMinutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('cdSeconds').textContent = String(seconds).padStart(2, '0');

    const section = document.getElementById('countdownSection');
    if (totalSeconds < 3600) {
        section.classList.add('urgent');
    } else {
        section.classList.remove('urgent');
    }
}

function onTimeExpired() {
    document.getElementById('countdownSection').classList.add('hidden');
    document.getElementById('registrationSection').classList.add('hidden');
    document.getElementById('infoBanner').classList.add('hidden');
    document.getElementById('expiredBanner').classList.remove('hidden');
}

// ---- Background Particles ----
function createParticles() {
    const container = document.getElementById('bgParticles');
    const colors = ['#7c3aed', '#a855f7', '#c084fc', '#f59e0b', '#10b981'];
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        const size = Math.random() * 6 + 3;
        const color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.background = color;
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.animationDuration = `${Math.random() * 20 + 15}s`;
        particle.style.animationDelay = `${Math.random() * 15}s`;
        container.appendChild(particle);
    }
}

// ---- Type Selection ----
function selectType(type) {
    if (isExpired) return;

    registrationType = type;

    document.getElementById('btnIndividual').classList.toggle('active', type === 'individual');
    document.getElementById('btnTeam').classList.toggle('active', type === 'team');

    const form = document.getElementById('registrationForm');
    const typeSelector = document.getElementById('typeSelector');
    const addBtn = document.getElementById('addMemberBtn');

    typeSelector.classList.add('hidden');
    form.classList.remove('hidden');

    if (type === 'individual') {
        document.getElementById('formTitle').textContent = 'Individual Registration';
        addBtn.classList.add('hidden');
        renderMembers(1, false);
    } else {
        document.getElementById('formTitle').textContent = 'Team Registration';
        addBtn.classList.remove('hidden');
        renderMembers(2, true);
    }
}

function goBack() {
    registrationType = null;
    memberCount = 0;
    document.getElementById('typeSelector').classList.remove('hidden');
    document.getElementById('registrationForm').classList.add('hidden');
    document.getElementById('membersContainer').innerHTML = '';
    document.getElementById('btnIndividual').classList.remove('active');
    document.getElementById('btnTeam').classList.remove('active');
}

// ---- Member Rendering ----
function renderMembers(count, isTeam) {
    const container = document.getElementById('membersContainer');
    container.innerHTML = '';
    memberCount = 0;

    for (let i = 0; i < count; i++) {
        addMemberCard(container, i === 0, isTeam);
    }
    updateMemberCountBadge();
    updateAddButton();
}

function addMember() {
    if (memberCount >= 5) return;
    const container = document.getElementById('membersContainer');
    addMemberCard(container, false, true);
    updateMemberCountBadge();
    updateAddButton();

    const cards = container.querySelectorAll('.member-card');
    const lastCard = cards[cards.length - 1];
    lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function addMemberCard(container, isLeader, isTeam) {
    memberCount++;
    const index = memberCount;

    let roleClass, roleLabel;
    if (!isTeam) {
        roleClass = 'leader';
        roleLabel = '👑 Team Leader';
    } else if (isLeader) {
        roleClass = 'leader';
        roleLabel = '👑 Team Leader';
    } else {
        roleClass = 'member-tag';
        roleLabel = 'Member ' + (index - 1);
    }

    const canRemove = isTeam && !isLeader;

    const card = document.createElement('div');
    card.classList.add('member-card');
    card.dataset.index = index;
    card.innerHTML = `
        <div class="member-card-header">
            <span class="member-role ${roleClass}">${roleLabel}</span>
            ${canRemove ? '<button type="button" class="remove-member-btn" onclick="removeMember(this)" title="Remove member">&#10005;</button>' : ''}
        </div>
        <div class="member-fields">
            <div class="field-group full-width">
                <label for="name_${index}">Full Name</label>
                <input type="text" id="name_${index}" name="name" placeholder="e.g. Muhammad Ahmad" required autocomplete="off">
                <span class="field-error" id="name_error_${index}"></span>
            </div>
            <div class="field-group">
                <label for="reg_${index}">Registration No.</label>
                <input type="text" id="reg_${index}" name="regNo" placeholder="e.g. 2024-BSSE-001" required autocomplete="off" oninput="checkRegNo(this, ${index})">
                <span class="field-error" id="reg_error_${index}"></span>
            </div>
            <div class="field-group">
                <label for="whatsapp_${index}">WhatsApp No.</label>
                <input type="text" id="whatsapp_${index}" name="whatsapp" placeholder="e.g. 03XX-XXXXXXX" required autocomplete="off">
                <span class="field-error" id="whatsapp_error_${index}"></span>
            </div>
        </div>
    `;

    container.appendChild(card);
}

function removeMember(btn) {
    if (memberCount <= 2 && registrationType === 'team') {
        Swal.fire({
            icon: 'warning',
            title: 'Cannot Remove',
            text: 'Team must have at least 2 members.',
            confirmButtonText: 'OK',
            background: '#1a1f35',
            color: '#f1f5f9',
        });
        return;
    }
    const card = btn.closest('.member-card');
    card.style.animation = 'fadeOut 0.25s ease forwards';
    setTimeout(() => {
        card.remove();
        memberCount--;
        reindexMembers();
        updateMemberCountBadge();
        updateAddButton();
    }, 250);
}

function reindexMembers() {
    const cards = document.querySelectorAll('#membersContainer .member-card');
    cards.forEach((card, i) => {
        card.dataset.index = i + 1;
        const inputs = card.querySelectorAll('input');
        inputs.forEach(input => {
            const fieldName = input.getAttribute('name');
            input.id = `${fieldName === 'regNo' ? 'reg' : fieldName === 'whatsapp' ? 'whatsapp' : 'name'}_${i + 1}`;
        });
        if (i > 0) {
            const roleSpan = card.querySelector('.member-role');
            if (roleSpan && roleSpan.classList.contains('member-tag')) {
                roleSpan.textContent = 'Member ' + i;
            }
        }
    });
}

function updateMemberCountBadge() {
    const badge = document.getElementById('memberCountBadge');
    badge.textContent = memberCount + '/5';
}

function updateAddButton() {
    const btn = document.getElementById('addMemberBtn');
    btn.disabled = memberCount >= 5;
    if (memberCount >= 5) {
        btn.querySelector('.add-icon').textContent = '\u2713';
        btn.childNodes[1].textContent = ' Maximum reached ';
    } else {
        btn.querySelector('.add-icon').textContent = '+';
        btn.childNodes[1].textContent = ' Add Member ';
    }
}

// ---- Real-time Reg No Check ----
let checkTimeout = null;
function checkRegNo(input, index) {
    clearTimeout(checkTimeout);
    const errorEl = document.getElementById('reg_error_' + index);
    const regNo = input.value.trim();

    if (!regNo) {
        input.classList.remove('error');
        errorEl.classList.remove('visible');
        errorEl.textContent = '';
        return;
    }

    const allRegInputs = document.querySelectorAll('#membersContainer input[name="regNo"]');
    let duplicateInForm = false;
    allRegInputs.forEach(inp => {
        if (inp !== input && inp.value.trim().toUpperCase() === regNo.toUpperCase()) {
            duplicateInForm = true;
        }
    });

    if (duplicateInForm) {
        input.classList.add('error');
        errorEl.textContent = 'This Reg No. is already used above in this form.';
        errorEl.classList.add('visible');
        return;
    }

    checkTimeout = setTimeout(async () => {
        try {
            const res = await fetch(API_BASE + '/api/check-reg/' + encodeURIComponent(regNo));
            const data = await res.json();
            if (data.exists) {
                input.classList.add('error');
                errorEl.textContent = 'Already registered in ' + data.groupName + ' (' + data.memberName + ')';
                errorEl.classList.add('visible');
            } else {
                input.classList.remove('error');
                errorEl.classList.remove('visible');
                errorEl.textContent = '';
            }
        } catch (e) {
            // silently ignore network errors for live check
        }
    }, 400);
}

// ---- Form Submission ----
async function handleSubmit(event) {
    event.preventDefault();

    if (isExpired) {
        Swal.fire({
            icon: 'error',
            title: 'Time\'s Up!',
            text: 'Registration period has ended.',
            background: '#1a1f35',
            color: '#f1f5f9',
        });
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const loader = document.getElementById('submitLoader');
    const submitText = submitBtn.querySelector('.submit-text');

    const cards = document.querySelectorAll('#membersContainer .member-card');
    const members = [];
    let hasError = false;

    cards.forEach((card, i) => {
        const idx = i + 1;
        const nameInput = card.querySelector('input[name="name"]');
        const regInput = card.querySelector('input[name="regNo"]');
        const whatsappInput = card.querySelector('input[name="whatsapp"]');

        const name = nameInput.value.trim();
        const regNo = regInput.value.trim();
        const whatsapp = whatsappInput.value.trim();

        if (!name) {
            nameInput.classList.add('error');
            const errEl = card.querySelector('.field-error');
            if (errEl) { errEl.textContent = 'Name is required.'; errEl.classList.add('visible'); }
            hasError = true;
        } else {
            nameInput.classList.remove('error');
        }

        if (!regNo) {
            regInput.classList.add('error');
            hasError = true;
        } else if (regInput.classList.contains('error')) {
            hasError = true;
        }

        if (!whatsapp) {
            whatsappInput.classList.add('error');
            hasError = true;
        } else {
            whatsappInput.classList.remove('error');
        }

        members.push({ name, regNo, whatsapp });
    });

    if (hasError) {
        Swal.fire({
            icon: 'error',
            title: 'Validation Error',
            text: 'Please fix the errors before submitting.',
            background: '#1a1f35',
            color: '#f1f5f9',
        });
        return;
    }

    submitBtn.disabled = true;
    submitText.textContent = 'Registering...';
    loader.classList.remove('hidden');

    try {
        const res = await fetch(API_BASE + '/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: registrationType,
                members: members
            })
        });

        const data = await res.json();

        if (data.success) {
            goBack();
            loadGroups();

            const memberNames = data.group.members.map(m => m.name).join(', ');
            const typeLabel = data.group.type === 'team' ? 'Team' : 'Individual';

            Swal.fire({
                icon: 'success',
                title: 'Registration Successful!',
                html: `
                    <div style="text-align:center;">
                        <div style="font-size:2.5rem;font-weight:800;background:linear-gradient(135deg,#7c3aed,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:12px 0;">${data.group.groupName}</div>
                        <div style="font-size:0.85rem;color:#94a3b8;margin-bottom:8px;">${typeLabel} Registration</div>
                        <div style="background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.2);border-radius:10px;padding:14px;margin-top:10px;">
                            <div style="font-size:0.8rem;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Members</div>
                            <div style="color:#f1f5f9;font-size:0.92rem;line-height:1.8;">${memberNames}</div>
                        </div>
                    </div>
                `,
                confirmButtonText: 'Awesome!',
                background: '#1a1f35',
                color: '#f1f5f9',
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Registration Failed',
                text: data.message || 'Something went wrong. Please try again.',
                background: '#1a1f35',
                color: '#f1f5f9',
            });
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Network Error',
            text: 'Please check your connection and try again.',
            background: '#1a1f35',
            color: '#f1f5f9',
        });
        console.error('Registration error:', err);
    } finally {
        submitBtn.disabled = false;
        submitText.textContent = 'Register';
        loader.classList.add('hidden');
    }
}

// ---- Load Groups ----
async function loadGroups() {
    try {
        const res = await fetch(API_BASE + '/api/groups');
        const data = await res.json();

        if (data.success) {
            currentGroups = data.groups || [];
            renderGroups(currentGroups);
        }
    } catch (err) {
        console.error('Failed to load groups:', err);
    }
}

const CROWN_SVG = '<svg viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 16h20M2 16L4 6l4 4 4-8 4 8 4-4 2 10" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="rgba(245,158,11,0.2)"/></svg>';

function renderGroups(groups) {
    const grid = document.getElementById('groupsGrid');
    const noGroups = document.getElementById('noGroups');
    const badge = document.getElementById('totalGroupsBadge');

    badge.textContent = groups.length;

    if (groups.length === 0) {
        grid.innerHTML = '';
        noGroups.classList.remove('hidden');
        return;
    }

    noGroups.classList.add('hidden');
    grid.innerHTML = '';

    groups.forEach((group, index) => {
        const card = document.createElement('div');
        card.classList.add('group-card');
        card.style.animationDelay = (index * 0.07) + 's';

        const typeBadge = group.type === 'team'
            ? '<span class="group-type-badge team-badge">Team</span>'
            : '<span class="group-type-badge individual-badge">Individual</span>';

        let membersHTML = '';
        group.members.forEach((member) => {
            const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            
            let avatarClass, roleTag, crownHTML;
            const isLeader = member.role === 'Team Leader' || member.role === 'Individual' || group.type === 'individual';
            if (isLeader) {
                avatarClass = 'leader-avatar';
                roleTag = '<span class="member-role-tag leader-tag">Leader</span>';
                crownHTML = '<div class="crown-icon">' + CROWN_SVG + '</div>';
            } else {
                avatarClass = 'regular-avatar';
                roleTag = '';
                crownHTML = '';
            }

            membersHTML += `
                <div class="group-member-item">
                    <div class="member-avatar ${avatarClass}">
                        ${crownHTML}
                        ${initials}
                    </div>
                    <div class="member-info">
                        <div class="member-name">${escapeHTML(member.name)}</div>
                        <div class="member-reg">${escapeHTML(member.regNo)}</div>
                    </div>
                    ${roleTag}
                </div>
            `;
        });

        card.innerHTML = `
            <div class="group-card-header">
                <span class="group-name">${group.groupName}</span>
                ${typeBadge}
            </div>
            <div class="group-card-body">
                ${membersHTML}
            </div>
        `;

        grid.appendChild(card);
    });
}

// ============================================
// PDF GENERATION (Exact layout from template)
// ============================================
function generateAndDownloadPDF() {
    if (!currentGroups || currentGroups.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'No Groups',
            text: 'There are no registered groups to export to PDF yet.',
            background: '#1a1f35',
            color: '#f1f5f9',
        });
        return;
    }

    let totalStudents = 0;
    const tbody = document.getElementById('pdfTableBody');
    tbody.innerHTML = '';

    currentGroups.forEach((group) => {
        const members = group.members || [];
        totalStudents += members.length;
        const rowSpanCount = members.length;

        members.forEach((member, mIndex) => {
            const tr = document.createElement('tr');
            
            // First cell: Group column with rowspan
            if (mIndex === 0) {
                const tdGroup = document.createElement('td');
                tdGroup.rowSpan = rowSpanCount;
                tdGroup.className = 'pdf-group-cell';
                tdGroup.textContent = group.groupName;
                tr.appendChild(tdGroup);
            }

            // Second cell: Role
            const tdRole = document.createElement('td');
            const isLeader = member.role === 'Team Leader' || member.role === 'Individual' || group.type === 'individual';
            tdRole.className = isLeader ? 'pdf-role-leader' : 'pdf-role-member';
            tdRole.textContent = isLeader ? 'Leader' : 'Member';
            tr.appendChild(tdRole);

            // Third cell: Student Name
            const tdName = document.createElement('td');
            tdName.className = isLeader ? 'pdf-name-leader' : 'pdf-name-member';
            tdName.textContent = member.name;
            tr.appendChild(tdName);

            // Fourth cell: Reg No
            const tdReg = document.createElement('td');
            tdReg.className = 'pdf-reg-cell';
            tdReg.textContent = member.regNo;
            tr.appendChild(tdReg);

            tbody.appendChild(tr);
        });
    });

    document.getElementById('pdfTotalLine').innerHTML = `<strong>Total: ${totalStudents} students in ${currentGroups.length} groups</strong>`;

    const container = document.getElementById('pdfReportContainer');
    const element = document.getElementById('pdfPage');
    
    // Temporarily bring into viewport under SweetAlert overlay so html2canvas renders perfectly
    container.classList.add('pdf-rendering');

    const opt = {
        margin: [8, 8, 8, 8],
        filename: `Physics_Lab_Groups_Fall_2026_${new Date().toISOString().slice(0, 10)}.pdf`,
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

    // Show loading toast
    Swal.fire({
        title: 'Generating Official PDF...',
        text: 'Preparing official departmental format, please wait...',
        allowOutsideClick: false,
        background: '#1a1f35',
        color: '#f1f5f9',
        didOpen: () => {
            Swal.showLoading();
        }
    });

    html2pdf().set(opt).from(element).save().then(() => {
        container.classList.remove('pdf-rendering');
        Swal.fire({
            icon: 'success',
            title: 'PDF Downloaded!',
            text: 'Your official Physics Lab Project Groups PDF has been saved.',
            timer: 2500,
            showConfirmButton: false,
            background: '#1a1f35',
            color: '#f1f5f9',
        });
    }).catch(err => {
        container.classList.remove('pdf-rendering');
        console.error('PDF generation error:', err);
        Swal.fire({
            icon: 'error',
            title: 'PDF Generation Failed',
            text: 'An error occurred while creating the PDF. Please try again.',
            background: '#1a1f35',
            color: '#f1f5f9',
        });
    });
}

// ---- Utility ----
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

const style = document.createElement('style');
style.textContent = '@keyframes fadeOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-10px); } }';
document.head.appendChild(style);
