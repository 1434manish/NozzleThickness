(() => {
  const $ = id => document.getElementById(id);

  // -------------------- Tab navigation --------------------
  const nozzleTab = $('nozzle-tab');
  const manholeTab = $('manhole-tab');
  const shellTab = $('shell-tab');
  const nozzlePanel = $('nozzle-panel');
  const manholePanel = $('manhole-panel');
  const shellPanel = $('shell-panel');

  function activateTab(which) {
    const active = { nozzle: which === 'nozzle', manhole: which === 'manhole', shell: which === 'shell' };
    [[nozzleTab, nozzlePanel, active.nozzle], [manholeTab, manholePanel, active.manhole], [shellTab, shellPanel, active.shell]].forEach(([tab, panel, isActive]) => {
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
      panel.hidden = !isActive;
    });
  }
  nozzleTab.addEventListener('click', () => activateTab('nozzle'));
  manholeTab.addEventListener('click', () => activateTab('manhole'));
  shellTab.addEventListener('click', () => activateTab('shell'));

  // -------------------- Nozzle thickness calculator --------------------
  const diameterInput = $('diameter');
  const averageInput = $('average');
  const scheduleOutput = $('schedule');
  const thicknessOutput = $('thickness');
  const nextScheduleOutput = $('next-schedule');
  const nextThicknessOutput = $('next-thickness');
  const message = $('message');
  const dataStatus = $('data-status');
  const retiringOutput = $('retiring-thickness');
  const retiringStatus = $('retiring-status');
  let entries = [];

  const retiringTable = { 80: 4.80, 100: 5.27, 150: 6.22, 200: 7.16, 250: 8.11 };

  function getRetiringThickness(size) {
    if (retiringTable[size] !== undefined) return retiringTable[size];
    if (size >= 300) return 8.34;
    return null;
  }

  function parseCsv(text) {
    const cleanText = text.replace(/^\uFEFF/, '').trim();
    const lines = cleanText.split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const sizeIndex = headers.indexOf('size_mm');
    const scheduleIndex = headers.indexOf('schedule');
    const thicknessIndex = headers.indexOf('thickness_mm');
    if (sizeIndex < 0 || scheduleIndex < 0 || thicknessIndex < 0) {
      throw new Error('CSV headers do not match the expected format.');
    }
    return lines.slice(1).map(line => {
      const parts = line.split(',');
      const size = Number(parts[sizeIndex]?.trim());
      const schedule = parts[scheduleIndex]?.trim();
      const thickness = Number(parts[thicknessIndex]?.trim());
      if (!Number.isFinite(size) || !Number.isFinite(thickness) || !schedule) return null;
      return { size, schedule, thickness };
    }).filter(Boolean);
  }

  function showEmpty(text) {
    scheduleOutput.textContent = '—';
    thicknessOutput.textContent = '—';
    nextScheduleOutput.textContent = '—';
    nextThicknessOutput.textContent = '—';
    message.textContent = text;
  }

  function updateRetiringAssessment() {
    const sizeText = diameterInput.value.trim();
    const averageText = averageInput.value.trim();
    retiringStatus.className = 'retiring-status';
    if (!sizeText) {
      retiringOutput.textContent = '—';
      retiringStatus.textContent = 'Enter nozzle diameter and average thickness.';
      return;
    }
    const size = Number(sizeText);
    if (!(size > 0)) {
      retiringOutput.textContent = '—';
      retiringStatus.textContent = 'Please enter a valid nozzle diameter.';
      return;
    }
    const retiringThickness = getRetiringThickness(size);
    if (retiringThickness === null) {
      retiringOutput.textContent = '—';
      retiringStatus.textContent = 'Retiring thickness not defined for this diameter.';
      return;
    }
    retiringOutput.textContent = `${retiringThickness.toFixed(2)} mm`;
    if (!averageText) {
      retiringStatus.textContent = 'Enter average thickness to assess nozzle condition.';
      return;
    }
    const average = Number(averageText);
    if (!(average > 0)) {
      retiringStatus.textContent = 'Please enter a valid average thickness.';
      return;
    }
    if (average >= retiringThickness) {
      retiringStatus.textContent = 'Nozzle thickness satisfactory';
      retiringStatus.classList.add('satisfactory');
    } else {
      retiringStatus.textContent = 'Nozzle replacement required !!!';
      retiringStatus.classList.add('replacement');
    }
  }

  function calculate() {
    const sizeText = diameterInput.value.trim();
    const avgText = averageInput.value.trim();
    updateRetiringAssessment();
    if (!sizeText || !avgText) {
      showEmpty('Enter diameter and average thickness.');
      return;
    }
    const size = Number(sizeText);
    const average = Number(avgText);
    if (!(size > 0) || !(average > 0)) {
      showEmpty('Please enter positive numbers for both values.');
      return;
    }
    if (!entries.length) {
      showEmpty('Schedule data is not available.');
      return;
    }
    const matches = entries
      .filter(row => Math.abs(row.size - size) < 0.0001)
      .sort((a, b) => a.thickness - b.thickness);
    if (!matches.length) {
      showEmpty('No matching nozzle diameter found in the schedule data.');
      return;
    }

    let closestIndex = 0;
    for (let i = 1; i < matches.length; i++) {
      if (Math.abs(matches[i].thickness - average) <
          Math.abs(matches[closestIndex].thickness - average)) closestIndex = i;
    }
    const closest = matches[closestIndex];
    scheduleOutput.textContent = closest.schedule;
    thicknessOutput.textContent = `${closest.thickness.toFixed(2)} mm`;

    const exactIndex = matches.findIndex(row => Math.abs(row.thickness - average) < 1e-9);
    if (exactIndex >= 0) {
      nextScheduleOutput.textContent = 'NA (Exact match)';
      nextThicknessOutput.textContent = 'NA (Exact match)';
    } else if (average < matches[0].thickness || average > matches[matches.length - 1].thickness) {
      nextScheduleOutput.textContent = 'NA (Extreme value)';
      nextThicknessOutput.textContent = 'NA (Extreme value)';
    } else {
      const otherIndex = closestIndex === 0 ? 1 :
        closestIndex === matches.length - 1 ? matches.length - 2 :
        (average < closest.thickness ? closestIndex - 1 : closestIndex + 1);
      const next = matches[otherIndex];
      nextScheduleOutput.textContent = next.schedule;
      nextThicknessOutput.textContent = `${next.thickness.toFixed(2)} mm`;
    }
    message.textContent = `Closest standard thickness for ${size} mm diameter.`;
  }

  $('reset').addEventListener('click', () => {
    diameterInput.value = '';
    averageInput.value = '';
    showEmpty('Enter diameter and average thickness.');
    updateRetiringAssessment();
    diameterInput.focus();
  });
  diameterInput.addEventListener('input', calculate);
  averageInput.addEventListener('input', calculate);

  async function loadData() {
    try {
      const response = await fetch('./data/schedule_data.csv');
      if (!response.ok) throw new Error(`CSV request failed (${response.status})`);
      entries = parseCsv(await response.text());
      if (!entries.length) throw new Error('No valid schedule rows were found.');
      dataStatus.textContent = `Offline calculator • ${entries.length} schedule entries`;
      calculate();
    } catch (error) {
      console.error('Schedule data loading error:', error);
      dataStatus.textContent = 'Schedule data could not be loaded';
      showEmpty(error.message);
      updateRetiringAssessment();
    }
  }

  // -------------------- Manhole CP and BF reference tables --------------------
  // Each row: [tank height, CP-500, CP-600, CP-750, CP-900, BF-500, BF-600, BF-750, BF-900]
  const manholeTables = {
    // Rows: [height, CP-500, CP-600, CP-750, CP-900, BF-500, BF-600, BF-750, BF-900]
    is803: [
      [8,10,12,12,14,6,8,10,12],
      [10,10,12,14,16,6,8,10,12],
      [12,12,12,16,18,8,10,12,14],
      [14,12,14,16,20,10,12,12,16],
      [16.5,12,14,18,20,10,12,14,18],
      [20,14,16,20,22,12,12,16,20]
    ],
    api650_old: [
      [6.4,8,10,11,13,6,6,8,10],
      [8.2,10,11,13,14,6,8,10,11],
      [9.8,10,11,14,16,6,8,11,13],
      [12,11,13,16,18,8,10,13,14],
      [14,13,14,16,19,10,11,13,16],
      [16,13,14,18,21,10,11,14,18],
      [20,14,16,19,22,11,13,16,19],
      [23,16,18,21,24,12.5,14,18,21]
    ],
    api650_new: [
      [5,8,10,12,13,6,7,9,10],
      [6.5,10,11,13,15,7,8,10,12],
      [8,11,12,14,17,8,9,11,14],
      [9.5,12,13,16,18,9,10,13,15],
      [11,12,14,17,20,9,11,14,17],
      [13,13,15,18,21,10,12,15,18],
      [16,15,17,20,23,12,14,17,20],
      [19,16,18,22,26,13,15,19,23],
      [23,18,20,24,28,15,17,21,25]
    ],
    // Old Engineering Manual Table B is independent of manhole diameter.
    // Rows: [height, CP, BF]
    old_manual: [
      [6.5,10,6],
      [8,12,8],
      [10,12,8],
      [12,12,10],
      [14,14,12],
      [16.5,14,12],
      [20,16,12]
    ]
  };

  const diaSelect = $('manhole-dia');
  const codeSelect = $('construction-code');
  const heightInput = $('tank-height');
  const cpInput = $('cp-entered');
  const bfInput = $('bf-entered');

  function setAssessment(statusEl, enteredEl, requiredEl, entered, required, label, heightExceeded = false) {
    statusEl.className = 'assessment-status';
    enteredEl.textContent = entered === null ? '—' : `${entered.toFixed(2)} mm`;
    requiredEl.textContent = required === null ? (heightExceeded ? 'NA – Height exceeds table limit' : '—') : `${required} mm`;
    if (required === null) {
      statusEl.textContent = heightExceeded ? 'NA – Height exceeds table limit' : 'Enter the required details to assess.';
      return;
    }
    if (entered === null) {
      statusEl.textContent = `Enter ${label} thickness to assess.`;
      return;
    }
    if (entered >= required) {
      statusEl.textContent = `${label} thickness satisfactory`;
      statusEl.classList.add('satisfactory');
    } else {
      statusEl.textContent = `${label} replacement required`;
      statusEl.classList.add('replacement');
    }
  }

  function calculateManhole() {
    const dia = Number(diaSelect.value);
    const code = codeSelect.value;
    const height = Number(heightInput.value);
    const cpText = cpInput.value.trim();
    const bfText = bfInput.value.trim();
    const cpEntered = cpText === '' ? null : Number(cpText);
    const bfEntered = bfText === '' ? null : Number(bfText);

    const cpEnteredEl = $('cp-result-entered');
    const cpRequiredEl = $('cp-required');
    const cpStatusEl = $('cp-status');
    const bfEnteredEl = $('bf-result-entered');
    const bfRequiredEl = $('bf-required');
    const bfStatusEl = $('bf-status');
    const heightOutput = $('applicable-height');
    const note = $('manhole-message');

    if (!diaSelect.value || !code || !heightInput.value.trim() || !(height > 0)) {
      heightOutput.textContent = '—';
      setAssessment(cpStatusEl, cpEnteredEl, cpRequiredEl, cpEntered, null, 'CP');
      setAssessment(bfStatusEl, bfEnteredEl, bfRequiredEl, bfEntered, null, 'BF');
      note.textContent = 'Select manhole diameter and construction code, then enter a valid tank height.';
      return;
    }

    const rows = manholeTables[code];
    const selected = rows.find(row => row[0] >= height);
    if (!selected) {
      heightOutput.textContent = 'NA – Height exceeds table limit';
      setAssessment(cpStatusEl, cpEnteredEl, cpRequiredEl, cpEntered, null, 'CP', true);
      setAssessment(bfStatusEl, bfEnteredEl, bfRequiredEl, bfEntered, null, 'BF', true);
      note.textContent = 'Tank height exceeds the highest height listed in the selected standard table. No extrapolation has been applied.';
      return;
    }

    let cpRequired;
    let bfRequired;
    if (code === 'old_manual') {
      cpRequired = selected[1];
      bfRequired = selected[2];
    } else {
      const diaIndex = {500: 0, 600: 1, 750: 2, 900: 3}[dia];
      cpRequired = selected[1 + diaIndex];
      bfRequired = selected[5 + diaIndex];
    }
    heightOutput.textContent = `${selected[0].toFixed(1)} m`;
    setAssessment(cpStatusEl, cpEnteredEl, cpRequiredEl, cpEntered, cpRequired, 'CP');
    setAssessment(bfStatusEl, bfEnteredEl, bfRequiredEl, bfEntered, bfRequired, 'BF');
    note.textContent = `Minimum thicknesses selected from the ${selected[0].toFixed(1)} m row.`;
  }

  $('manhole-reset').addEventListener('click', () => {
    diaSelect.value = '';
    codeSelect.value = '';
    heightInput.value = '';
    cpInput.value = '';
    bfInput.value = '';
    calculateManhole();
  });
  [diaSelect, codeSelect, heightInput, cpInput, bfInput].forEach(el => {
    el.addEventListener('input', calculateManhole);
    el.addEventListener('change', calculateManhole);
  });
  calculateManhole();

  loadData();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('Offline support could not be enabled:', err);
      });
    });
  }
})();


