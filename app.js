/* Tank Shell Thickness Calculator
   Formulas are ported from the supplied workbook's Retiring Thickness and Allowable Stress sheets.
   Material basis currently included: IS 2062 Grade BR/B0 (E250), as present in the workbook.
*/
const $ = (id) => document.getElementById(id);
const MAX_COURSES = 18;
const DEFAULT_HEIGHTS = [2, 1.6, 2.5, 2, 1.3, 1.3, 0.7, 0.7];
let activeTab = 'design';

for (let n = 1; n <= MAX_COURSES; n++) $('courseCount').add(new Option(String(n), String(n)));
$('courseCount').value = '8';

function makeCourseRows() {
  const count = Number($('courseCount').value);
  const old = [...document.querySelectorAll('.course-height')].map(el => el.value);
  $('courseRows').innerHTML = '';
  for (let i = 0; i < count; i++) {
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    const inputCell = document.createElement('td');
    const label = document.createElement('label');
    label.textContent = `${ordinal(i + 1)} Shell Course`;
    label.htmlFor = `course-${i}`;
    const input = document.createElement('input');
    input.type = 'number'; input.min = '0'; input.step = '0.01';
    input.id = `course-${i}`; input.className = 'course-height';
    input.value = old[i] ?? DEFAULT_HEIGHTS[i] ?? '1.0';
    input.setAttribute('aria-label', `${ordinal(i + 1)} shell course height in metres`);
    input.addEventListener('input', calculate);
    name.appendChild(label); inputCell.appendChild(input);
    tr.append(name, inputCell); $('courseRows').appendChild(tr);
  }
  $('courseSummary').textContent = `${count} course${count === 1 ? '' : 's'} configured`;
  calculate();
}
function ordinal(n) { const s = ['th','st','nd','rd'], v = n % 100; return n + (s[(v-20)%10] || s[v] || s[0]); }
function num(id) { return Number($(id).value); }
function fmt(value) { return Number.isFinite(value) ? value.toFixed(2) : '—'; }
function safeDiv(a,b) { return b ? a/b : NaN; }

function calculate() {
  const D = num('diameter'), H = num('tankHeight'), CA = num('corrosionAllowance');
  const G = num('specificGravity'), E = Number($('radiography').value);
  $('jointEfficiency').value = E.toFixed(2);
  const heights = [...document.querySelectorAll('.course-height')].map(el => Number(el.value));
  const sum = heights.reduce((a,b) => a + (Number.isFinite(b) ? b : 0), 0);
  const diff = sum - H;
  if (Math.abs(diff) > 0.01) {
    $('heightCheck').textContent = `Note: Sum of entered course heights is ${fmt(sum)} m, while tank height is ${fmt(H)} m (difference ${fmt(diff)} m). Check the input values.`;
    $('heightCheck').className = 'height-check warning';
  } else {
    $('heightCheck').textContent = `Total course height: ${fmt(sum)} m — matches tank height.`;
    $('heightCheck').className = 'height-check';
  }
  const valid = D > 0 && H > 0 && G > 0 && E > 0 && CA >= 0 && heights.every(h => h > 0);
  if (!valid) { $('resultPanel').innerHTML = '<p class="muted">Enter positive values for tank dimensions, specific gravity and each course height. Corrosion allowance may be zero.</p>'; return; }

  // Allowable stresses derived from Allowable Stress! row 6 in the supplied workbook.
  const Ts = 410, Ys = 250;
  const api650Sd = Math.min(2/3 * Ys, 2/5 * Ts); // workbook P6 = 2/5 Ts
  const api650St = Math.min(3/4 * Ys, 3/7 * Ts); // workbook Q6 = 3/7 Ts
  const is803Product = 0.4 * Ts;                 // workbook S6
  const is803Hydro = 3/7 * Ts;                  // workbook T6
  const api653Lower = 0.429 * Ts;               // workbook U6
  const api653Other = 0.472 * Ts;               // workbook V6
  const is9964Stress = 0.8 * Ys;                // workbook W6

  let liquidHead = H;
  const results = heights.map((courseHeight, i) => {
    const h = liquidHead;
    // Design thickness: workbook rows 20 onward, including the 5 mm minimum.
    const waterSG = 1; // workbook column G is fixed at 1.0 (water specific gravity)
    const is803ProductT = 4.9 * D * waterSG * (h - 0.3) / (is803Product * E) + CA;
    const is803HydroT = 4.9 * D * waterSG * (h - 0.3) / is803Hydro;
    const is803 = Math.max(is803ProductT, is803HydroT, 5);
    const api650ProductT = 4.9 * D * (h - 0.3) * G / api650Sd + CA;
    const api650HydroT = 4.9 * D * (h - 0.3) * waterSG / api650St;
    const api650 = Math.max(api650ProductT, api650HydroT, 5);

    // Entire-shell retiring thickness. API 653 stress changes after the lower two courses.
    const api653Stress = i < 2 ? api653Lower : api653Other;
    const circular = safeDiv(4.9 * D * (h - 0.3) * waterSG, 176 * E);
    const api653 = safeDiv(4.9 * D * G * (h - 0.3), api653Stress * E);
    const is9964 = safeDiv(4.9 * D * G * (h - 0.3), is9964Stress * E);

    // Local corroded-plate retirement values from workbook columns AD and AE.
    // Workbook columns AD/AE reference the lower-two-course API 653 stress (M) for both local checks.
    const away = safeDiv(4.9 * D * h * G, api653Lower);
    const near = safeDiv(4.9 * D * h * G, api653Lower * E);
    const row = { course: ordinal(i + 1), height: courseHeight, head: h, is803, api650, circular, api653, is9964, away, near };
    liquidHead -= courseHeight;
    return row;
  });
  renderResults(results);
}

