// ===== Global State =====
const AppState = {
    students: [],
    preferredGroups: [],
    avoidedPairs: {},
    dormitories: {},
    currentDormitory: 'albatross',
    currentFloor: null,
    isDragging: false
};

// ===== Dormitory Configuration =====
const DORM_CONFIG = {
    albatross: {
        name: '알바트로스',
        floors: {
            1: { number: 1, rooms: generateRoomNumbers(101, 110) },
            2: { number: 2, rooms: generateRoomNumbers(201, 210) }
        }
    },
    veritas: {
        name: '베리타스',
        floors: {
            2: { number: 2, rooms: generateRoomNumbers(201, 211) },
            3: { number: 3, rooms: generateRoomNumbers(301, 311) },
            4: { number: 4, rooms: generateRoomNumbers(401, 411) },
            5: { number: 5, rooms: generateRoomNumbers(501, 511) }
        }
    },
    singwan: {
        name: '명덕재',
        floors: {
            2: { number: 2, rooms: generateRoomNumbers(201, 232) },
            3: { number: 3, rooms: generateRoomNumbers(301, 332) },
            4: { number: 4, rooms: generateRoomNumbers(401, 432) }
        }
    }
};

// ===== Utility Functions =====
function generateRoomNumbers(start, end) {
    const rooms = [];
    for (let i = start; i <= end; i++) {
        rooms.push(i.toString());
    }
    return rooms;
}

function initializeDormitories() {
    AppState.dormitories = {};

    for (const [dormKey, dormConfig] of Object.entries(DORM_CONFIG)) {
        AppState.dormitories[dormKey] = {
            name: dormConfig.name,
            floors: {}
        };

        for (const [floorNum, floorConfig] of Object.entries(dormConfig.floors)) {
            AppState.dormitories[dormKey].floors[floorNum] = {
                number: parseInt(floorNum),
                rooms: {}
            };

            for (const roomNum of floorConfig.rooms) {
                AppState.dormitories[dormKey].floors[floorNum].rooms[roomNum] = {
                    number: roomNum,
                    capacity: 4,
                    students: []
                };
            }
        }
    }
}

function updateStats() {
    const total = AppState.students.length;
    const assigned = AppState.students.filter(s => s.assigned).length;
    const unassigned = total - assigned;

    document.getElementById('totalStudents').textContent = total;
    document.getElementById('assignedStudents').textContent = assigned;
    document.getElementById('unassignedStudents').textContent = unassigned;
    document.getElementById('sidebarCount').textContent = `${unassigned}명`;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-message">${message}</div>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showLoading(show = true) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = show ? 'flex' : 'none';
}

function getUnassignedStudents() {
    return AppState.students.filter(s => !s.assigned);
}

function getAssignedStudents() {
    return AppState.students.filter(s => s.assigned);
}

function findStudent(name) {
    return AppState.students.find(s => s.name === name);
}

function removeStudentFromRoom(student) {
    if (student.dormitory && student.floor && student.room) {
        const room = AppState.dormitories[student.dormitory].floors[student.floor].rooms[student.room];
        const index = room.students.findIndex(s => s.name === student.name);
        if (index > -1) {
            room.students.splice(index, 1);
        }

        student.assigned = false;
        student.dormitory = null;
        student.floor = null;
        student.room = null;
    }
}

function assignStudentToRoom(student, dormitory, floor, roomNumber) {
    removeStudentFromRoom(student);

    const room = AppState.dormitories[dormitory].floors[floor].rooms[roomNumber];

    if (room.students.length >= room.capacity) {
        return false;
    }

    room.students.push(student);
    student.assigned = true;
    student.dormitory = dormitory;
    student.floor = floor;
    student.room = roomNumber;

    return true;
}

// ===== Event Handlers =====
// ===== Event Handlers =====
function handleTabClick(e) {
    if (e.target.classList.contains('tab-btn')) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');

        const dormitory = e.target.dataset.dormitory;
        AppState.currentDormitory = dormitory;

        renderFloorSelection(dormitory);

        const firstFloor = Object.keys(DORM_CONFIG[dormitory].floors)[0];
        AppState.currentFloor = firstFloor;
        renderRoomGrid(dormitory, firstFloor);

        // Clear selection when changing tabs
        if (typeof clearSelection === 'function') clearSelection();
    }
}

function handleFloorClick(e) {
    if (e.target.classList.contains('floor-btn')) {
        document.querySelectorAll('.floor-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');

        const floor = e.target.dataset.floor;
        AppState.currentFloor = floor;
        renderRoomGrid(AppState.currentDormitory, floor);

        // Clear selection when changing floors
        if (typeof clearSelection === 'function') clearSelection();
    }
}

