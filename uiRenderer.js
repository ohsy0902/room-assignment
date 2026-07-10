// ===== UI Rendering Module =====

function renderFloorSelection(dormitoryKey) {
    const container = document.getElementById('floorSelection');
    container.innerHTML = '';

    const dormConfig = DORM_CONFIG[dormitoryKey];
    const floors = Object.keys(dormConfig.floors);

    for (const floorNum of floors) {
        const btn = document.createElement('button');
        btn.className = 'floor-btn';
        btn.dataset.floor = floorNum;
        btn.textContent = `${floorNum}층`;

        if (floorNum === AppState.currentFloor || (AppState.currentFloor === null && floorNum === floors[0])) {
            btn.classList.add('active');
            if (AppState.currentFloor === null) {
                AppState.currentFloor = floorNum;
            }
        }

        container.appendChild(btn);
    }
}

function renderRoomGrid(dormitoryKey, floorNum) {
    const container = document.getElementById('roomGrid');
    container.innerHTML = '';

    const floor = AppState.dormitories[dormitoryKey].floors[floorNum];

    if (!floor) {
        container.innerHTML = '<p class="empty-state">층 정보를 찾을 수 없습니다</p>';
        return;
    }

    const rooms = Object.values(floor.rooms);

    // Sort rooms by number
    rooms.sort((a, b) => parseInt(a.number) - parseInt(b.number));

    for (const room of rooms) {
        const roomCard = createRoomCard(room, dormitoryKey, floorNum);
        container.appendChild(roomCard);
    }
}

function createRoomCard(room, dormitoryKey, floorNum) {
    const card = document.createElement('div');
    card.className = 'room-card';
    card.dataset.dormitory = dormitoryKey;
    card.dataset.floor = floorNum;
    card.dataset.room = room.number;

    // Add gender class
    if (room.gender) {
        if (room.gender === '남') card.classList.add('gender-male');
        else if (room.gender === '여') card.classList.add('gender-female');
        else card.classList.add('gender-mixed');
    }

    if (room.unused) {
        card.classList.add('unused');
    }

    if (room.students.length >= room.capacity) {
        card.classList.add('full');
    }

    // Header
    const header = document.createElement('div');
    header.className = 'room-header';

    const roomNumber = document.createElement('div');
    roomNumber.className = 'room-number';

    // Room number text
    const numberText = document.createTextNode(`${room.number}호`);
    roomNumber.appendChild(numberText);

    // Gender badge
    if (room.gender && room.gender !== 'mixed') {
        const badge = document.createElement('span');
        badge.className = `room-gender-badge ${room.gender === '남' ? 'male' : 'female'}`;
        badge.textContent = room.gender;
        roomNumber.appendChild(badge);
    }

    // Right side: status toggle + capacity
    const capacityContainer = document.createElement('div');
    capacityContainer.className = 'room-capacity-container';
    capacityContainer.style.display = 'flex';
    capacityContainer.style.alignItems = 'center';
    capacityContainer.style.gap = 'var(--spacing-xs)';

    // Status toggle (unused / in use)
    const toggleUnusedBtn = document.createElement('button');
    toggleUnusedBtn.className = `room-status-toggle ${room.unused ? 'inactive' : 'active'}`;
    toggleUnusedBtn.innerHTML = room.unused ?
        '<span class="indicator"></span> 미사용' :
        '<span class="indicator"></span> 사용 중';
    toggleUnusedBtn.title = room.unused ? '사용 호실로 전환' : '미사용 호실로 지정';
    toggleUnusedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (room.students.length > 0 && !room.unused) {
            showToast('학생이 배치된 호실은 미사용으로 지정할 수 없습니다.', 'warning');
            return;
        }
        room.unused = !room.unused;
        renderRoomGrid(dormitoryKey, floorNum);
        if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
    });

    const capacity = document.createElement('div');
    capacity.className = 'room-capacity';
    capacity.textContent = `${room.students.length}/${room.capacity}`;

    capacityContainer.appendChild(toggleUnusedBtn);
    capacityContainer.appendChild(capacity);

    header.appendChild(roomNumber);
    header.appendChild(capacityContainer);

    card.appendChild(header);

    // Layout representation info (e.g. 1학년×2, 2학년×2) — with icon
    if (room.layout && room.layout.length > 0) {
        const layoutBadge = document.createElement('div');
        layoutBadge.className = 'room-layout-badge';

        const counts = {};
        room.layout.forEach(g => counts[g] = (counts[g] || 0) + 1);
        const text = Object.entries(counts).map(([g, c]) => `${g}학년×${c}`).join(', ');
        layoutBadge.innerHTML = `<span style="font-size:0.8rem;">👥</span> ${text}`;
        card.appendChild(layoutBadge);
    }

    // Students — sorted by grade then name
    const studentsContainer = document.createElement('div');
    studentsContainer.className = 'room-students';

    // Sort students: by grade asc, then name asc
    const sortedStudents = [...room.students].sort((a, b) => {
        if ((a.grade || 0) !== (b.grade || 0)) return (a.grade || 0) - (b.grade || 0);
        return (a.name || '').localeCompare(b.name || '', 'ko');
    });

    // Detect ALL preferred groups with 2+ members in this room
    const preferredColorMap = (typeof getPreferredColorsForRoom === 'function')
        ? getPreferredColorsForRoom(room.students)
        : new Map();

    // Build set of students in conflict (force-assigned despite avoidance)
    const conflictNames = new Set();
    if (room.conflictPairs && room.conflictPairs.length > 0) {
        for (const [n1, n2] of room.conflictPairs) {
            conflictNames.add(n1);
            conflictNames.add(n2);
        }
    }

    for (const student of sortedStudents) {
        const prefInfo = preferredColorMap.get(student.name);
        const isConflict = conflictNames.has(student.name);
        const studentCard = createStudentCard(student, prefInfo || null, isConflict);
        studentsContainer.appendChild(studentCard);
    }

    card.appendChild(studentsContainer);

    // Click anywhere on room card (except student-card or status toggle) opens layout modal
    card.addEventListener('click', (e) => {
        if (e.target.closest('.student-card')) return;
        if (e.target.closest('.room-layout-btn')) return;
        if (e.target.closest('.room-status-toggle')) return;
        if (room.unused) return;

        if (typeof openLayoutModal === 'function') {
            openLayoutModal('room', { dormitory: dormitoryKey, floor: floorNum, roomNum: room.number });
        }
    });

    return card;
}

