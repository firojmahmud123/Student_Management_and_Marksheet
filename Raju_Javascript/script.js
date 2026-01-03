// Firebase config & initialization
const firebaseConfig = {
  apiKey: "AIzaSyCNLkInniFX6qQaKrqumFwpbIULR1X7GBA",
  authDomain: "student-management-5ab93.firebaseapp.com",
  projectId: "student-management-5ab93",
  storageBucket: "student-management-5ab93.appspot.com",
  messagingSenderId: "297632258118",
  appId: "1:297632258118:web:f83c361be4f4d42208d247"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Auth State
let currentUser = null;

// --- Helper Functions ---
function getGradePoint(marks, max) {
  const p = max ? (marks / max) * 100 : 0;
  if (p >= 80) return { lg: 'A+', gp: 4.00 };
  if (p >= 75) return { lg: 'A', gp: 3.75 };
  if (p >= 70) return { lg: 'A-', gp: 3.50 };
  if (p >= 65) return { lg: 'B+', gp: 3.25 };
  if (p >= 60) return { lg: 'B', gp: 3.00 };
  if (p >= 55) return { lg: 'B-', gp: 2.75 };
  if (p >= 50) return { lg: 'C+', gp: 2.50 };
  if (p >= 45) return { lg: 'C', gp: 2.25 };
  if (p >= 40) return { lg: 'D', gp: 2.00 };
  return { lg: 'F', gp: 0.00 };
}

// --- Auth ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const msg = document.getElementById('login-message');
  msg.textContent = '';
  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    currentUser = cred.user;
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('user-info').textContent = `Logged in: ${currentUser.email}`;
    renderAttendanceTable();
    renderAllMarksheets();
  } catch (err) {
    msg.textContent = err.message;
  }
});

// Register Button
document.getElementById('register-btn').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const msg = document.getElementById('login-message');
  msg.textContent = '';
  if (!email || !password) return msg.textContent = 'Enter email & password';
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    currentUser = cred.user;
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('user-info').textContent = `Logged in: ${currentUser.email}`;
    alert('Registration successful!');
  } catch (err) {
    msg.textContent = err.message;
  }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
  auth.signOut();
  currentUser = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-section').style.display = 'block';
  document.getElementById('login-form').reset();
  document.getElementById('user-info').textContent = '';
});

// --- Students & Courses ---
async function saveStudent(e) {
  e.preventDefault();
  const id = document.getElementById('student-id').value.trim();
  const name = document.getElementById('student-name').value.trim();
  const email = document.getElementById('student-email').value.trim();

  if (!id || !name) return alert('ID and Name required');
  try {
    await db.collection('students').doc(id).set({ name, email });
    alert('Student saved!');
    document.getElementById('student-form').reset();
    renderAttendanceTable();
    renderAllMarksheets();
  } catch (err) {
    alert('Error saving student: ' + err.message);
  }
}

async function saveCourse(e) {
  e.preventDefault();
  const studentId = document.getElementById('course-student-id').value.trim();
  const code = document.getElementById('course-code').value.trim();
  const title = document.getElementById('course-title').value.trim();
  const credit = parseFloat(document.getElementById('course-credit').value) || 3;
  const max = parseFloat(document.getElementById('course-max').value) || 100;
  const marks = parseFloat(document.getElementById('course-marks').value) || 0;

  if (!studentId || !code || !title) return alert('Student ID, Course Code and Title required');

  try {
    const courseRef = db.collection('students').doc(studentId).collection('courses').doc(code);
    await courseRef.set({ title, credit, max, marks });
    alert('Course saved!');
    document.getElementById('course-form').reset();
    showMarksheet(studentId);
    renderAllMarksheets();
  } catch (err) {
    alert('Error saving course: ' + err.message);
  }
}
// Toggle attendance for a student
async function toggleAttendance(studentId, date) {
  console.log('Toggling attendance for:', studentId, 'on date:', date);

  try {
    const ref = db.collection('students').doc(studentId);
    const docSnap = await ref.get();

    if (!docSnap.exists) {
      console.warn('Student not found:', studentId);
      return;
    }

    const data = docSnap.data();
    console.log('Current attendance before toggle:', data.attendance);

    const attendance = data.attendance || {};
    attendance[date] = !attendance[date]; // toggle

    console.log('Updating attendance to:', attendance);

    await ref.update({ attendance });

    console.log('Attendance updated in Firestore');

    // Re-render table
    await renderAttendanceTable(date);
  } catch (err) {
    console.error('Error toggling attendance:', err);
  }
}

