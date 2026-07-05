// Node.js script to generate sample CSV files for 2026 and 2027 versions
// Run: node generate_sample.js
const fs = require('fs');

// Korean surnames and given names pools
const surnames = ['김','이','박','최','정','강','조','윤','장','임','한','오','서','권','황','송','전','양','고','신','문','배','백','변','성','손','안','엄','유','진','차','탁','하','허','홍','구','곽','남','도','류','모','반','방','설','소','심','옹','원','노','제','명','봉','천','표','함','현','기','길','류','맹','범','사','육','음','인','자','적','전','치','파','편','하','황'];
const maleGivenNames = ['민준','서준','도윤','예준','시우','지호','건우','우진','선우','도현','준서','준영','지후','현우','민재','하준','시원','유준','승우','재윤','태현','승혁','민성','준호','민규','시후','동욱','지환','우주','준혁','태양','민찬','동현','태민','건호','성민','재훈','우성','도훈','성진','민호','재영','성훈','태준','현석','준희','준형','서진','건호','준수','도경','시영','지훈','민호','시윤','태준','민석','지훈','태민','동현','우성','재현','승현','재민','재현','현우','태호','성민','우빈','재석','준형','성진','우진','재현','태민','성훈','우진','현우','태호','성준','우성','성민','재훈','성훈','태준','민석','성준','우진','재민','태호','준혁','성준','우진','태민'];
const femaleGivenNames = ['서연','지민','채원','다은','유나','서윤','민서','하은','예린','수아','지우','채은','지아','예은','윤서','민지','서현','하린','유진','지유','소율','서윤','예린','수민','하율','지원','예나','수빈','예원','서연','채율','지안','지은','다인','서윤','하영','서영','예진','예은','소율','지원','예린','다빈','서현','지아','지율','서하','예원','예빈','지연','하율','서율','다은','하은','서아','예솔','다율','하윤','다인','서율','지안','서율','다율','다빈','예진','서아','서윤','지율','서연','서영','하은','지연','다인','예린','하율','서현','예원','서윤','다인','지우','예나','하은','지연','서율','다빈','예은','서아','서윤','하율','지안','예린','서영','다은','하윤','서연','지율','예빈'];

function generateUniqueName(usedNames, gender) {
    const givenPool = gender === '남' ? maleGivenNames : femaleGivenNames;
    let attempts = 0;
    while (attempts < 500) {
        const surname = surnames[Math.floor(Math.random() * surnames.length)];
        const given = givenPool[Math.floor(Math.random() * givenPool.length)];
        const name = surname + given;
        if (!usedNames.has(name)) {
            usedNames.add(name);
            return name;
        }
        attempts++;
    }
    // fallback with number suffix
    const surname = surnames[Math.floor(Math.random() * surnames.length)];
    const given = givenPool[Math.floor(Math.random() * givenPool.length)];
    const name = surname + given + Math.floor(Math.random() * 99);
    usedNames.add(name);
    return name;
}

function generateStudents(maleCount, femaleCount) {
    const usedNames = new Set();
    const students = [];
    // 1학년: 1/3씩, 2학년: 1/3씩, 3학년: 1/3씩 (반올림)
    const gradeCount = Math.floor(maleCount / 3);
    const gradeCounts = [gradeCount, gradeCount, maleCount - gradeCount * 2];

    for (let g = 1; g <= 3; g++) {
        const cnt = gradeCounts[g - 1];
        for (let i = 0; i < cnt; i++) {
            students.push({ name: generateUniqueName(usedNames, '남'), grade: g, gender: '남' });
        }
    }

    const femaleGradeCounts = [Math.floor(femaleCount/3), Math.floor(femaleCount/3), femaleCount - Math.floor(femaleCount/3)*2];
    for (let g = 1; g <= 3; g++) {
        const cnt = femaleGradeCounts[g - 1];
        for (let i = 0; i < cnt; i++) {
            students.push({ name: generateUniqueName(usedNames, '여'), grade: g, gender: '여' });
        }
    }
    return students;
}

