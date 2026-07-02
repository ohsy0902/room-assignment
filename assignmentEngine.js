// ===== Auto Assignment Engine =====

function autoAssign(scope, target) {
    // Step 1: Assign preferred groups first
    assignPreferredGroups(scope, target);

    // Step 2: Assign remaining students
    assignRemainingStudents(scope, target);
}

function assignPreferredGroups(scope, target) {
    for (const group of AppState.preferredGroups) {
        // Find students in this group
        const students = [];
        for (const studentName of group.students) {
            const student = findStudent(studentName);
            if (student && !student.assigned) {
                // Check filters
                if (!matchesFilters(student)) continue;
                students.push(student);
            }
        }

        if (students.length === 0) continue;

        // Find available room based on scope
        const availableRooms = getAvailableRooms(scope, target);

        let assigned = false;
        for (const roomInfo of availableRooms) {
            const room = AppState.dormitories[roomInfo.dormitory].floors[roomInfo.floor].rooms[roomInfo.room];

            // Check if room has enough space
            if (room.students.length + students.length <= room.capacity) {
                // Check if all students can be assigned together (no conflicts)
                let canAssign = true;

                // Check existing students in the room
                for (const student of students) {
                    if (!canAssignToRoom(student.name, room)) {
                        canAssign = false;
                        break;
                    }
                }

                // Check among the group members themselves
                if (canAssign) {
                    for (let i = 0; i < students.length; i++) {
                        for (let j = i + 1; j < students.length; j++) {
                            if (!canAssignTogether(students[i].name, students[j].name)) {
                                canAssign = false;
                                break;
                            }
                        }
                        if (!canAssign) break;
                    }
                }

                if (canAssign) {
                    // Assign all students to this room
                    for (const student of students) {
                        assignStudentToRoom(student, roomInfo.dormitory, roomInfo.floor, roomInfo.room);
                    }
                    group.assignedRoom = roomInfo;
                    assigned = true;
                    break;
                }
            }
        }

        if (!assigned && students.length > 0) {
            // Only warn if we actually tried to assign them (i.e., they passed filters)
            // console.warn(`선호학생 그룹을 배정할 수 없습니다: ${students.map(s => s.name).join(', ')}`);
        }
    }
}

function assignRemainingStudents(scope, target) {
    const unassignedStudents = getUnassignedStudents();

    // Shuffle for fairness
    shuffleArray(unassignedStudents);

    for (const student of unassignedStudents) {
        // Check filters
        if (!matchesFilters(student)) continue;

        const availableRooms = getAvailableRooms(scope, target);

        let assigned = false;
        let hasConflict = false;

        // Try to assign to a room
        for (const roomInfo of availableRooms) {
            const room = AppState.dormitories[roomInfo.dormitory].floors[roomInfo.floor].rooms[roomInfo.room];

            if (room.students.length >= room.capacity) continue;

            // Check if student can be assigned to this room
            if (canAssignToRoom(student.name, room)) {
                assignStudentToRoom(student, roomInfo.dormitory, roomInfo.floor, roomInfo.room);
                assigned = true;
                break;
            } else {
                hasConflict = true;
            }
        }

        // If not assigned due to conflicts and no possible rooms
        if (!assigned && hasConflict) {
            console.warn(`기피학생 제약으로 ${student.name}을(를) 배정할 수 없습니다. 강제 배정합니다.`);

            // Force assign to any available room (still respecting gender if possible)
            for (const roomInfo of availableRooms) {
                const room = AppState.dormitories[roomInfo.dormitory].floors[roomInfo.floor].rooms[roomInfo.room];

                if (room.students.length < room.capacity) {
                    // Check gender constraint only for forced assignment
                    if (room.gender && room.gender !== 'mixed') {
                        const s = findStudent(student.name);
                        if (s && s.gender && s.gender !== room.gender) continue;
                    }

                    assignStudentToRoom(student, roomInfo.dormitory, roomInfo.floor, roomInfo.room);
                    assigned = true;
                    break;
                }
            }
        }
    }
}

function getAvailableRooms(scope, target) {
    const rooms = [];

    if (scope === 'all') {
        // Get all rooms from all dormitories
        for (const [dormKey, dorm] of Object.entries(AppState.dormitories)) {
            for (const [floorNum, floor] of Object.entries(dorm.floors)) {
                for (const [roomNum, room] of Object.entries(floor.rooms)) {
                    if (room.students.length < room.capacity) {
                        rooms.push({
                            dormitory: dormKey,
                            floor: floorNum,
                            room: roomNum
                        });
                    }
                }
            }
        }
    } else if (scope === 'dormitory') {
        // Get all rooms from specific dormitory
        const dorm = AppState.dormitories[target];
        for (const [floorNum, floor] of Object.entries(dorm.floors)) {
            for (const [roomNum, room] of Object.entries(floor.rooms)) {
                if (room.students.length < room.capacity) {
                    rooms.push({
                        dormitory: target,
                        floor: floorNum,
                        room: roomNum
                    });
                }
            }
        }
    } else if (scope === 'floor') {
        // Parse target: "dormitory-floor"
        const [dormKey, floorNum] = target.split('-');
        const floor = AppState.dormitories[dormKey].floors[floorNum];

        for (const [roomNum, room] of Object.entries(floor.rooms)) {
            if (room.students.length < room.capacity) {
                rooms.push({
                    dormitory: dormKey,
                    floor: floorNum,
                    room: roomNum
                });
            }
        }
    }

    // Shuffle for randomness
    shuffleArray(rooms);

    return rooms;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// ===== Validation Functions =====

function matchesFilters(student) {
    if (!AppState.filters) return true;

    const { grade, gender } = AppState.filters;

    if (grade !== 'all' && student.grade !== parseInt(grade)) return false;
    if (gender !== 'all' && student.gender !== gender) return false;

    return true;
}

function canAssignToRoom(studentName, room) {
    const student = findStudent(studentName);
    if (!student) return false;

    // 1. Check Room Gender Constraint
    if (room.gender && room.gender !== 'mixed') {
        if (student.gender && student.gender !== room.gender) {
            return false;
        }
    }

    // 2. Check Avoided Students
    // Check if any student currently in the room is avoided by the new student
    // or if any student in the room avoids the new student

    // Get avoided list for the new student
    const studentAvoids = AppState.avoidedPairs[studentName] || [];

    for (const existingStudent of room.students) {
        // Case A: New student avoids existing student
        if (studentAvoids.includes(existingStudent.name)) {
            return false;
        }

        // Case B: Existing student avoids new student
        const existingStudentAvoids = AppState.avoidedPairs[existingStudent.name] || [];
        if (existingStudentAvoids.includes(studentName)) {
            return false;
        }
    }

    return true;
}

function canAssignTogether(studentName1, studentName2) {
    // Check if student1 avoids student2
    const avoids1 = AppState.avoidedPairs[studentName1] || [];
    if (avoids1.includes(studentName2)) return false;

    // Check if student2 avoids student1
    const avoids2 = AppState.avoidedPairs[studentName2] || [];
    if (avoids2.includes(studentName1)) return false;

    return true;
}
