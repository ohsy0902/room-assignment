// ===== Room & Floor Layout Configuration Module =====

let activeLayoutTarget = null;
let modalLayout = [];

function initLayoutModal() {
    initLayoutModalListeners();
}

function openLayoutModal(type, targetInfo) {
    activeLayoutTarget = { type, ...targetInfo };

    const titleEl = document.getElementById('layoutModalTitle');
    const dormName = DORM_CONFIG[targetInfo.dormitory].name;

    if (type === 'floor') {
        titleEl.textContent = `🏢 ${dormName} ${targetInfo.floor}층 전체 호실 레이아웃 설정`;
        const floor = AppState.dormitories[targetInfo.dormitory].floors[targetInfo.floor];
        modalLayout = [...(floor.defaultLayout || [])];
    } else {
        titleEl.textContent = `🚪 ${dormName} ${targetInfo.roomNum}호 레이아웃 설정`;
        const room = AppState.dormitories[targetInfo.dormitory].floors[targetInfo.floor].rooms[targetInfo.roomNum];
        modalLayout = [...(room.layout || [])];
    }

    renderModalSlots();
    document.getElementById('layoutModal').style.display = 'flex';
}

function closeLayoutModal() {
    document.getElementById('layoutModal').style.display = 'none';
    activeLayoutTarget = null;
    modalLayout = [];
}

function renderModalSlots() {
    const container = document.getElementById('builderSlotsContainer');
    container.innerHTML = '';

    for (let i = 0; i < 4; i++) {
        const slot = document.createElement('div');
        if (i < modalLayout.length) {
            const grade = modalLayout[i];
            slot.className = `builder-slot grade-${grade}`;
            slot.textContent = `${grade}학년`;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-slot';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                modalLayout.splice(i, 1);
                renderModalSlots();
            });
            slot.appendChild(removeBtn);
        } else {
            slot.className = 'builder-slot empty';
            slot.textContent = '비어있음';
        }
        container.appendChild(slot);
    }
}

function saveLayout() {
    if (!activeLayoutTarget) return;

    const { type, dormitory, floor: floorNum, roomNum } = activeLayoutTarget;
    const dorm = AppState.dormitories[dormitory];

    if (type === 'floor') {
        const floor = dorm.floors[floorNum];
        floor.defaultLayout = [...modalLayout];

        // Copy to all rooms on this floor
        for (const rNum in floor.rooms) {
            floor.rooms[rNum].layout = [...modalLayout];
        }

        // Check for layout conflicts with currently assigned students
        let hasMismatch = false;
        for (const rNum in floor.rooms) {
            const room = floor.rooms[rNum];
            if (checkLayoutMismatch(room, modalLayout)) {
                hasMismatch = true;
            }
        }

        if (hasMismatch) {
            showToast('일부 호실에 새로운 학년 레이아웃과 일치하지 않는 기존 학생이 있습니다. 확인해주세요.', 'warning');
        } else {
            showToast(`${dorm.name} ${floorNum}층 모든 호실의 학년 레이아웃을 성공적으로 설정했습니다.`, 'success');
        }
    } else {
        const room = dorm.floors[floorNum].rooms[roomNum];
        room.layout = [...modalLayout];

        // Check conflict
        if (checkLayoutMismatch(room, modalLayout)) {
            showToast('현재 호실 학생 중 일부의 학년이 설정한 레이아웃과 맞지 않습니다.', 'warning');
        } else {
            showToast(`${roomNum}호의 학년 레이아웃을 성공적으로 설정했습니다.`, 'success');
        }
    }

    closeLayoutModal();
    renderRoomGrid(AppState.currentDormitory, AppState.currentFloor);
    if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
}

function checkLayoutMismatch(room, layout) {
    if (!layout || layout.length === 0) return false;

    // Count allowed counts per grade
    const allowed = {};
    layout.forEach(g => allowed[g] = (allowed[g] || 0) + 1);

    // Count current student grades
    const current = {};
    room.students.forEach(s => current[s.grade] = (current[s.grade] || 0) + 1);

    for (const grade in current) {
        if (!allowed[grade] || current[grade] > allowed[grade]) {
            return true; // Conflict!
        }
    }
    return false;
}

function initLayoutModalListeners() {
    // Select Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const layoutStr = e.target.dataset.layout;
            modalLayout = layoutStr.split(',').map(Number);
            renderModalSlots();
        });
    });

    // Closes
    document.getElementById('closeLayoutModalBtn').addEventListener('click', closeLayoutModal);
    document.getElementById('cancelLayoutModalBtn').addEventListener('click', closeLayoutModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const layoutModal = document.getElementById('layoutModal');
            if (layoutModal && layoutModal.style.display !== 'none') {
                closeLayoutModal();
            }
        }
    });

    // Save
    document.getElementById('saveLayoutModalBtn').addEventListener('click', saveLayout);

    // Reset
    document.getElementById('resetLayoutModalBtn').addEventListener('click', () => {
        modalLayout = [];
        renderModalSlots();
    });

    // Draggable Block Sources
    const sources = document.querySelectorAll('.grade-source-block');
    sources.forEach(block => {
        block.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', block.dataset.grade);
            e.dataTransfer.effectAllowed = 'copy';
        });

        block.addEventListener('click', () => {
            if (modalLayout.length < 4) {
                modalLayout.push(Number(block.dataset.grade));
                renderModalSlots();
            } else {
                showToast('최대 4명까지만 레이아웃 자리를 지정할 수 있습니다.', 'warning');
            }
        });
    });

    const dropzone = document.getElementById('builderSlotsContainer');
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        const grade = Number(e.dataTransfer.getData('text/plain'));
        if (grade >= 1 && grade <= 3) {
            if (modalLayout.length < 4) {
                modalLayout.push(grade);
                renderModalSlots();
            } else {
                showToast('최대 4명까지만 레이아웃 자리를 지정할 수 있습니다.', 'warning');
            }
        }
    });
}

// Auto init when document is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLayoutModal);
} else {
    initLayoutModal();
}
