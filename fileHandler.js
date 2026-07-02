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

        // Expected columns: 자치위원학년, 학생1, 학생2, 학생3, 학생4
        // Or: grade, student1, student2, student3, student4
        const grade = row['자치위원학년'] || row['grade'] || row['Grade'];

        for (let i = 1; i <= 4; i++) {
            const studentName = row[`학생${i}`] || row[`student${i}`] || row[`Student${i}`];
            if (studentName && studentName.trim()) {
                students.push(studentName.trim());
            }
        }

        if (students.length > 0) {
            AppState.preferredGroups.push({
                grade: grade ? parseInt(grade) : null,
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
        // Expected columns: 학생이름, 기피학생1, 기피학생2
        const studentName = row['학생이름'] || row['name'] || row['Name'];

        if (studentName && studentName.trim()) {
            const avoided = [];

            const avoided1 = row['기피학생1'] || row['avoided1'] || row['Avoided1'];
            const avoided2 = row['기피학생2'] || row['avoided2'] || row['Avoided2'];

            if (avoided1 && avoided1.trim()) {
                avoided.push(avoided1.trim());
            }
            if (avoided2 && avoided2.trim()) {
                avoided.push(avoided2.trim());
            }

            if (avoided.length > 0) {
                AppState.avoidedPairs[studentName.trim()] = avoided;
            }
        }
    }
}
