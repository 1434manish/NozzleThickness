
(() => {
  const diameterInput = document.getElementById('diameter');
  const averageInput = document.getElementById('average');

  const scheduleOutput = document.getElementById('schedule');
  const thicknessOutput = document.getElementById('thickness');
  const message = document.getElementById('message');
  const dataStatus = document.getElementById('data-status');

  const retiringOutput = document.getElementById('retiring-thickness');
  const retiringStatus = document.getElementById('retiring-status');

  let entries = [];

  // Retiring thickness reference values (mm)
  const retiringTable = {
    80: 4.80,
    100: 5.27,
    150: 6.22,
    200: 7.16,
    250: 8.11
  };

  function getRetiringThickness(size) {
    if (retiringTable[size] !== undefined) {
      return retiringTable[size];
    }

    if (size >= 300) {
      return 8.34;
    }

    return null;
  }

  function parseCsv(text) {
    const cleanText = text.replace(/^\uFEFF/, '').trim();
    const lines = cleanText.split(/\r?\n/);

    if (lines.length < 2) return [];

    const headers = lines[0]
      .split(',')
      .map(h => h.trim().toLowerCase());

    const sizeIndex = headers.indexOf('size_mm');
    const scheduleIndex = headers.indexOf('schedule');
    const thicknessIndex = headers.indexOf('thickness_mm');

    if (
      sizeIndex === -1 ||
      scheduleIndex === -1 ||
      thicknessIndex === -1
    ) {
      throw new Error('CSV headers do not match the expected format.');
    }

    return lines.slice(1).map(line => {
      const parts = line.split(',');

      const size = Number(parts[sizeIndex]?.trim());
      const schedule = parts[scheduleIndex]?.trim();
      const thickness = Number(parts[thicknessIndex]?.trim());

      if (
        !Number.isFinite(size) ||
        !Number.isFinite(thickness) ||
        !schedule
      ) {
        return null;
      }

      return { size, schedule, thickness };
    }).filter(Boolean);
  }

  function showEmpty(text) {
    scheduleOutput.textContent = '—';
    thicknessOutput.textContent = '—';
    message.textContent = text;
  }

  function updateRetiringAssessment() {
    const sizeText = diameterInput.value.trim();
    const averageText = averageInput.value.trim();

    retiringStatus.className = 'retiring-status';

    if (!sizeText) {
      retiringOutput.textContent = '—';
      retiringStatus.textContent =
        'Enter nozzle diameter and average thickness.';
      return;
    }

    const size = Number(sizeText);

    if (!(size > 0)) {
      retiringOutput.textContent = '—';
      retiringStatus.textContent =
        'Please enter a valid nozzle diameter.';
      return;
    }

    const retiringThickness = getRetiringThickness(size);

    if (retiringThickness === null) {
      retiringOutput.textContent = '—';
      retiringStatus.textContent =
        'Retiring thickness not defined for this diameter.';
      return;
    }

    retiringOutput.textContent =
      `${retiringThickness.toFixed(2)} mm`;

    if (!averageText) {
      retiringStatus.textContent =
        'Enter average thickness to assess nozzle condition.';
      return;
    }

    const average = Number(averageText);

    if (!(average > 0)) {
      retiringStatus.textContent =
        'Please enter a valid average thickness.';
      return;
    }

    if (average >= retiringThickness) {
      retiringStatus.textContent =
        'Nozzle thickness satisfactory';

      retiringStatus.classList.add('satisfactory');
    } else {
      retiringStatus.textContent =
        'Nozzle replacement required !!!';

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

    const matches = entries.filter(
      row => Math.abs(row.size - size) < 0.0001
    );

    if (!matches.length) {
      showEmpty(
        'No matching nozzle diameter found in the schedule data.'
      );
      return;
    }

    let closest = matches[0];

    for (const row of matches) {
      if (
        Math.abs(row.thickness - average) <
        Math.abs(closest.thickness - average)
      ) {
        closest = row;
      }
    }

    scheduleOutput.textContent = closest.schedule;
    thicknessOutput.textContent =
      `${closest.thickness.toFixed(2)} mm`;

    message.textContent =
      `Closest standard thickness for ${size} mm diameter.`;
  }

  async function loadData() {
    try {
      const response = await fetch('./data/schedule_data.csv');

      if (!response.ok) {
        throw new Error(`CSV request failed (${response.status})`);
      }

      const csv = await response.text();

      entries = parseCsv(csv);

      if (!entries.length) {
        throw new Error('No valid schedule rows were found.');
      }

      dataStatus.textContent =
        `Offline calculator • ${entries.length} schedule entries`;

      calculate();

    } catch (error) {
      console.error('Schedule data loading error:', error);

      dataStatus.textContent =
        'Schedule data could not be loaded';

      showEmpty(error.message);
      updateRetiringAssessment();
    }
  }

  diameterInput.addEventListener('input', calculate);
  averageInput.addEventListener('input', calculate);

  document.getElementById('reset').addEventListener('click', () => {
    diameterInput.value = '';
    averageInput.value = '';

    showEmpty('Enter diameter and average thickness.');

    updateRetiringAssessment();

    diameterInput.focus();
  });

  loadData();

  if (
    'serviceWorker' in navigator &&
    location.protocol.startsWith('http')
  ) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn(
          'Offline support could not be enabled:',
          err
        );
      });
    });
  }
})();
