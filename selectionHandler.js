// ===== Selection & Gender Assignment Module =====

let isSelecting = false;
let selectionStart = { x: 0, y: 0 };
let selectionBox = null;
let selectedRoomIds = new Set();

function initSelectionHandler() {
    const gridContainer = document.querySelector('.room-grid-container');

    // Mouse events for drag selection
    gridContainer.addEventListener('mousedown', handleSelectionStart);
    document.addEventListener('mousemove', handleSelectionMove);
    document.addEventListener('mouseup', handleSelectionEnd);

    // Floating action bar events
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gender = e.target.dataset.gender;
            applyGenderToSelected(gender);
        });
    });

    document.getElementById('clearSelectionBtn').addEventListener('click', clearSelection);
}

function handleSelectionStart(e) {
    // Ignore if clicking on a room card directly (unless it's the start of a drag)
    // We'll handle single clicks in app.js or here if we want to support both
    if (e.target.closest('.room-card')) return;

    isSelecting = true;
    selectionStart = { x: e.pageX, y: e.pageY };

    // Create selection box
    selectionBox = document.createElement('div');
    selectionBox.className = 'selection-box';
    document.body.appendChild(selectionBox);

    updateSelectionBox(e.pageX, e.pageY);

    // Clear previous selection if not holding Shift/Ctrl
    if (!e.shiftKey && !e.ctrlKey) {
        clearSelection();
    }
}

function handleSelectionMove(e) {
    if (!isSelecting) return;

    updateSelectionBox(e.pageX, e.pageY);

    // Check for intersections with room cards
    checkIntersections();
}

function handleSelectionEnd(e) {
    if (!isSelecting) return;

    isSelecting = false;
    if (selectionBox) {
        selectionBox.remove();
        selectionBox = null;
    }

    updateFloatingActionBar();
}

function updateSelectionBox(currentX, currentY) {
    if (!selectionBox) return;

    const minX = Math.min(selectionStart.x, currentX);
    const maxX = Math.max(selectionStart.x, currentX);
    const minY = Math.min(selectionStart.y, currentY);
    const maxY = Math.max(selectionStart.y, currentY);

    selectionBox.style.left = `${minX}px`;
    selectionBox.style.top = `${minY}px`;
    selectionBox.style.width = `${maxX - minX}px`;
    selectionBox.style.height = `${maxY - minY}px`;
}

function checkIntersections() {
    if (!selectionBox) return;

    const boxRect = selectionBox.getBoundingClientRect();
    const rooms = document.querySelectorAll('.room-card');

    rooms.forEach(room => {
        const roomRect = room.getBoundingClientRect();

        if (isIntersecting(boxRect, roomRect)) {
            room.classList.add('selected');
            selectedRoomIds.add(room.dataset.room);
        } else if (!isRoomSelectedPreviously(room.dataset.room)) {
            // Only remove if it wasn't selected before this drag (unless we want to deselect)
            // For simplicity, we'll just add to selection during drag
        }
    });
}

function isIntersecting(r1, r2) {
    return !(r2.left > r1.right ||
        r2.right < r1.left ||
        r2.top > r1.bottom ||
        r2.bottom < r1.top);
}

function isRoomSelectedPreviously(roomId) {
    // This is a simplified check. In a full implementation, we'd track 
    // selection state before the drag started.
    return false;
}

function clearSelection() {
    selectedRoomIds.clear();
    document.querySelectorAll('.room-card.selected').forEach(el => el.classList.remove('selected'));
    updateFloatingActionBar();
}

function updateFloatingActionBar() {
    const bar = document.getElementById('floatingActionBar');
    const countSpan = bar.querySelector('.selection-count');

    if (selectedRoomIds.size > 0) {
        bar.classList.add('visible');
        countSpan.textContent = `${selectedRoomIds.size}개 호실 선택됨`;
    } else {
        bar.classList.remove('visible');
    }
}

function applyGenderToSelected(gender) {
    const dormitory = AppState.currentDormitory;
    const floor = AppState.currentFloor;

    selectedRoomIds.forEach(roomNum => {
        const room = AppState.dormitories[dormitory].floors[floor].rooms[roomNum];
        if (room) {
            // Check if room is empty or gender compatible
            if (room.students.length > 0) {
                // If room has students, check if they match the new gender
                // If not, we might need to warn or skip. For now, let's skip occupied rooms if conflict.
                const hasConflict = room.students.some(s => {
                    if (gender === 'mixed') return false;
                    return s.gender !== gender;
                });

                if (hasConflict) {
                    console.warn(`Room ${roomNum} has students causing conflict with ${gender}`);
                    return;
                }
            }

            room.gender = gender;
        }
    });

    // Refresh grid
    renderRoomGrid(dormitory, floor);

    // Restore selection visualization
    selectedRoomIds.forEach(roomNum => {
        const card = document.querySelector(`.room-card[data-room="${roomNum}"]`);
        if (card) card.classList.add('selected');
    });

    showToast(`${selectedRoomIds.size}개 호실의 성별이 변경되었습니다`, 'success');
}

// Function to toggle gender for a single room (click handler)
function toggleRoomGender(roomNum) {
    const dormitory = AppState.currentDormitory;
    const floor = AppState.currentFloor;
    const room = AppState.dormitories[dormitory].floors[floor].rooms[roomNum];

    if (!room) return;

    // Cycle: null/mixed -> male -> female -> mixed
    if (!room.gender || room.gender === 'mixed') {
        room.gender = '남';
    } else if (room.gender === '남') {
        room.gender = '여';
    } else {
        room.gender = 'mixed';
    }

    // Check conflicts with existing students
    if (room.students.length > 0 && room.gender !== 'mixed') {
        const hasConflict = room.students.some(s => s.gender !== room.gender);
        if (hasConflict) {
            showToast('이미 배정된 학생과 성별이 맞지 않습니다', 'warning');
            // Revert or force? Let's revert for safety
            // Or maybe we just cycle to the next valid one?
            // For now, just let it change but warn.
        }
    }

    renderRoomGrid(dormitory, floor);
}
