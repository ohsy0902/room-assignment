// ===== Auto Assignment Engine =====

async function autoAssign(scope, target) {
    // Step 1: Assign preferred groups first
    assignPreferredGroups(scope, target);

    // Step 2: Assign remaining students
    await assignRemainingStudents(scope, target);
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

        // Find available room based on scope (do not prioritize occupied rooms for preferred groups to avoid clustering)
        const availableRooms = getAvailableRooms(scope, target, false);

        let assigned = false;
        for (const roomInfo of availableRooms) {
            const room = AppState.dormitories[roomInfo.dormitory].floors[roomInfo.floor].rooms[roomInfo.room];

            // Check if room has enough space
            if (room.students.length + students.length <= room.capacity) {
                // Check if all students can be assigned together (no conflicts)
                let canAssign = true;

                // Check existing students in the room (gender & avoided)
                for (const student of students) {
                    if (!canAssignToRoom(student.name, room, students).success) {
                        canAssign = false;
                        break;
                    }
                }

                // Check layout constraint for the whole group together
                if (canAssign && room.layout && room.layout.length > 0) {
                    // Count allowed per grade from layout
                    const allowedCounts = {};
                    room.layout.forEach(g => allowedCounts[g] = (allowedCounts[g] || 0) + 1);

                    // Count currently assigned per grade
                    const currentCounts = {};
                    room.students.forEach(s => currentCounts[s.grade] = (currentCounts[s.grade] || 0) + 1);

                    // Count group members per grade
                    const groupCounts = {};
                    students.forEach(s => groupCounts[s.grade] = (groupCounts[s.grade] || 0) + 1);

                    // Check if adding the group would exceed layout limits
                    for (const grade in groupCounts) {
                        const allowed = allowedCounts[grade] || 0;
                        const current = currentCounts[grade] || 0;
                        if (current + groupCounts[grade] > allowed) {
                            canAssign = false;
                            break;
                        }
                    }
                }

                // Check among the group members themselves (avoided pairs)
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
    }
}

async function assignRemainingStudents(scope, target) {
    const unassignedStudents = getUnassignedStudents();

    // Shuffle for fairness
    shuffleArray(unassignedStudents);

    const conflictStudents = [];

    for (const student of unassignedStudents) {
        // Check filters
        if (!matchesFilters(student)) continue;

        const availableRooms = getAvailableRooms(scope, target);

        let assigned = false;
        let hasConflict = false;
        let reasons = new Set();

        // Try to assign to a room
        for (const roomInfo of availableRooms) {
            const room = AppState.dormitories[roomInfo.dormitory].floors[roomInfo.floor].rooms[roomInfo.room];

            if (room.students.length >= room.capacity) continue;

            // Check if student can be assigned to this room
            const check = canAssignToRoom(student.name, room);
            if (check.success) {
                assignStudentToRoom(student, roomInfo.dormitory, roomInfo.floor, roomInfo.room);
                assigned = true;
                break;
            } else {
                hasConflict = true;
                reasons.add(check.reason);
            }
        }

        // 현재 남은 자리가 있는지(전체 가용석) 확인
        const currentRooms = getAvailableRooms(scope, target);
        let hasRoomSpace = currentRooms.some(r => {
            const rm = AppState.dormitories[r.dormitory].floors[r.floor].rooms[r.room];
            return rm.students.length < rm.capacity;
        });

        // If not assigned but space exists, we have a conflict
        // If hasConflict is true, it means we tried rooms but none accepted
        if (!assigned && (hasConflict || hasRoomSpace)) {
            conflictStudents.push({
                student,
                reasons: Array.from(reasons)
            });
        }
    }

    if (conflictStudents.length > 0) {
        // Hide loader to allow interaction
        if (typeof showLoading === 'function') showLoading(false);

        // Show modal and wait for choice
        const choice = await window.showForceAssignModal(conflictStudents);

        // Restore loader
        if (typeof showLoading === 'function') showLoading(true);

        if (choice === 'force') {
            for (const conflict of conflictStudents) {
                const student = conflict.student;
                const availableRooms = getAvailableRooms(scope, target);
                let assigned = false;

                // Stage 1: 기피학생 무시. 단, 성별 + 레이아웃은 존중
                for (const roomInfo of availableRooms) {
                    const room = AppState.dormitories[roomInfo.dormitory].floors[roomInfo.floor].rooms[roomInfo.room];
                    if (room.students.length >= room.capacity) continue;
                    if (!checkGenderCompatible(student, room)) continue;

                    if (room.layout && room.layout.length > 0) {
                        const grade = student.grade;
                        const allowedCount = room.layout.filter(g => g === grade).length;
                        const currentCount = room.students.filter(s => s.grade === grade).length;
                        if (currentCount >= allowedCount) continue;
                    }

                    assignStudentToRoom(student, roomInfo.dormitory, roomInfo.floor, roomInfo.room);
                    assigned = true;
                    // Track conflict pairs in this room
                    markConflictPairs(student, room);
                    break;
                }

                // Stage 2: 기피 무시, 레이아웃 무시. 성별만 존중
                if (!assigned) {
                    for (const roomInfo of availableRooms) {
                        const room = AppState.dormitories[roomInfo.dormitory].floors[roomInfo.floor].rooms[roomInfo.room];
                        if (room.students.length >= room.capacity) continue;
                        if (!checkGenderCompatible(student, room)) continue;

                        assignStudentToRoom(student, roomInfo.dormitory, roomInfo.floor, roomInfo.room);
                        assigned = true;
                        // Track conflict pairs in this room
                        markConflictPairs(student, room);
                        break;
                    }
                }
            }
        }
    }
}

/**
 * After force-assigning a student, record avoidance conflict pairs in the room.
 */
function markConflictPairs(student, room) {
    if (!room.conflictPairs) room.conflictPairs = [];
    const studentAvoids = AppState.avoidedPairs[student.name] || [];
    for (const roommate of room.students) {
        if (roommate.name === student.name) continue;
        const roommateAvoids = AppState.avoidedPairs[roommate.name] || [];
        if (studentAvoids.includes(roommate.name) || roommateAvoids.includes(student.name)) {
            // Avoid duplicate pairs
            const alreadyRecorded = room.conflictPairs.some(
                ([a, b]) => (a === student.name && b === roommate.name) || (a === roommate.name && b === student.name)
            );
            if (!alreadyRecorded) {
                room.conflictPairs.push([student.name, roommate.name]);
            }
        }
    }
}

function getAvailableRooms(scope, target, sortByOccupancy = true) {
    const rooms = [];

    if (scope === 'all') {
        // Get all rooms from all dormitories
        for (const [dormKey, dorm] of Object.entries(AppState.dormitories)) {
            for (const [floorNum, floor] of Object.entries(dorm.floors)) {
                for (const [roomNum, room] of Object.entries(floor.rooms)) {
                    if (room.students.length < room.capacity && !room.unused) {
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
                if (room.students.length < room.capacity && !room.unused) {
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
            if (room.students.length < room.capacity && !room.unused) {
                rooms.push({
                    dormitory: dormKey,
                    floor: floorNum,
                    room: roomNum
                });
            }
        }
    }

    // Shuffle for randomness (so rooms with equal number of students are randomly ordered)
    shuffleArray(rooms);

    if (sortByOccupancy) {
        // Sort rooms by the number of currently assigned students descending.
        // This fills already-occupied rooms first and maximizes the number of completely unused rooms.
        rooms.sort((a, b) => {
            const roomA = AppState.dormitories[a.dormitory].floors[a.floor].rooms[a.room];
            const roomB = AppState.dormitories[b.dormitory].floors[b.floor].rooms[b.room];
            return roomB.students.length - roomA.students.length;
        });
    }

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

/**
 * Check if a student's gender is compatible with a room.
 * This checks BOTH the floor/room gender setting AND the genders of existing students in the room.
 * A room is gender-fixed once the first student is assigned (if floor is mixed).
 */
function checkGenderCompatible(student, room) {
    // 1. Check floor/room gender constraint
    if (room.gender && room.gender !== 'mixed') {
        if (student.gender && student.gender !== room.gender) return false;
    }

    // 2. Critical: Check actual students already in the room (prevent mixed-gender rooms)
    if (student.gender && room.students.length > 0) {
        const existingGender = room.students[0].gender;
        if (existingGender && existingGender !== student.gender) {
            return false;
        }
    }

    return true;
}

function canAssignToRoom(studentName, room, pendingStudents = []) {
    const student = findStudent(studentName);
    if (!student) return { success: false, reason: '학생을 찾을 수 없습니다' };

    // 1. Check Room Gender Constraint (floor/room setting)
    if (room.gender && room.gender !== 'mixed') {
        if (student.gender && student.gender !== room.gender) {
            return { success: false, reason: `이 호실은 ${room.gender}학생 전용입니다 (학생 성별: ${student.gender})` };
        }
    }

    // 2. Critical: Check actual students already in the room - prevent mixed gender
    if (student.gender && room.students.length > 0) {
        const existingGender = room.students[0].gender;
        if (existingGender && existingGender !== student.gender) {
            return { success: false, reason: `이 호실에는 이미 ${existingGender}학생이 배치되어 있습니다` };
        }
    }

    // 3. Check pending students (students being assigned together in the same call)
    if (pendingStudents.length > 0 && student.gender) {
        for (const pending of pendingStudents) {
            if (pending.name === studentName) continue;
            if (pending.gender && pending.gender !== student.gender) {
                return { success: false, reason: '선호학생 그룹 내 성별이 혼합되어 있습니다' };
            }
        }
    }

    // 4. Check Grade Layout Constraint
    if (room.layout && room.layout.length > 0) {
        const grade = student.grade;
        const allowedCount = room.layout.filter(g => g === grade).length;
        const currentCount = room.students.filter(s => s.grade === grade).length;

        if (currentCount >= allowedCount) {
            return { success: false, reason: `호실 레이아웃에 배치 가능한 ${grade}학년 자리가 없습니다` };
        }
    }

    // 5. Check Avoided Students
    const studentAvoids = AppState.avoidedPairs[studentName] || [];

    for (const existingStudent of room.students) {
        // Case A: New student avoids existing student
        if (studentAvoids.includes(existingStudent.name)) {
            return { success: false, reason: `기피학생(${existingStudent.name})과의 배정은 제한됩니다` };
        }

        // Case B: Existing student avoids new student
        const existingStudentAvoids = AppState.avoidedPairs[existingStudent.name] || [];
        if (existingStudentAvoids.includes(studentName)) {
            return { success: false, reason: `상대 학생(${existingStudent.name})의 기피 대상입니다` };
        }
    }

    return { success: true };
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

/**
 * Returns a Map: studentName -> { colorIndex }
 * covering all preferred groups that have 2+ members in this room.
 * Each distinct group gets a unique colorIndex (0, 1, 2, ...).
 */
function getPreferredColorsForRoom(students) {
    const colorMap = new Map();
    if (!AppState.preferredGroups || students.length < 2) return colorMap;

    const studentNames = new Set(students.map(s => s.name));
    let colorIndex = 0;

    for (const group of AppState.preferredGroups) {
        const groupNames = new Set(group.students);
        const matched = students.filter(s => groupNames.has(s.name));
        if (matched.length >= 2) {
            for (const s of matched) {
                // If student is already in a color group, keep the first assignment
                if (!colorMap.has(s.name)) {
                    colorMap.set(s.name, { colorIndex });
                }
            }
            colorIndex++;
        }
    }
    return colorMap;
}

// Keep old function for backwards compatibility
function getPreferredGroupForRoom(students) {
    if (!AppState.preferredGroups || students.length < 2) return null;
    for (const group of AppState.preferredGroups) {
        const groupNames = new Set(group.students);
        const matched = students.filter(s => groupNames.has(s.name));
        if (matched.length >= 2) return group;
    }
    return null;
}