// -------------------- Manhole Neck & Shell Design calculator --------------------
(() => {
  const $s = id => document.getElementById(`shell-${id}`);
  const $ = id => document.getElementById(id);
  const MAX_COURSES = 18;
  const DEFAULT_HEIGHTS = [2, 1.6, 2.5, 2, 1.3, 1.3, 0.7, 0.7];
  let activeResult = 'design';
  let lastShellResults = [];

  const neckTables = {
    is803: [
      [8,10,12,12,14,6,8,10,12], [10,10,12,14,16,6,8,10,12],
      [12,12,12,16,18,8,10,12,14], [14,12,14,16,20,10,12,12,16],
      [16.5,12,14,18,20,10,12,14,18], [20,14,16,20,22,12,12,16,20]
    ],
    api650_old: [
      [6.4,8,10,11,13,6,6,8,10], [8.2,10,11,13,14,6,8,10,11],
      [9.8,10,11,14,16,6,8,11,13], [12,11,13,16,18,8,10,13,14],
      [14,13,14,16,19,10,11,13,16], [16,13,14,18,21,10,11,14,18],
      [20,14,16,19,22,11,13,16,19], [23,16,18,21,24,12.5,14,18,21]
    ],
    api650_new: [
      [5,8,10,12,13,6,7,9,10], [6.5,10,11,13,15,7,8,10,12],
      [8,11,12,14,17,8,9,11,14], [9.5,12,13,16,18,9,10,13,15],
      [11,12,14,17,20,9,11,14,17], [13,13,15,18,21,10,12,15,18],
      [16,15,17,20,23,12,14,17,20], [19,16,18,22,26,13,15,19,23],
      [23,18,20,24,28,15,17,21,25]
    ]
  };

  function ordinal(n) {
    const suffix = ['th','st','nd','rd'], v = n % 100;
    return n + (suffix[(v-20)%10] || suffix[v] || suffix[0]);
  }
  function val(id) { return Number($s(id).value); }
  function fmt(v) { return Number.isFinite(v) ? v.toFixed(2) : '—'; }
  function safeDiv(a,b) { return b ? a/b : NaN; }

  for (let n=1; n<=MAX_COURSES; n++) $s('course-count').add(new Option(String(n), String(n)));
  $s('course-count').value = '8';

  function makeCourseRows() {
    const count = Number($s('course-count').value);
    const old = [...document.querySelectorAll('.shell-course-height')].map(el => el.value);
    $s('course-rows').innerHTML = '';
    for (let i=0; i<count; i++) {
      const tr=document.createElement('tr'), td1=document.createElement('td'), td2=document.createElement('td');
      const label=document.createElement('label');
      label.textContent=`${ordinal(i+1)} Shell Course`; label.htmlFor=`shell-course-${i}`;
      const input=document.createElement('input');
      input.type='number'; input.min='0'; input.step='0.01'; input.id=`shell-course-${i}`;
      input.className='shell-course-height'; input.value=old[i] ?? DEFAULT_HEIGHTS[i] ?? '1.0';
      input.setAttribute('aria-label',`${ordinal(i+1)} shell course height in metres`);
      input.addEventListener('input',calculateShell);
      td1.appendChild(label); td2.appendChild(input); tr.append(td1,td2); $s('course-rows').appendChild(tr);
    }
    $s('course-summary').textContent=`${count} course${count===1?'':'s'} configured`;
    calculateShell();
  }

  function updateNeckAssessment(firstCourseDesign) {
    const enteredText=$('neck-entered').value.trim();
    const dia=Number($('neck-dia').value), standard=$('neck-standard').value;
    const H=val('tank-height');
    const entered=enteredText===''?null:Number(enteredText);
    $('neck-entered-result').textContent=entered===null?'—':`${fmt(entered)} mm`;
    $('neck-first-course').textContent=Number.isFinite(firstCourseDesign)?`${fmt(firstCourseDesign)} mm`:'—';
    $('neck-bf-design').textContent='—';
    const status=$('neck-status'), note=$('neck-note');
    status.className='shell-neck-status';
    if (!standard) {
      status.textContent='Select the applicable standard.';
      note.textContent='The first-course design thickness is calculated using the selected construction standard.';
      return;
    }
    if (!Number.isFinite(firstCourseDesign)) {
      status.textContent='Complete valid tank and shell-course details above to calculate the first-course design thickness.';
      note.textContent='The assessment requires valid tank diameter, height, specific gravity, corrosion allowance, radiography and course heights.';
      return;
    }
    if (!dia || !(H>0)) {
      status.textContent='Select the manhole neck diameter.';
      note.textContent='Bolting-flange design thickness is selected from the applicable reference table using tank height and neck diameter.';
      return;
    }
    const rows=neckTables[standard];
    const selected=rows.find(row=>row[0]>=H);
    if (!selected) {
      $('neck-bf-design').textContent='NA – Height exceeds table limit';
      status.textContent='NA – Tank height exceeds the selected standard table limit.';
      note.textContent='No bolting-flange thickness is available above the highest height in the selected table. No extrapolation has been applied.';
      return;
    }
    const diaIndex={500:0,600:1,750:2,900:3}[dia];
    const bf=selected[5+diaIndex];
    $('neck-bf-design').textContent=`${fmt(bf)} mm`;
    note.textContent=`Bolting-flange minimum selected from the ${selected[0]} m height row of the ${standard==='is803'?'IS 803/B&R':'API 650'} table. API 650 editions use the corresponding edition table.`;
    if (entered===null || !Number.isFinite(entered) || entered<0) {
      status.textContent='Enter the measured manhole neck thickness to complete the assessment.';
      return;
    }
    const required=Math.min(firstCourseDesign,bf);
    if (entered>=required) {
      status.textContent='Manhole Neck thickness satisfactory';
      status.classList.add('satisfactory');
    } else {
      status.textContent='Manhole Neck replacement required';
      status.classList.add('replacement');
    }
  }

  function calculateShell() {
    const D=val('diameter'), H=val('tank-height'), CA=val('corrosion-allowance');
    const G=val('specific-gravity'), E=Number($s('radiography').value);
    $s('joint-efficiency').value=E.toFixed(2);
    const heights=[...document.querySelectorAll('.shell-course-height')].map(el=>Number(el.value));
    const sum=heights.reduce((a,b)=>a+(Number.isFinite(b)?b:0),0), diff=sum-H;
    if (Math.abs(diff)>0.01) {
      $s('height-check').textContent=`Note: Sum of entered course heights is ${fmt(sum)} m, while tank height is ${fmt(H)} m (difference ${fmt(diff)} m). Check the input values.`;
      $s('height-check').className='shell-height-check warning';
    } else {
      $s('height-check').textContent=`Total course height: ${fmt(sum)} m — matches tank height.`;
      $s('height-check').className='shell-height-check';
    }
    const valid=D>0 && H>0 && G>0 && E>0 && CA>=0 && heights.length>0 && heights.every(h=>h>0);
    if (!valid) {
      lastShellResults=[];
      $s('result-panel').innerHTML='<p class="shell-muted">Enter positive values for tank dimensions, specific gravity and each course height. Corrosion allowance may be zero.</p>';
      updateNeckAssessment(NaN);
      return;
    }

    const Ts=410, Ys=250;
    const api650Sd=Math.min(2/3*Ys,2/5*Ts);
    const api650St=Math.min(3/4*Ys,3/7*Ts);
    const is803Product=0.4*Ts, is803Hydro=3/7*Ts;
    const api653Lower=0.429*Ts, api653Other=0.472*Ts, is9964Stress=0.8*Ys;
    let liquidHead=H;
    const results=heights.map((courseHeight,i)=>{
      const h=liquidHead, waterSG=1;
      const is803ProductT=4.9*D*waterSG*(h-0.3)/(is803Product*E)+CA;
      const is803HydroT=4.9*D*waterSG*(h-0.3)/is803Hydro;
      const is803=Math.max(is803ProductT,is803HydroT,5);
      const api650ProductT=4.9*D*(h-0.3)*G/api650Sd+CA;
      const api650HydroT=4.9*D*(h-0.3)*waterSG/api650St;
      const api650=Math.max(api650ProductT,api650HydroT,5);
      const api653Stress=i<2?api653Lower:api653Other;
      const circular=safeDiv(4.9*D*(h-0.3)*waterSG,176*E);
      const api653=safeDiv(4.9*D*G*(h-0.3),api653Stress*E);
      const is9964=safeDiv(4.9*D*G*(h-0.3),is9964Stress*E);
      const away=safeDiv(4.9*D*h*G,api653Lower);
      const near=safeDiv(4.9*D*h*G,api653Lower*E);
      const row={course:ordinal(i+1),height:courseHeight,head:h,is803,api650,circular,api653,is9964,away,near};
      liquidHead-=courseHeight;
      return row;
    });
    lastShellResults=results;
    renderShellResults(results);
    const firstCourse=results[0];
    const standard=$('neck-standard').value;
    updateNeckAssessment(standard==='is803'?firstCourse.is803:(standard==='api650_old'||standard==='api650_new'?firstCourse.api650:NaN));
  }

  function renderShellResults(rows) {
    const configs={
      design:{title:'Design Thickness (mm)',subtitle:'Minimum required design thickness for each shell course.',cols:[['is803','As per IS 803'],['api650','As per API 650']]},
      entire:{title:'Retiring Thickness of Entire Shell (mm)',subtitle:'Retiring thickness calculated for the entire shell using the workbook methods.',cols:[['circular','As per Circular M&I/19 dated 30.05.1994'],['api653','As per API 653'],['is9964','As per IS-9964 Part-II, 1981']]},
      corroded:{title:'Retiring Thickness of Specific Area of a Corroded Plate as per API 653 (mm)',subtitle:'Local shell-plate retiring thickness; refer to away-from-weld and near-weld definitions in the source workbook.',cols:[['away','Away from weld*'],['near','Near weld*']]}
    };
    const config=configs[activeResult], table=document.createElement('table'); table.className='shell-result-table';
    const thead=document.createElement('thead'), hr=document.createElement('tr');
    ['Shell course','Course height (m)',...config.cols.map(c=>c[1])].forEach(t=>{const th=document.createElement('th');th.textContent=t;hr.appendChild(th);});
    thead.appendChild(hr); table.appendChild(thead);
    const tbody=document.createElement('tbody');
    rows.forEach(row=>{
      const tr=document.createElement('tr');
      [row.course,fmt(row.height),...config.cols.map(([key])=>fmt(row[key]))].forEach((v,i)=>{
        const td=document.createElement('td');
        if(i>=2){const pill=document.createElement('span');pill.className='shell-value-pill';pill.textContent=v;td.appendChild(pill);}
        else td.textContent=v;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    const panel=$s('result-panel'); panel.innerHTML='';
    const title=document.createElement('h3');title.className='shell-result-title';title.textContent=config.title;
    const sub=document.createElement('p');sub.className='shell-result-subtitle';sub.textContent=config.subtitle;
    const wrap=document.createElement('div');wrap.className='shell-course-table-wrap';wrap.appendChild(table);
    panel.append(title,sub,wrap);
  }

  document.querySelectorAll('.shell-result-tab').forEach(tab=>tab.addEventListener('click',()=>{
    activeResult=tab.dataset.shellResult;
    document.querySelectorAll('.shell-result-tab').forEach(t=>{
      const active=t===tab;t.classList.toggle('active',active);t.setAttribute('aria-selected',String(active));
    });
    if(lastShellResults.length) renderShellResults(lastShellResults);
  }));
  ['diameter','tank-height','corrosion-allowance','specific-gravity','radiography'].forEach(id=>{
    $s(id).addEventListener('input',calculateShell);
    $s(id).addEventListener('change',calculateShell);
  });
  $s('course-count').addEventListener('change',makeCourseRows);
  ['neck-entered','neck-dia','neck-standard'].forEach(id=>{
    $(id).addEventListener('input',calculateShell);
    $(id).addEventListener('change',calculateShell);
  });
  $('shell-reset').addEventListener('click',()=>{
    $s('diameter').value=32; $s('tank-height').value=13; $s('radiography').value='0.85';
    $s('corrosion-allowance').value=1.5; $s('specific-gravity').value=0.85; $s('course-count').value='8';
    $('neck-entered').value=''; $('neck-dia').value=''; $('neck-standard').value='';
    makeCourseRows();
  });
  makeCourseRows();
})();
