// ===== Drag and Drop Module =====

let draggedStudent = null;
let dragSourceType = null; // 'room' or 'sidebar'
let dragSourceInfo = null;

function initDragAndDrop() {
    // Delegate event listeners to document for dynamically created elements
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    document.addEventListener('dragleave', handleDragLeave);
}

function handleDragStart(e) {
    if (!e.target.classList.contains('student-card')) return;

    e.target.classList.add('dragging');
    AppState.isDragging = true;

    const studentName = e.target.dataset.studentName;
    draggedStudent = findStudent(studentName);

    // Determine source
    const roomCard = e.target.closest('.room-card');
    if (roomCard) {
        dragSourceType = 'room';
        dragSourceInfo = {
            dormitory: roomCard.dataset.dormitory,
            floor: roomCard.dataset.floor,
            room: roomCard.dataset.room
        };
    } else {
        dragSourceType = 'sidebar';
        dragSourceInfo = null;
    }

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', studentName);
}

function handleDragEnd(e) {
    if (!e.target.classList.contains('student-card')) return;

    e.target.classList.remove('dragging');
    AppState.isDragging = false;

    // Remove all drop-target classes
    document.querySelectorAll('.drop-target').forEach(el => {
        el.classList.remove('drop-target');
    });

    draggedStudent = null;
    dragSourceType = null;
    dragSourceInfo = null;
}

function handleDragOver(e) {
    if (!AppState.isDragging) return;

    const roomCard = e.target.closest('.room-card');
    if (roomCard) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        // Add visual feedback
        if (!roomCard.classList.contains('drop-target')) {
            roomCard.classList.add('drop-target');
        }
    }

    // Also allow drop on sidebar
    const sidebar = e.target.closest('.sidebar-content');
    if (sidebar && dragSourceType === 'room') {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }
}

function handleDragLeave(e) {
    const roomCard = e.target.closest('.room-card');
    if (roomCard) {
        // Check if we're still over the room card or one of its children
        const rect = roomCard.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;

        if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
            roomCard.classList.remove('drop-target');
        }
    }
}

function handleDrop(e) {
    e.preventDefault();

    if (!draggedStudent) return;

    // Drop on room card
    const roomCard = e.target.closest('.room-card');
    if (roomCard) {
        const targetDormitory = roomCard.dataset.dormitory;
        const targetFloor = roomCard.dataset.floor;
        const targetRoom = roomCard.dataset.room;

        handleRoomDrop(targetDormitory, targetFloor, targetRoom);
        return;
    }

    // Drop on sidebar (unassign)
    const sidebar = e.target.closest('.sidebar-content');
    if (sidebar && dragSourceType === 'room') {
        handleSidebarDrop();
        return;
    }
}

function handleRoomDrop(targetDormitory, targetFloor, targetRoom) {
    const room = AppState.dormitories[targetDormitory].floors[targetFloor].rooms[targetRoom];

    if (room.unused) {
        showToast('미사용으로 지정된 호실입니다', 'warning');
        renderAll();
        return;
    }

    // Check if room is full
    if (room.students.length >= room.capacity) {
        showToast('호실 정원이 가득 찼습니다', 'warning');
        renderAll();
        updateStats();
        return;
    }

    // Check if student can be assigned to this room (avoiding conflicts)
    const check = canAssignToRoom(draggedStudent.name, room);
    if (!check.success) {
        showToast(check.reason, 'warning');
        renderAll();
        updateStats();
        return;
    }

    // If dragging from another room, remove from that room first
    if (dragSourceType === 'room') {
        removeStudentFromRoom(draggedStudent);
    }

    // Assign to new room
    const success = assignStudentToRoom(draggedStudent, targetDormitory, targetFloor, targetRoom);

    if (success) {
        showToast(`${draggedStudent.name}을(를) ${targetRoom}호에 배정했습니다`, 'success');
    } else {
        showToast('배정에 실패했습니다', 'error');
    }

    renderAll();
    updateStats();
    if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
}

function handleSidebarDrop() {
    // Unassign student
    removeStudentFromRoom(draggedStudent);

    showToast(`${draggedStudent.name}을(를) 미배치 목록으로 이동했습니다`, 'success');

    renderAll();
    updateStats();
    if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
}

// Initialize when script loads
initDragAndDrop();
