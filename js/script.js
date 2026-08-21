(function () {
  'use strict';

  function init() {
    const $ = (id) => document.getElementById(id);

    const requiredIds = [
      'currency','gcodeFile','uploadStatus','printH','printM','filamentWeight',
      'spoolPrice','spoolWeight','margin','marginBadge','materialCost',
      'energyMethod','panel-watts','panel-measured','wattage','kwhPrice1',
      'measuredKwh','kwhPrice2','energyCost','prepH','prepM','prepRate',
      'postH','postM','postRate','laborCost','printerPrice','roiYears',
      'dailyHours','dailyHoursBadge','repairPct','repairPctBadge','equipmentCost',
      'otherRows','addRow','otherCost','vat','bMaterial','bEnergy','bLabor',
      'bEquipment','bOther','bVat','finalPrice','downloadJpg','printA6',
      'printSummary','psDate','psMaterial','psEnergy','psLabor','psEquipment',
      'psOther','psVat','psFinal'
    ];

    const missing = requiredIds.filter((id) => !$(id));
    if (missing.length) {
      console.error('3DForge: brak elementów HTML:', missing.join(', '));
      return;
    }

    const currencySelect = $('currency');
    const energyMethod = $('energyMethod');
    const fileInput = $('gcodeFile');
    const upload = document.querySelector('.upload');
    const uploadStatus = $('uploadStatus');
    const otherRows = $('otherRows');
    const curLabels = ['curLabel1','curLabel2','curLabel3','curLabel5','curLabel6','curLabel7'];

    function numberValue(id) {
      const element = $(id);
      if (!element) return 0;
      const normalized = String(element.value ?? '').replace(',', '.');
      const value = Number.parseFloat(normalized);
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    }

    function hoursMinutes(hId, mId) {
      return numberValue(hId) + numberValue(mId) / 60;
    }

    function fmt(value) {
      const safe = Number.isFinite(value) ? value : 0;
      return currencySelect.value + ' ' + safe.toLocaleString('pl-PL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    function setText(id, text) {
      const element = $(id);
      if (element) element.textContent = text;
    }

    function updateCurrencyLabels() {
      curLabels.forEach((id) => setText(id, currencySelect.value));
      document.querySelectorAll('.other-cur').forEach((element) => {
        element.textContent = currencySelect.value;
      });
    }

    function updateSliderBadge(rangeId, badgeId, suffix) {
      const range = $(rangeId);
      const badge = $(badgeId);
      if (range && badge) badge.textContent = range.value + suffix;
    }

    function updateEnergyPanels() {
      $('panel-watts').classList.toggle('active', energyMethod.value === 'watts');
      $('panel-measured').classList.toggle('active', energyMethod.value === 'measured');
    }

    function recalc() {
      updateCurrencyLabels();

      const printHours = hoursMinutes('printH', 'printM');
      const filamentWeight = numberValue('filamentWeight');

      // Materiał
      const spoolPrice = numberValue('spoolPrice');
      const spoolWeight = numberValue('spoolWeight');
      const marginPct = numberValue('margin');
      const materialBase = spoolWeight > 0 ? (filamentWeight / spoolWeight) * spoolPrice : 0;
      const materialCost = materialBase * (1 + marginPct / 100);

      // Energia
      let energyKwh = 0;
      let energyUnitPrice = 0;
      if (energyMethod.value === 'measured') {
        energyKwh = numberValue('measuredKwh');
        energyUnitPrice = numberValue('kwhPrice2');
      } else {
        energyKwh = (numberValue('wattage') / 1000) * printHours;
        energyUnitPrice = numberValue('kwhPrice1');
      }
      const energyCost = energyKwh * energyUnitPrice;

      // Robocizna
      const prepCost = hoursMinutes('prepH', 'prepM') * numberValue('prepRate');
      const postCost = hoursMinutes('postH', 'postM') * numberValue('postRate');
      const laborCost = prepCost + postCost;

      // Sprzęt
      const printerPrice = numberValue('printerPrice');
      const roiYears = numberValue('roiYears');
      const dailyHours = numberValue('dailyHours');
      const repairPct = numberValue('repairPct');
      let equipmentCost = 0;
      if (printerPrice > 0 && roiYears > 0 && dailyHours > 0 && printHours > 0) {
        const totalToRecover = printerPrice * (1 + repairPct / 100);
        const plannedHours = dailyHours * 365 * roiYears;
        equipmentCost = (totalToRecover / plannedHours) * printHours;
      }

      // Dodatkowe koszty
      let otherTotal = 0;
      otherRows.querySelectorAll('.other-value').forEach((input) => {
        const value = Number.parseFloat(String(input.value || '').replace(',', '.'));
        if (Number.isFinite(value) && value > 0) otherTotal += value;
      });

      // VAT i suma
      const subtotal = materialCost + energyCost + laborCost + equipmentCost + otherTotal;
      const vatPct = Math.min(numberValue('vat'), 100);
      const vatAmount = subtotal * (vatPct / 100);
      const finalPrice = subtotal + vatAmount;

      const values = {
        materialCost,
        energyCost,
        laborCost,
        equipmentCost,
        otherTotal,
        vatAmount,
        finalPrice
      };

      setText('materialCost', fmt(values.materialCost));
      setText('energyCost', fmt(values.energyCost));
      setText('laborCost', fmt(values.laborCost));
      setText('equipmentCost', fmt(values.equipmentCost));
      setText('otherCost', fmt(values.otherTotal));

      setText('bMaterial', fmt(values.materialCost));
      setText('bEnergy', fmt(values.energyCost));
      setText('bLabor', fmt(values.laborCost));
      setText('bEquipment', fmt(values.equipmentCost));
      setText('bOther', fmt(values.otherTotal));
      setText('bVat', fmt(values.vatAmount));
      setText('finalPrice', fmt(values.finalPrice));

      setText('psMaterial', fmt(values.materialCost));
      setText('psEnergy', fmt(values.energyCost));
      setText('psLabor', fmt(values.laborCost));
      setText('psEquipment', fmt(values.equipmentCost));
      setText('psOther', fmt(values.otherTotal));
      setText('psVat', fmt(values.vatAmount));
      setText('psFinal', fmt(values.finalPrice));
    }

    function addRow(name, value) {
      const row = document.createElement('div');
      row.className = 'other-row';

      const nameWrap = document.createElement('div');
      nameWrap.className = 'input-row';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'other-name';
      nameInput.placeholder = 'Nazwa pozycji';
      nameInput.value = name || '';
      nameWrap.appendChild(nameInput);

      const valueWrap = document.createElement('div');
      valueWrap.className = 'input-row';
      const prefix = document.createElement('span');
      prefix.className = 'prefix other-cur';
      prefix.textContent = currencySelect.value;
      const valueInput = document.createElement('input');
      valueInput.type = 'number';
      valueInput.className = 'other-value';
      valueInput.min = '0';
      valueInput.step = '0.01';
      valueInput.value = Number.isFinite(Number(value)) ? value : 0;
      valueWrap.append(prefix, valueInput);

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'remove-row';
      removeButton.setAttribute('aria-label', 'Usuń pozycję');
      removeButton.textContent = '×';

      row.append(nameWrap, valueWrap, removeButton);
      otherRows.appendChild(row);

      valueInput.addEventListener('input', recalc);
      valueInput.addEventListener('change', recalc);
      removeButton.addEventListener('click', function () {
        row.remove();
        recalc();
      });

      recalc();
      nameInput.focus();
    }

    function setUploadStatus(type, message) {
      uploadStatus.className = 'upload-status' + (type ? ' ' + type : '');
      uploadStatus.textContent = message;
    }

    function isGcodeFile(file) {
      if (!file) return false;
      const name = String(file.name || '').toLowerCase();
      return /\.(gcode|gco|g)$/.test(name) || file.type === 'text/plain' || file.type === '';
    }

    function durationFromText(value) {
      if (!value) return null;
      const text = String(value).trim();

      // hh:mm:ss / mm:ss
      let match = text.match(/\b(\d+):([0-5]?\d):([0-5]?\d)\b/);
      if (match) {
        return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
      }
      match = text.match(/\b(\d+):([0-5]?\d)\b/);
      if (match) {
        return Number(match[1]) * 60 + Number(match[2]);
      }

      const h = text.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hours?|godz(?:\.|iny|ina)?)/i);
      const m = text.match(/(\d+(?:[.,]\d+)?)\s*(?:m(?!m)|mins?|minutes?|minut(?:y|a)?)/i);
      const s = text.match(/(\d+(?:[.,]\d+)?)\s*(?:s|secs?|seconds?|sek(?:\.|undy|unda)?)/i);
      if (!h && !m && !s) return null;

      const n = (matchPart) => matchPart ? Number.parseFloat(matchPart[1].replace(',', '.')) : 0;
      const total = n(h) * 3600 + n(m) * 60 + n(s);
      return Number.isFinite(total) ? total : null;
    }

    function splitDuration(totalSeconds) {
      const safe = Math.max(0, Number(totalSeconds) || 0);
      const totalMinutes = Math.round(safe / 60);
      return {
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60
      };
    }

    function firstNumber(text) {
      const match = String(text || '').match(/[-+]?\d+(?:[.,]\d+)?/);
      if (!match) return null;
      const number = Number.parseFloat(match[0].replace(',', '.'));
      return Number.isFinite(number) ? number : null;
    }

    function sumNumbers(text) {
      const matches = String(text || '').match(/\d+(?:[.,]\d+)?/g);
      if (!matches || !matches.length) return null;
      const values = matches.map((v) => Number.parseFloat(v.replace(',', '.'))).filter(Number.isFinite);
      if (!values.length) return null;
      return values.reduce((sum, value) => sum + value, 0);
    }

    function parseGcode(text) {
      const source = String(text || '');
      let totalSeconds = null;
      let weight = null;
      let match;

      const timeLinePatterns = [
        /(?:^|\n)\s*;?\s*total estimated time[^:=\r\n]*[:=]\s*([^\r\n]+)/i,
        /(?:^|\n)\s*;?\s*estimated printing time[^:=\r\n]*[:=]\s*([^\r\n]+)/i,
        /(?:^|\n)\s*;?\s*estimated print time[^:=\r\n]*[:=]\s*([^\r\n]+)/i,
        /(?:^|\n)\s*;?\s*print time[^:=\r\n]*[:=]\s*([^\r\n]+)/i
      ];

      for (const pattern of timeLinePatterns) {
        match = source.match(pattern);
        if (match) {
          totalSeconds = durationFromText(match[1]);
          if (totalSeconds !== null) break;
        }
      }

      if (totalSeconds === null) {
        match = source.match(/(?:^|\n)\s*;?\s*TIME\s*:\s*(\d+(?:\.\d+)?)/i);
        if (match) totalSeconds = Number.parseFloat(match[1]);
      }

      const weightLinePatterns = [
        /(?:^|\n)\s*;?\s*total filament weight\s*\[g\]\s*[:=]\s*([^\r\n]+)/i,
        /(?:^|\n)\s*;?\s*filament used\s*\[g\]\s*[:=]\s*([^\r\n]+)/i,
        /(?:^|\n)\s*;?\s*total filament used\s*\[g\]\s*[:=]\s*([^\r\n]+)/i,
        /(?:^|\n)\s*;?\s*filament weight\s*\[g\]\s*[:=]\s*([^\r\n]+)/i
      ];

      for (const pattern of weightLinePatterns) {
        match = source.match(pattern);
        if (match) {
          // Multi-material slicers sometimes list several gram values separated by commas/semicolons.
          const raw = match[1].trim();
          const candidate = /[,;]\s*\d/.test(raw) ? sumNumbers(raw) : firstNumber(raw);
          if (candidate !== null) {
            weight = Math.round(candidate * 100) / 100;
            break;
          }
        }
      }

      if (totalSeconds === null) return { hours: null, minutes: null, weight };
      const duration = splitDuration(totalSeconds);
      return { hours: duration.hours, minutes: duration.minutes, weight };
    }

    function readBlobAsText(blob) {
      if (blob && typeof blob.text === 'function') return blob.text();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Błąd odczytu pliku'));
        reader.readAsText(blob);
      });
    }

    async function loadGcodeFile(file) {
      if (!file) return;
      if (!isGcodeFile(file)) {
        setUploadStatus('err', 'Nieobsługiwany format. Wybierz plik .gcode, .gco lub .g.');
        return;
      }

      setUploadStatus('', 'Wczytywanie: ' + file.name + '…');

      try {
        // Metadane slicera są zwykle na początku albo końcu pliku. Nie czytamy setek MB bez potrzeby.
        const chunkSize = 4 * 1024 * 1024;
        let text;
        if (file.size > chunkSize * 2) {
          const head = await readBlobAsText(file.slice(0, chunkSize));
          const tail = await readBlobAsText(file.slice(file.size - chunkSize));
          text = head + '\n' + tail;
        } else {
          text = await readBlobAsText(file);
        }

        const result = parseGcode(text);
        const found = [];

        if (result.hours !== null) {
          $('printH').value = result.hours;
          $('printM').value = result.minutes;
          found.push('czas druku');
        }
        if (result.weight !== null) {
          $('filamentWeight').value = result.weight;
          found.push('wagę filamentu');
        }

        if (found.length) {
          setUploadStatus('ok', file.name + ' — odczytano ' + found.join(' i ') + '.');
        } else {
          setUploadStatus('err', file.name + ' — nie rozpoznano czasu ani wagi. Uzupełnij pola ręcznie.');
        }
        recalc();
      } catch (error) {
        console.error('3DForge: błąd odczytu G-code', error);
        setUploadStatus('err', 'Nie udało się odczytać pliku — uzupełnij dane ręcznie.');
      }
    }

    function updateReceiptDate() {
      setText('psDate', 'Wycena z dnia ' + new Date().toLocaleDateString('pl-PL'));
    }

    // ----- Zdarzenia kalkulatora -----
    const recalcInputs = [
      'printH','printM','filamentWeight','filamentType','spoolPrice','spoolWeight',
      'wattage','kwhPrice1','measuredKwh','kwhPrice2',
      'prepH','prepM','prepRate','postH','postM','postRate',
      'printerPrice','roiYears','vat'
    ];

    recalcInputs.forEach((id) => {
      const element = $(id);
      if (!element) return;
      element.addEventListener('input', recalc);
      element.addEventListener('change', recalc);
    });

    [
      ['margin','marginBadge',' %'],
      ['dailyHours','dailyHoursBadge',' h'],
      ['repairPct','repairPctBadge',' %']
    ].forEach(([rangeId, badgeId, suffix]) => {
      const range = $(rangeId);
      range.addEventListener('input', function () {
        updateSliderBadge(rangeId, badgeId, suffix);
        recalc();
      });
      range.addEventListener('change', function () {
        updateSliderBadge(rangeId, badgeId, suffix);
        recalc();
      });
    });

    currencySelect.addEventListener('change', recalc);
    energyMethod.addEventListener('change', function () {
      updateEnergyPanels();
      recalc();
    });

    $('addRow').addEventListener('click', function () {
      addRow('', 0);
    });

    fileInput.addEventListener('change', function (event) {
      const file = event.target.files && event.target.files[0];
      loadGcodeFile(file);
    });

    if (upload) {
      ['dragenter', 'dragover'].forEach((eventName) => {
        upload.addEventListener(eventName, function (event) {
          event.preventDefault();
          event.stopPropagation();
          upload.classList.add('dragover');
        });
      });
      ['dragleave', 'drop'].forEach((eventName) => {
        upload.addEventListener(eventName, function (event) {
          event.preventDefault();
          event.stopPropagation();
          upload.classList.remove('dragover');
        });
      });
      upload.addEventListener('drop', function (event) {
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        loadGcodeFile(file);
      });
    }

    $('downloadJpg').addEventListener('click', function () {
      const button = this;
      updateReceiptDate();
      recalc();
      button.disabled = true;

      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 1600;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D niedostępny');

        // Tło
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Pasek marki
        ctx.fillStyle = '#191b24';
        ctx.fillRect(0, 0, canvas.width, 210);
        ctx.fillStyle = '#ff7a30';
        ctx.fillRect(0, 210, canvas.width, 12);

        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#ffb043';
        ctx.font = '700 78px Arial, sans-serif';
        ctx.fillText('3DForge', 90, 125);
        ctx.fillStyle = '#c9ccda';
        ctx.font = '32px Arial, sans-serif';
        ctx.fillText('Wycena wydruku 3D', 90, 177);

        ctx.fillStyle = '#6a7192';
        ctx.font = '28px Arial, sans-serif';
        ctx.fillText($('psDate').textContent, 90, 295);

        const rows = [
          ['Materiał', $('psMaterial').textContent],
          ['Energia', $('psEnergy').textContent],
          ['Robocizna', $('psLabor').textContent],
          ['Sprzęt', $('psEquipment').textContent],
          ['Dodatkowe koszty', $('psOther').textContent],
          ['VAT', $('psVat').textContent]
        ];

        let y = 410;
        ctx.font = '34px Arial, sans-serif';
        rows.forEach(([label, value]) => {
          ctx.fillStyle = '#6a7192';
          ctx.textAlign = 'left';
          ctx.fillText(label, 90, y);
          ctx.fillStyle = '#292c38';
          ctx.textAlign = 'right';
          ctx.fillText(value, 1110, y);

          ctx.strokeStyle = '#e2e4ec';
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 10]);
          ctx.beginPath();
          ctx.moveTo(90, y + 36);
          ctx.lineTo(1110, y + 36);
          ctx.stroke();
          ctx.setLineDash([]);
          y += 135;
        });

        // Cena końcowa
        ctx.strokeStyle = '#191b24';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(90, 1235);
        ctx.lineTo(1110, 1235);
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillStyle = '#8890ab';
        ctx.font = '700 28px Arial, sans-serif';
        ctx.fillText('CENA KOŃCOWA', 90, 1315);

        ctx.fillStyle = '#c94e12';
        ctx.font = '700 78px Arial, sans-serif';
        ctx.fillText($('psFinal').textContent, 90, 1415);

        ctx.fillStyle = '#a4a9c0';
        ctx.font = '24px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('wygenerowano w 3DForge', 600, 1530);

        const link = document.createElement('a');
        link.download = '3DForge-wycena.jpg';
        link.href = canvas.toDataURL('image/jpeg', 0.95);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (error) {
        console.error('3DForge: błąd eksportu JPG', error);
        window.alert('Nie udało się wygenerować JPG. Spróbuj ponownie.');
      } finally {
        button.disabled = false;
      }
    });

    $('printA6').addEventListener('click', function () {
      updateReceiptDate();
      window.print();
    });

    // ----- Inicjalizacja dopiero po podpięciu wszystkich zależności -----
    updateSliderBadge('margin', 'marginBadge', ' %');
    updateSliderBadge('dailyHours', 'dailyHoursBadge', ' h');
    updateSliderBadge('repairPct', 'repairPctBadge', ' %');
    updateEnergyPanels();
    updateCurrencyLabels();
    updateReceiptDate();
    recalc();
  }

  // Skrypt jest ładowany na końcu <body>, więc uruchamiamy kalkulator od razu.
  // Dzięki temu zewnętrzny moduł JPG nie może opóźnić działania kalkulatora.
  if (document.getElementById('currency')) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  }
})();
