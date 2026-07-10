// ===== Export to Excel Module =====

function exportToExcel() {
    const workbook = XLSX.utils.book_new();

    // Create a sheet for each dormitory
    for (const [dormKey, dorm] of Object.entries(AppState.dormitories)) {
        const sheetData = [];

        // Add header
        sheetData.push([`${dorm.name} 방 배치표`]);
        sheetData.push([]);

        // Process each floor
        for (const [floorNum, floor] of Object.entries(dorm.floors)) {
            sheetData.push([`${floorNum}층`]);
            sheetData.push(['호실', '학생1', '학년', '성별', '학생2', '학년', '성별', '학생3', '학년', '성별', '학생4', '학년', '성별']);

            // Get rooms sorted by number
            const rooms = Object.values(floor.rooms).sort((a, b) =>
                parseInt(a.number) - parseInt(b.number)
            );

            for (const room of rooms) {
                const row = [`${room.number}호`];

                // Sort students: by grade asc, then name asc (matching the Room Card UI sort order)
                const sortedStudents = [...room.students].sort((a, b) => {
                    if ((a.grade || 0) !== (b.grade || 0)) return (a.grade || 0) - (b.grade || 0);
                    return (a.name || '').localeCompare(b.name || '', 'ko');
                });

                // Add students (up to 4)
                for (let i = 0; i < 4; i++) {
                    if (i < sortedStudents.length) {
                        const student = sortedStudents[i];
                        row.push(student.name, student.grade || '-', student.gender || '-');
                    } else {
                        row.push('-', '-', '-');
                    }
                }

                sheetData.push(row);
            }

            sheetData.push([]); // Empty row between floors
        }

        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

        // Set column widths
        worksheet['!cols'] = [
            { wch: 10 },  // 호실
            { wch: 12 },  // 학생1
            { wch: 6 },   // 학년
            { wch: 6 },   // 성별
            { wch: 12 },  // 학생2
            { wch: 6 },   // 학년
            { wch: 6 },   // 성별
            { wch: 12 },  // 학생3
            { wch: 6 },   // 학년
            { wch: 6 },   // 성별
            { wch: 12 },  // 학생4
            { wch: 6 },   // 학년
            { wch: 6 }    // 성별
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, dorm.name);
    }

    // Create summary sheet
    const summaryData = [];
    summaryData.push(['기숙사 배치 현황 요약']);
    summaryData.push([]);
    summaryData.push(['구분', '값']);
    summaryData.push(['총 학생 수', AppState.students.length]);
    summaryData.push(['배치 완료', getAssignedStudents().length]);
    summaryData.push(['미배치', getUnassignedStudents().length]);
    summaryData.push([]);

    // Add unassigned students if any
    const unassigned = getUnassignedStudents();
    if (unassigned.length > 0) {
        summaryData.push(['미배치 학생 목록']);
        summaryData.push(['이름', '학년', '성별']);

        for (const student of unassigned) {
            summaryData.push([student.name, student.grade || '-', student.gender || '-']);
        }
    }

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 10 }];

    XLSX.utils.book_append_sheet(workbook, summarySheet, '요약', true);

    // Generate filename with current date
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const filename = `기숙사_방배치_${dateStr}.xlsx`;

    // Download file with proper format
    XLSX.writeFile(workbook, filename, { bookType: 'xlsx', type: 'binary' });
}
