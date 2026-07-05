// ===== File Handling Module =====

function handleStudentListFile(file) {
    showLoading(true);

    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const content = e.target.result;

            // Parse CSV
            Papa.parse(content, {
                header: true,
                skipEmptyLines: true,
                complete: function (results) {
                    parseStudentList(results.data);
                    showLoading(false);
                    showToast(`${AppState.students.length}명의 학생 데이터를 불러왔습니다`, 'success');
                    updateStats();
                    renderUnassignedList();
                },
                error: function (error) {
                    showLoading(false);
                    showToast(`파일 파싱 오류: ${error.message}`, 'error');
                }
            });
        } catch (error) {
            showLoading(false);
            showToast(`파일 읽기 오류: ${error.message}`, 'error');
        }
    };

    reader.onerror = function () {
        showLoading(false);
        showToast('파일을 읽을 수 없습니다', 'error');
    };

    reader.readAsText(file);
}

function parseStudentList(data) {
    AppState.students = [];

    for (const row of data) {
        // Expected columns: 이름, 학년, 성별
        const name = row['이름'] || row['name'] || row['Name'];
        const grade = row['학년'] || row['grade'] || row['Grade'];
        const gender = row['성별'] || row['gender'] || row['Gender'];

        if (name && name.trim()) {
            AppState.students.push({
                name: name.trim(),
                grade: grade ? parseInt(grade) : null,
                gender: gender ? gender.trim() : null,
                assigned: false,
                dormitory: null,
                floor: null,
                room: null
            });
        }
    }
}

function handlePreferredFile(file) {
    showLoading(true);

    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const content = e.target.result;

            Papa.parse(content, {
                header: true,
                skipEmptyLines: true,
                complete: function (results) {
                    parsePreferredGroups(results.data);
                    showLoading(false);
                    showToast(`${AppState.preferredGroups.length}개의 선호학생 그룹을 불러왔습니다`, 'success');
                },
                error: function (error) {
                    showLoading(false);
                    showToast(`파일 파싱 오류: ${error.message}`, 'error');
                }
            });
        } catch (error) {
            showLoading(false);
            showToast(`파일 읽기 오류: ${error.message}`, 'error');
        }
    };

    reader.onerror = function () {
        showLoading(false);
        showToast('파일을 읽을 수 없습니다', 'error');
    };

    reader.readAsText(file);
}

function parsePreferredGroups(data) {
    AppState.preferredGroups = [];

    for (const row of data) {
        const students = [];

        // New format: 학생1, 학생1학년, 학생2, 학생2학년 (2-person pairs)
        // Old format: 학생1, 학생2, 학생3, 학생4
        const hasGradeColumns = Object.keys(row).some(k => k.includes('학년'));

        if (hasGradeColumns) {
            // New grade-aware format
            for (let i = 1; i <= 4; i++) {
                const studentName = row[`학생${i}`] || row[`student${i}`];
                const studentGrade = row[`학생${i}학년`] || row[`grade${i}`];
                if (studentName && studentName.trim()) {
                    const grade = studentGrade ? parseInt(studentGrade) : null;
                    // Find matching student by name AND grade
                    const found = AppState.students.find(s =>
                        s.name === studentName.trim() && (grade === null || s.grade === grade)
                    );
                    if (found) {
                        students.push(found.name);
                    } else {
                        students.push(studentName.trim());
                    }
                }
            }
        } else {
            // Legacy format (no grade columns)
            for (let i = 1; i <= 4; i++) {
                const studentName = row[`학생${i}`] || row[`student${i}`] || row[`Student${i}`];
                if (studentName && studentName.trim()) {
                    students.push(studentName.trim());
                }
            }
        }

        if (students.length >= 2) {
            AppState.preferredGroups.push({
                students: students,
                assignedRoom: null
            });
        }
    }
}

function handleAvoidedFile(file) {
    showLoading(true);

    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const content = e.target.result;

            Papa.parse(content, {
                header: true,
                skipEmptyLines: true,
                complete: function (results) {
                    parseAvoidedPairs(results.data);
                    showLoading(false);
                    showToast(`기피학생 데이터를 불러왔습니다`, 'success');
                },
                error: function (error) {
                    showLoading(false);
                    showToast(`파일 파싱 오류: ${error.message}`, 'error');
                }
            });
        } catch (error) {
            showLoading(false);
            showToast(`파일 읽기 오류: ${error.message}`, 'error');
        }
    };

    reader.onerror = function () {
        showLoading(false);
        showToast('파일을 읽을 수 없습니다', 'error');
    };

    reader.readAsText(file);
}

function parseAvoidedPairs(data) {
    AppState.avoidedPairs = {};

    for (const row of data) {
        // New format: 학생이름, 학생학년, 기피학생1, 기피학생1학년, 기피학생2, 기피학생2학년
        // Old format: 학생이름(or 학생 or name), 기피학생1, 기피학생2
        const hasGradeColumns = Object.keys(row).some(k => k.includes('학년'));

        const studentName = row['학생이름'] || row['학생'] || row['name'] || row['Name'];
        if (!studentName || !studentName.trim()) continue;

        const trimmedName = studentName.trim();

        // Resolve key: if grade provided, use "name(grade학년)" only if duplicates exist
        // But for simplicity, use name as key and match by name when assigning
        const avoided = [];

        if (hasGradeColumns) {
            const avoided1 = row['기피학생1'] || row['avoided1'];
            const avoided1grade = row['기피학생1학년'];
            const avoided2 = row['기피학생2'] || row['avoided2'];
            const avoided2grade = row['기피학생2학년'];

            if (avoided1 && avoided1.trim()) {
                // Find the correct student (grade-aware)
                const g1 = avoided1grade ? parseInt(avoided1grade) : null;
                const found1 = AppState.students.find(s =>
                    s.name === avoided1.trim() && (g1 === null || s.grade === g1)
                );
                avoided.push(found1 ? found1.name : avoided1.trim());
            }
            if (avoided2 && avoided2.trim()) {
                const g2 = avoided2grade ? parseInt(avoided2grade) : null;
                const found2 = AppState.students.find(s =>
                    s.name === avoided2.trim() && (g2 === null || s.grade === g2)
                );
                avoided.push(found2 ? found2.name : avoided2.trim());
            }
        } else {
            const avoided1 = row['기피학생1'] || row['avoided1'] || row['Avoided1'];
            const avoided2 = row['기피학생2'] || row['avoided2'] || row['Avoided2'];
            if (avoided1 && avoided1.trim()) avoided.push(avoided1.trim());
            if (avoided2 && avoided2.trim()) avoided.push(avoided2.trim());
        }

        if (avoided.length > 0) {
            // Support grade-aware key: if same name exists multiple times, use grade suffix
            const studentGrade = row['학생학년'];
            const g = studentGrade ? parseInt(studentGrade) : null;
            const matchedStudent = AppState.students.find(s =>
                s.name === trimmedName && (g === null || s.grade === g)
            );
            const key = matchedStudent ? matchedStudent.name : trimmedName;
            AppState.avoidedPairs[key] = avoided;
        }
    }
}