// prefInfo: null | { colorIndex: number (0 or 1) }
// isConflict: boolean — true if force-assigned despite avoidance conflict
function createStudentCard(student, prefInfo = null, isConflict = false) {
    const card = document.createElement('div');
    card.className = 'student-card';
    if (student.gender === '여') {
        card.classList.add('female');
    }
    if (isConflict) {
        card.classList.add('conflict-forced');
    } else if (prefInfo !== null) {
        // Only apply preferred styling if not a conflict
        card.classList.add('preferred-match');
        card.classList.add(`preferred-color-${prefInfo.colorIndex % 2}`);
    }
    card.draggable = true;
    card.dataset.studentName = student.name;

    const nameRow = document.createElement('div');
    nameRow.style.display = 'flex';
    nameRow.style.alignItems = 'center';
    nameRow.style.gap = '4px';

    const name = document.createElement('span');
    name.className = 'student-name';
    name.textContent = student.name;
    nameRow.appendChild(name);

    if (isConflict) {
        const badge = document.createElement('span');
        badge.className = 'conflict-badge';
        badge.title = '기피학생 조건 무시 강제 배정';
        badge.textContent = '!';
        nameRow.appendChild(badge);
    } else if (prefInfo !== null) {
        const badge = document.createElement('span');
        badge.className = `preferred-badge preferred-badge-${prefInfo.colorIndex % 2}`;
        badge.title = '선호학생 함께 배치됨';
        badge.textContent = '♥';
        nameRow.appendChild(badge);
    }

    const info = document.createElement('div');
    info.className = 'student-info';

    const infoParts = [];
    if (student.grade) infoParts.push(`${student.grade}학년`);
    if (student.gender) infoParts.push(student.gender);

    info.textContent = infoParts.join(' · ');

    card.appendChild(nameRow);
    if (infoParts.length > 0) {
        card.appendChild(info);
    }

    return card;
}

function renderUnassignedList() {
    const container = document.getElementById('unassignedList');
    container.innerHTML = '';

    let unassigned = getUnassignedStudents();

    // Apply filters
    if (AppState.filters) {
        const { grade, gender } = AppState.filters;

        if (grade !== 'all') {
            unassigned = unassigned.filter(s => s.grade === parseInt(grade));
        }

        if (gender !== 'all') {
            unassigned = unassigned.filter(s => s.gender === gender);
        }
    }

    if (unassigned.length === 0) {
        const totalUnassigned = getUnassignedStudents().length;
        if (totalUnassigned > 0) {
            container.innerHTML = '<div class="empty-state">필터 조건에 맞는 학생이<br>없습니다</div>';
        } else {
            container.innerHTML = '<div class="empty-state">모든 학생이<br>배치되었습니다</div>';
        }
        return;
    }

    // Sort by grade and name
    unassigned.sort((a, b) => {
        if (a.grade !== b.grade) {
            return (a.grade || 0) - (b.grade || 0);
        }
        return a.name.localeCompare(b.name, 'ko');
    });

    for (const student of unassigned) {
        const studentCard = createStudentCard(student);
        container.appendChild(studentCard);
    }
}