function renderResults(rows) {
  const config = {
    design: { title: 'Design Thickness (mm)', subtitle: 'Minimum required design thickness for each shell course.', cols: [['is803','As per IS 803'],['api650','As per API 650']] },
    entire: { title: 'Retiring Thickness of Entire Shell (mm)', subtitle: 'Retiring thickness calculated for the entire shell using the methods in the workbook.', cols: [['circular','As per Circular M&I/19 dated 30.05.1994'],['api653','As per API 653'],['is9964','As per IS-9964 Part-II, 1981']] },
    corroded: { title: 'Retiring Thickness of Specific Area of a Corroded Plate as per API 653 (mm)', subtitle: 'Local shell-plate retiring thickness; refer to the away-from-weld and near-weld definitions in the source workbook.', cols: [['away','Away from weld*'],['near','Near weld*']] }
  }[activeTab];
  const table = document.createElement('table'); table.className = 'result-table';
  const thead = document.createElement('thead'); const hr = document.createElement('tr');
  ['Shell course','Course height (m)',...config.cols.map(c=>c[1])].forEach(t=>{const th=document.createElement('th');th.textContent=t;hr.appendChild(th);});
  thead.appendChild(hr); table.appendChild(thead);
  const tbody = document.createElement('tbody');
  rows.forEach(row=>{
    const tr=document.createElement('tr');
    const course=document.createElement('td');course.textContent=row.course;tr.appendChild(course);
    const height=document.createElement('td');height.textContent=fmt(row.height);tr.appendChild(height);
    config.cols.forEach(([key])=>{const td=document.createElement('td');const span=document.createElement('span');span.className='value-pill';span.textContent=fmt(row[key]);td.appendChild(span);tr.appendChild(td);});
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const panel=$('resultPanel');panel.innerHTML='';
  const title=document.createElement('h3');title.className='result-title';title.textContent=config.title;
  const sub=document.createElement('p');sub.className='result-subtitle';sub.textContent=config.subtitle;
  const wrap=document.createElement('div');wrap.className='course-table-wrap';wrap.appendChild(table);
  panel.append(title,sub,wrap);
}

document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{
  activeTab=tab.dataset.tab;
  document.querySelectorAll('.tab').forEach(t=>{const active=t===tab;t.classList.toggle('active',active);t.setAttribute('aria-selected',String(active));});
  calculate();
}));
['diameter','tankHeight','corrosionAllowance','specificGravity','radiography'].forEach(id=>$(id).addEventListener('input',calculate));
$('courseCount').addEventListener('change',makeCourseRows);
$('resetBtn').addEventListener('click',()=>{
  $('diameter').value=32; $('tankHeight').value=13; $('radiography').value='0.85';
  $('corrosionAllowance').value=1.5; $('specificGravity').value=0.85; $('courseCount').value='8';
  makeCourseRows();
});
makeCourseRows();