function handleAssignScopeChange(e) {
    const scope = e.target.value;
    const targetContainer = document.getElementById('assignTargetContainer');
    const targetSelect = document.getElementById('assignTarget');

    targetSelect.innerHTML = '';

    if (scope === 'all') {
        targetContainer.style.display = 'none';
    } else if (scope === 'dormitory') {
        targetContainer.style.display = 'block';
        for (const [key, config] of Object.entries(DORM_CONFIG)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = config.name;
            targetSelect.appendChild(option);
        }
    } else if (scope === 'floor') {
        targetContainer.style.display = 'block';
        for (const [dormKey, dormConfig] of Object.entries(DORM_CONFIG)) {
            for (const floorNum of Object.keys(dormConfig.floors)) {
                const option = document.createElement('option');
                option.value = `${dormKey}-${floorNum}`;
                option.textContent = `${dormConfig.name} ${floorNum}층`;
                targetSelect.appendChild(option);
            }
        }
    }
}

function handleAutoAssign() {
    if (AppState.students.length === 0) {
        showToast('명렬표를 먼저 업로드해주세요', 'warning');
        return;
    }

    const scope = document.getElementById('assignScope').value;
    const target = document.getElementById('assignTarget').value;

    showLoading(true);

    setTimeout(() => {
        try {
            autoAssign(scope, target);
            renderAll();
            updateStats();
            showToast('자동 배치가 완료되었습니다', 'success');
        } catch (error) {
            showToast(`배치 중 오류 발생: ${error.message}`, 'error');
        } finally {
            showLoading(false);
        }
    }, 100);
}

function handleReset() {
    if (!confirm('모든 배치를 초기화하시겠습니까?')) {
        return;
    }

    AppState.students.forEach(student => {
        removeStudentFromRoom(student);
    });

    renderAll();
    updateStats();
    showToast('초기화가 완료되었습니다', 'success');
}

function handleExport() {
    if (AppState.students.length === 0) {
        showToast('내보낼 데이터가 없습니다', 'warning');
        return;
    }

    exportToExcel();
    showToast('Excel 파일이 다운로드되었습니다', 'success');
}

function handleFilterChange() {
    const grade = document.getElementById('filterGrade').value;
    const gender = document.getElementById('filterGender').value;

    AppState.filters = { grade, gender };
    renderUnassignedList();
}

// ===== File Input Handlers =====
function setupFileInputs() {
    const studentListInput = document.getElementById('studentListFile');
    const preferredInput = document.getElementById('preferredFile');
    const avoidedInput = document.getElementById('avoidedFile');

    studentListInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('studentListFileName').textContent = file.name;
            document.getElementById('studentListFileName').classList.add('has-file');
            handleStudentListFile(file);
        }
    });

    preferredInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('preferredFileName').textContent = file.name;
            document.getElementById('preferredFileName').classList.add('has-file');
            handlePreferredFile(file);
        }
    });

    avoidedInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('avoidedFileName').textContent = file.name;
            document.getElementById('avoidedFileName').classList.add('has-file');
            handleAvoidedFile(file);
        }
    });

    // Click on file name to trigger file input
    document.getElementById('studentListFileName').addEventListener('click', () => studentListInput.click());
    document.getElementById('preferredFileName').addEventListener('click', () => preferredInput.click());
    document.getElementById('avoidedFileName').addEventListener('click', () => avoidedInput.click());
}

// ===== Render All =====
function renderAll() {
    renderFloorSelection(AppState.currentDormitory);
    renderRoomGrid(AppState.currentDormitory, AppState.currentFloor);
    renderUnassignedList();
}

// ===== Initialization =====
function init() {
    initializeDormitories();

    // Initialize filters
    AppState.filters = { grade: 'all', gender: 'all' };

    // Event Listeners
    document.querySelector('.dormitory-tabs').addEventListener('click', handleTabClick);
    document.getElementById('floorSelection').addEventListener('click', handleFloorClick);
    document.getElementById('assignScope').addEventListener('change', handleAssignScopeChange);
    document.getElementById('autoAssignBtn').addEventListener('click', handleAutoAssign);
    document.getElementById('resetBtn').addEventListener('click', handleReset);
    document.getElementById('exportBtn').addEventListener('click', handleExport);

    // Filter Listeners
    document.getElementById('filterGrade').addEventListener('change', handleFilterChange);
    document.getElementById('filterGender').addEventListener('change', handleFilterChange);

    setupFileInputs();

    // Initialize Selection Handler
    if (typeof initSelectionHandler === 'function') {
        initSelectionHandler();
    }

    // Initial render
    AppState.currentFloor = '1';
    renderFloorSelection('albatross');
    renderRoomGrid('albatross', '1');
    updateStats();
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
