(function () {
  'use strict';

  function init() {
    const $ = (id) => document.getElementById(id);

    const requiredIds = [
      'currency','gcodeFile','uploadStatus','printH','printM','filamentWeight','filamentType',
      'spoolPrice','spoolWeight','margin','marginBadge','materialCost',
      'energyMethod','panel-watts','panel-measured','wattage','kwhPrice1',
      'measuredKwh','kwhPrice2','energyCost','prepH','prepM','prepRate',
      'postH','postM','postRate','laborCost','printerPrice','roiYears',
      'dailyHours','dailyHoursBadge','repairPct','repairPctBadge','equipmentCost',
      'otherRows','addRow','otherCost','vat','bMaterial','bMaterialLabel','bMaterialWeight',
      'bEnergy','bLabor','bEquipment','bOther','bOtherList','bVat','finalPrice','downloadJpg','printA6',
      'printSummary','psDate','psMaterial','psMaterialLabel','psMaterialWeight','psEnergy','psLabor','psEquipment',
      'psOther','psOtherList','psVat','psFinal','currencyCustom','currencyTrigger','currencyTriggerText','currencyMenu'
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
    const currencyCustom = $('currencyCustom');
    const currencyTrigger = $('currencyTrigger');
    const currencyTriggerText = $('currencyTriggerText');
    const currencyMenu = $('currencyMenu');

    function setupCurrencyDropdown() {
      const options = Array.from(currencyMenu.querySelectorAll('.custom-option'));

      const close = () => {
        currencyCustom.classList.remove('open');
        currencyTrigger.setAttribute('aria-expanded', 'false');
      };

      currencyTrigger.addEventListener('click', (event) => {
        event.stopPropagation();
        const willOpen = !currencyCustom.classList.contains('open');
        currencyCustom.classList.toggle('open', willOpen);
        currencyTrigger.setAttribute('aria-expanded', String(willOpen));
      });

      options.forEach((option) => {
        option.addEventListener('click', () => {
          currencySelect.value = option.dataset.value;
          currencyTriggerText.textContent = option.textContent;
          options.forEach((item) => item.classList.toggle('active', item === option));
          close();
          currencySelect.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });

      document.addEventListener('click', (event) => {
        if (!currencyCustom.contains(event.target)) close();
      });

      currencyTrigger.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') close();
      });
    }

    function numberValue(id) {
      const element = $(id);
      if (!element) return 0;
      const normalized = String(element.value ?? '').replace(',', '.');
      const value = Number.parseFloat(normalized);
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    }

    function textValue(id, fallback = '—') {
      const element = $(id);
      const value = String(element?.value ?? '').trim();
      return value || fallback;
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

    function formatWeight(value) {
      const safe = Number.isFinite(value) ? value : 0;
      return safe.toLocaleString('pl-PL', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }) + ' g';
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

    function getOtherItems() {
      const items = [];
      otherRows.querySelectorAll('.other-row').forEach((row) => {
        const name = row.querySelector('.other-name')?.value?.trim() || 'Dodatkowa pozycja';
        const raw = row.querySelector('.other-value')?.value ?? '';
        const value = Number.parseFloat(String(raw).replace(',', '.'));
        if (Number.isFinite(value) && value > 0) {
          items.push({ name, value });
        }
      });
      return items;
    }

    function renderOtherList(targetId, items) {
      const target = $(targetId);
      if (!target) return;
      target.innerHTML = '';
      items.forEach((item) => {
        const row = document.createElement('div');
        row.className = targetId === 'psOtherList' ? 'ps-list-row' : 'breakdown-list-row';

        const name = document.createElement('span');
        name.textContent = '• ' + item.name;

        const value = document.createElement('span');
        value.textContent = fmt(item.value);

        row.append(name, value);
        target.appendChild(row);
      });
    }

    function collectValues() {
      const printHours = hoursMinutes('printH', 'printM');
      const filamentWeight = numberValue('filamentWeight');
      const filamentType = textValue('filamentType');

      const spoolPrice = numberValue('spoolPrice');
      const spoolWeight = numberValue('spoolWeight');
      const marginPct = numberValue('margin');
      const materialBase = spoolWeight > 0 ? (filamentWeight / spoolWeight) * spoolPrice : 0;
      const materialCost = materialBase * (1 + marginPct / 100);

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

      const prepCost = hoursMinutes('prepH', 'prepM') * numberValue('prepRate');
      const postCost = hoursMinutes('postH', 'postM') * numberValue('postRate');
      const laborCost = prepCost + postCost;

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

      const otherItems = getOtherItems();
      const otherTotal = otherItems.reduce((sum, item) => sum + item.value, 0);
      const subtotal = materialCost + energyCost + laborCost + equipmentCost + otherTotal;
      const vatPct = Math.min(numberValue('vat'), 100);
      const vatAmount = subtotal * (vatPct / 100);
      const finalPrice = subtotal + vatAmount;

      return {
        printHours,
        filamentWeight,
        filamentType,
        materialCost,
        energyCost,
        laborCost,
        equipmentCost,
        otherItems,
        otherTotal,
        vatAmount,
        finalPrice
      };
    }

    function recalc() {
      updateCurrencyLabels();
      const values = collectValues();

      setText('materialCost', fmt(values.materialCost));
      setText('energyCost', fmt(values.energyCost));
      setText('laborCost', fmt(values.laborCost));
      setText('equipmentCost', fmt(values.equipmentCost));
      setText('otherCost', fmt(values.otherTotal));

      setText('bMaterialLabel', 'Materiał — ' + values.filamentType);
      setText('bMaterial', fmt(values.materialCost));
      setText('bMaterialWeight', formatWeight(values.filamentWeight));
      setText('bEnergy', fmt(values.energyCost));
      setText('bLabor', fmt(values.laborCost));
      setText('bEquipment', fmt(values.equipmentCost));
      setText('bOther', fmt(values.otherTotal));
      setText('bVat', fmt(values.vatAmount));
      setText('finalPrice', fmt(values.finalPrice));
      renderOtherList('bOtherList', values.otherItems);

      setText('psMaterialLabel', 'Materiał — ' + values.filamentType);
      setText('psMaterial', fmt(values.materialCost));
      setText('psMaterialWeight', formatWeight(values.filamentWeight));
      setText('psEnergy', fmt(values.energyCost));
      setText('psLabor', fmt(values.laborCost));
      setText('psEquipment', fmt(values.equipmentCost));
      setText('psOther', fmt(values.otherTotal));
      setText('psVat', fmt(values.vatAmount));
      setText('psFinal', fmt(values.finalPrice));
      renderOtherList('psOtherList', values.otherItems);

      const receipt = $('printSummary');
      receipt.classList.toggle('ps-dense', values.otherItems.length > 7);
      receipt.classList.toggle('ps-ultra-dense', values.otherItems.length > 14);
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

      [nameInput, valueInput].forEach((el) => {
        el.addEventListener('input', recalc);
        el.addEventListener('change', recalc);
      });

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
      let match = text.match(/\b(\d+):([0-5]?\d):([0-5]?\d)\b/);
      if (match) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
      match = text.match(/\b(\d+):([0-5]?\d)\b/);
      if (match) return Number(match[1]) * 60 + Number(match[2]);
      const h = text.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hours?|godz(?:\.|iny|ina)?)/i);
      const m = text.match(/(\d+(?:[.,]\d+)?)\s*(?:m(?!m)|mins?|minutes?|minut(?:y|a)?)/i);
      const s = text.match(/(\d+(?:[.,]\d+)?)\s*(?:s|secs?|seconds?|sek(?:\.|undy|unda)?)/i);
      if (!h && !m && !s) return null;
      const n = (part) => part ? Number.parseFloat(part[1].replace(',', '.')) : 0;
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
      return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
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

    function downloadJpg() {
      const button = $('downloadJpg');
      updateReceiptDate();
      recalc();
      button.disabled = true;

      try {
        const values = collectValues();
        // A6 portrait in a 12 px/mm working scale. Same content/order as printSummary.
        const mm = 12;
        const width = Math.round(105 * mm);
        const height = Math.round(148 * mm);
        const marginX = Math.round(7 * mm);
        const marginTop = Math.round(7 * mm);
        const marginBottom = Math.round(7 * mm);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D niedostępny');

        const extraCount = values.otherItems.length;
        const rowCount = 7 + extraCount; // material, weight, energy, labor, equipment, extra total, VAT + extras
        const dense = extraCount > 7;
        const ultra = extraCount > 14;
        const rowStep = ultra ? 25 : dense ? 30 : 36;
        const rowFont = ultra ? 15 : dense ? 17 : 19;
        const smallFont = ultra ? 13 : dense ? 15 : 17;
        const headerBrand = ultra ? 25 : 29;
        const headerMeta = ultra ? 13 : 15;
        const totalFont = ultra ? 27 : dense ? 31 : 36;

        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#000';
        ctx.textBaseline = 'alphabetic';

        ctx.font = `700 ${headerBrand}px Arial, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText('3DForge', marginX, marginTop + headerBrand);
        ctx.font = `${headerMeta}px Arial, sans-serif`;
        ctx.fillText($('psDate').textContent, marginX, marginTop + headerBrand + 28);

        let y = marginTop + headerBrand + 49;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(marginX, y);
        ctx.lineTo(width - marginX, y);
        ctx.stroke();
        y += ultra ? 25 : 34;

        const separator = (lineY) => {
          ctx.strokeStyle = '#bdbdbd';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(marginX, lineY);
          ctx.lineTo(width - marginX, lineY);
          ctx.stroke();
        };

        const drawRow = (label, value, small = false, indent = 0) => {
          const fontSize = small ? smallFont : rowFont;
          ctx.fillStyle = '#000';
          ctx.font = `${fontSize}px Arial, sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillText(label, marginX + indent, y);
          ctx.font = `${fontSize}px "Courier New", monospace`;
          ctx.textAlign = 'right';
          ctx.fillText(value, width - marginX, y);
          separator(y + 8);
          y += small ? Math.max(22, rowStep - 5) : rowStep;
        };

        drawRow('Materiał — ' + values.filamentType, fmt(values.materialCost));
        drawRow('Zużycie', formatWeight(values.filamentWeight), true, 20);
        drawRow('Energia', fmt(values.energyCost));
        drawRow('Robocizna', fmt(values.laborCost));
        drawRow('Sprzęt', fmt(values.equipmentCost));

        values.otherItems.forEach((item) => {
          drawRow('• ' + item.name, fmt(item.value), true, 20);
        });

        drawRow('Dodatkowe koszty — razem', fmt(values.otherTotal));
        drawRow('VAT', fmt(values.vatAmount));

        y += ultra ? 10 : 18;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(marginX, y);
        ctx.lineTo(width - marginX, y);
        ctx.stroke();
        y += ultra ? 20 : 28;

        ctx.font = `700 ${ultra ? 13 : 15}px Arial, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText('CENA KOŃCOWA', marginX, y);
        y += ultra ? 25 : 32;
        ctx.font = `700 ${totalFont}px Arial, sans-serif`;
        ctx.fillText(fmt(values.finalPrice), marginX, y);

        ctx.font = `${ultra ? 11 : 13}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('wygenerowano w 3DForge', width / 2, height - marginBottom);

        const link = document.createElement('a');
        link.download = '3DForge-wycena-A6.jpg';
        link.href = canvas.toDataURL('image/jpeg', 0.98);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (error) {
        console.error('3DForge: błąd eksportu JPG', error);
        window.alert('Nie udało się wygenerować JPG. Spróbuj ponownie.');
      } finally {
        button.disabled = false;
      }
    }

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

    $('downloadJpg').addEventListener('click', downloadJpg);
    $('printA6').addEventListener('click', function () {
      updateReceiptDate();
      recalc();
      window.print();
    });

    setupCurrencyDropdown();
    updateSliderBadge('margin', 'marginBadge', ' %');
    updateSliderBadge('dailyHours', 'dailyHoursBadge', ' h');
    updateSliderBadge('repairPct', 'repairPctBadge', ' %');
    updateEnergyPanels();
    updateCurrencyLabels();
    updateReceiptDate();
    recalc();
  }

  if (document.getElementById('currency')) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  }
})();
