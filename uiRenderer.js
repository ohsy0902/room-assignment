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

    const capacity = document.createElement('div');
    capacity.className = 'room-capacity';
    capacity.textContent = `${room.students.length}/${room.capacity}`;

    header.appendChild(roomNumber);
    header.appendChild(capacity);

    // Students
    const studentsContainer = document.createElement('div');
    studentsContainer.className = 'room-students';

    for (const student of room.students) {
        const studentCard = createStudentCard(student);
        studentsContainer.appendChild(studentCard);
    }

    card.appendChild(header);
    card.appendChild(studentsContainer);

    // Click handler for gender cycling (only if not dragging)
    card.addEventListener('click', (e) => {
        // Prevent triggering if clicking on a student card or if selecting
        if (e.target.closest('.student-card')) return;
        if (typeof isSelecting !== 'undefined' && isSelecting) return;

        // Simple check: if no selection box is active and we are not in a multi-select mode
        if (typeof toggleRoomGender === 'function') {
            toggleRoomGender(room.number);
        }
    });

    return card;
}

function createStudentCard(student) {
    const card = document.createElement('div');
    card.className = 'student-card';
    if (student.gender === '여') {
        card.classList.add('female');
    }
    card.draggable = true;
    card.dataset.studentName = student.name;

    const name = document.createElement('div');
    name.className = 'student-name';
    name.textContent = student.name;

    const info = document.createElement('div');
    info.className = 'student-info';

    const infoParts = [];
    if (student.grade) infoParts.push(`${student.grade}학년`);
    if (student.gender) infoParts.push(student.gender);

    info.textContent = infoParts.join(' · ');

    card.appendChild(name);
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
            container.innerHTML = '<p class="empty-state">필터 조건에 맞는 학생이 없습니다</p>';
        } else {
            container.innerHTML = '<p class="empty-state">모든 학생이 배치되었습니다</p>';
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