// Render attendance table
async function renderAttendanceTable(date) {
  console.log('Rendering attendance table for date:', date);

  const tbody = document.getElementById('attendance-tbody');
  if (!tbody) {
    console.error('attendance-tbody element not found!');
    return;
  }

  tbody.innerHTML = '';

  try {
    const snapshot = await db.collection('students').get();
    console.log('Fetched students:', snapshot.docs.map(d => d.id));

    snapshot.forEach(doc => {
      const s = doc.data();
      const att = s.attendance || {};
      const isPresent = att[date] || false;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${doc.id}</td>
        <td>${s.name}</td>
        <td>${isPresent ? 'Yes' : 'No'}</td>
        <td>
          <button class="btn" onclick="toggleAttendance('${doc.id}','${date}')">Toggle</button>
        </td>
      `;
      tbody.appendChild(tr);

      console.log('Rendered row for:', doc.id, 'Attendance:', isPresent);
    });
  } catch (err) {
    console.error('Error rendering attendance table:', err);
  }
}

// Mark all present/absent
async function markAllAttendance(date, present) {
  console.log('Marking all students', present ? 'present' : 'absent', 'for date:', date);

  try {
    const snapshot = await db.collection('students').get();
    const batch = db.batch();

    snapshot.forEach(doc => {
      const ref = db.collection('students').doc(doc.id);
      const attendance = doc.data().attendance || {};
      attendance[date] = present;
      batch.update(ref, { attendance });
    });

    await batch.commit();
    console.log('All students updated');

    await renderAttendanceTable(date);
  } catch (err) {
    console.error('Error marking all attendance:', err);
  }
}



document.getElementById('mark-all-present').addEventListener('click', async () => {
  const date = document.getElementById('att-date').value;
  if (!date) return alert('Select a date first');
  await markAllAttendance(date, true);
});

document.getElementById('mark-all-absent').addEventListener('click', async () => {
  const date = document.getElementById('att-date').value;
  if (!date) return alert('Select a date first');
  await markAllAttendance(date, false);
});


// --- Marksheet ---
document.getElementById('save-student-btn').addEventListener('click', saveStudent);
document.getElementById('save-course-btn').addEventListener('click', saveCourse);

// Show individual marksheet
async function showMarksheet(studentId) {
  const studentDoc = await db.collection('students').doc(studentId).get();
  if (!studentDoc.exists) return alert('Student not found');
  const student = studentDoc.data();
  const coursesSnap = await db.collection('students').doc(studentId).collection('courses').get();
  const courses = [];
  let totalCredits = 0, totalGP = 0;
  coursesSnap.forEach(c => {
    const data = c.data();
    const { lg, gp } = getGradePoint(data.marks, data.max);
    courses.push({ code: c.id, ...data, lg, gp });
    totalCredits += data.credit;
    totalGP += data.credit * gp;
  });
  const sgpa = totalCredits ? (totalGP / totalCredits).toFixed(2) : '0.00';

  let rowsHtml = '';
  courses.forEach(c => {
    rowsHtml += `<tr>
      <td>${c.code}</td>
      <td>${c.title}</td>
      <td>${c.credit.toFixed(2)}</td>
      <td>${c.marks}/${c.max}</td>
      <td>${c.lg}</td>
      <td>${c.gp.toFixed(2)}</td>
    </tr>`;
  });

  document.getElementById('individual-marksheet').innerHTML = `
    <h4>Marksheet for ${student.name} (${studentId})</h4>
    <table border="1" style="width:100%; border-collapse:collapse;">
      <thead>
        <tr>
          <th>Course Code</th>
          <th>Title</th>
          <th>Credit</th>
          <th>Marks</th>
          <th>LG</th>
          <th>GP</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    <div style="margin-top:10px;">
      <strong>Total Credits:</strong> ${totalCredits.toFixed(2)} | <strong>CGPA:</strong> ${sgpa}
    </div>
  `;
}

// Generate all marksheets
async function renderAllMarksheets() {
  const snapshot = await db.collection('students').get();
  const area = document.getElementById('marksheet-area');
  area.innerHTML = '';
  snapshot.forEach(async doc => {
    const studentId = doc.id;
    await showMarksheetAll(studentId, area);
  });
}

async function showMarksheetAll(studentId, area) {
  const studentDoc = await db.collection('students').doc(studentId).get();
  if (!studentDoc.exists) return;
  const student = studentDoc.data();
  const coursesSnap = await db.collection('students').doc(studentId).collection('courses').get();
  const courses = [];
  let totalCredits = 0, totalGP = 0;
  coursesSnap.forEach(c => {
    const data = c.data();
    const { lg, gp } = getGradePoint(data.marks, data.max);
    courses.push({ code: c.id, ...data, lg, gp });
    totalCredits += data.credit;
    totalGP += data.credit * gp;
  });
  const sgpa = totalCredits ? (totalGP / totalCredits).toFixed(2) : '0.00';
  let rowsHtml = '';
  courses.forEach(c => {
    rowsHtml += `<tr>
      <td>${c.code}</td>
      <td>${c.title}</td>
      <td>${c.credit.toFixed(2)}</td>
      <td>${c.marks}/${c.max}</td>
      <td>${c.lg}</td>
      <td>${c.gp.toFixed(2)}</td>
    </tr>`;
  });
  area.innerHTML += `
    <h4>${student.name} (${studentId})</h4>
    <table border="1" style="width:100%; border-collapse:collapse;">
      <thead>
        <tr>
          <th>Course Code</th>
          <th>Title</th>
          <th>Credit</th>
          <th>Marks</th>
          <th>LG</th>
          <th>GP</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    <div style="margin-bottom:20px;"><strong>Total Credits:</strong> ${totalCredits.toFixed(2)} | <strong>CGPA:</strong> ${sgpa}</div>
  `;
}

// Search marksheet by ID
document.getElementById('search-marksheet-btn').addEventListener('click', () => {
  const id = document.getElementById('marksheet-search-id').value.trim();
  if (!id) return alert('Enter student ID');
  showMarksheet(id);
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.getElementById(e.target.dataset.tab + '-tab').style.display = 'block';
    if (e.target.dataset.tab === 'attendance') renderAttendanceTable();
  });
});

// Reset buttons
document.getElementById('reset-student-btn').addEventListener('click', () => document.getElementById('student-form').reset());
document.getElementById('reset-course-btn').addEventListener('click', () => document.getElementById('course-form').reset());