function generatePreferredGroups(students) {
    // 2학년 남자 10세트, 2학년 여자 10세트, 3학년 남자 10세트, 3학년 여자 10세트
    const groups = [];
    const male2 = students.filter(s => s.grade === 2 && s.gender === '남');
    const female2 = students.filter(s => s.grade === 2 && s.gender === '여');
    const male3 = students.filter(s => s.grade === 3 && s.gender === '남');
    const female3 = students.filter(s => s.grade === 3 && s.gender === '여');

    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length-1; i > 0; i--) {
            const j = Math.floor(Math.random()*(i+1));
            [a[i],a[j]] = [a[j],a[i]];
        }
        return a;
    }

    function makePairs(pool, count) {
        const shuffled = shuffle(pool);
        const pairs = [];
        for (let i = 0; i < count && i*2+1 < shuffled.length; i++) {
            pairs.push([shuffled[i*2], shuffled[i*2+1]]);
        }
        return pairs;
    }

    const allPairs = [
        ...makePairs(male2, 10),
        ...makePairs(female2, 10),
        ...makePairs(male3, 10),
        ...makePairs(female3, 10),
    ];

    return allPairs;
}

function generateAvoidedPairs(students) {
    // 각 학생당 최대 2명의 기피학생 (약 20% 학생만 지정)
    const avoided = [];
    const shuffle = (arr) => {
        const a = [...arr]; for (let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;
    };

    const shuffledStudents = shuffle(students);
    const targetCount = Math.floor(students.length * 0.2); // 20% 학생이 기피학생 지정

    for (let i = 0; i < targetCount; i++) {
        const student = shuffledStudents[i];
        // Pick 1-2 random students of same gender to avoid (to be realistic)
        const candidates = students.filter(s => s.name !== student.name && s.gender === student.gender);
        const shuffledCandidates = shuffle(candidates);
        const count = Math.random() > 0.5 ? 2 : 1;
        const avoided1 = shuffledCandidates[0];
        const avoided2 = count === 2 ? shuffledCandidates[1] : null;

        let row = `${student.name}(${student.grade}학년),${avoided1 ? avoided1.name+'('+avoided1.grade+'학년)' : ''},${avoided2 ? avoided2.name+'('+avoided2.grade+'학년)' : ''}`;
        avoided.push({
            student: student.name,
            grade: student.grade,
            avoided1: avoided1 ? avoided1.name : '',
            avoided1grade: avoided1 ? avoided1.grade : '',
            avoided2: avoided2 ? avoided2.name : '',
            avoided2grade: avoided2 ? avoided2.grade : '',
        });
    }
    return avoided;
}

function studentsToCSV(students) {
    let csv = '이름,학년,성별\n';
    for (const s of students) {
        csv += `${s.name},${s.grade},${s.gender}\n`;
    }
    return csv;
}

function preferredToCSV(pairs) {
    // New format: 학생1,학생2 with grade columns
    let csv = '학생1,학생1학년,학생2,학생2학년\n';
    for (const [a, b] of pairs) {
        csv += `${a.name},${a.grade},${b.name},${b.grade}\n`;
    }
    return csv;
}

function avoidedToCSV(avoided) {
    let csv = '학생이름,학생학년,기피학생1,기피학생1학년,기피학생2,기피학생2학년\n';
    for (const row of avoided) {
        csv += `${row.student},${row.grade},${row.avoided1},${row.avoided1grade},${row.avoided2},${row.avoided2grade}\n`;
    }
    return csv;
}

// Generate 2026 version: 248M + 248F
console.log('Generating 2026 sample data (248M + 248F)...');
const students2026 = generateStudents(248, 248);
const preferred2026 = generatePreferredGroups(students2026);
const avoided2026 = generateAvoidedPairs(students2026);

fs.writeFileSync('sample_students_2026.csv', studentsToCSV(students2026), 'utf8');
fs.writeFileSync('sample_preferred_2026.csv', preferredToCSV(preferred2026), 'utf8');
fs.writeFileSync('sample_avoided_2026.csv', avoidedToCSV(avoided2026), 'utf8');
console.log(`2026: students=${students2026.length}, preferred_pairs=${preferred2026.length}, avoided_entries=${avoided2026.length}`);

// Generate 2027 version: 320M + 320F
console.log('Generating 2027 sample data (320M + 320F)...');
const students2027 = generateStudents(320, 320);
const preferred2027 = generatePreferredGroups(students2027);
const avoided2027 = generateAvoidedPairs(students2027);

fs.writeFileSync('sample_students_2027.csv', studentsToCSV(students2027), 'utf8');
fs.writeFileSync('sample_preferred_2027.csv', preferredToCSV(preferred2027), 'utf8');
fs.writeFileSync('sample_avoided_2027.csv', avoidedToCSV(avoided2027), 'utf8');
console.log(`2027: students=${students2027.length}, preferred_pairs=${preferred2027.length}, avoided_entries=${avoided2027.length}`);

console.log('Done!');
