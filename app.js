(() => {
  const $ = id => document.getElementById(id);

  // -------------------- Tab navigation --------------------
  const nozzleTab = $('nozzle-tab');
  const manholeTab = $('manhole-tab');
  const nozzlePanel = $('nozzle-panel');
  const manholePanel = $('manhole-panel');

  function activateTab(which) {
    const showNozzle = which === 'nozzle';
    nozzleTab.classList.toggle('active', showNozzle);
    manholeTab.classList.toggle('active', !showNozzle);
    nozzleTab.setAttribute('aria-selected', String(showNozzle));
    manholeTab.setAttribute('aria-selected', String(!showNozzle));
    nozzlePanel.hidden = !showNozzle;
    manholePanel.hidden = showNozzle;
  }
  nozzleTab.addEventListener('click', () => activateTab('nozzle'));
  manholeTab.addEventListener('click', () => activateTab('manhole'));

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
