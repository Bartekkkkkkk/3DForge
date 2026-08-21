(function(){
  'use strict';

  const $ = id => document.getElementById(id);
  const currencySelect = $('currency');
  const curLabels = ['curLabel1','curLabel2','curLabel3','curLabel5','curLabel6','curLabel7'];

  const numberValue = (id) => {
    const el = $(id);
    const value = el ? Number.parseFloat(el.value) : 0;
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  };

  function fmt(n){
    const value = Number.isFinite(n) ? n : 0;
    return currencySelect.value + ' ' + value.toLocaleString('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function syncCurrency(){
    curLabels.forEach(id => {
      const el = $(id);
      if(el) el.textContent = currencySelect.value;
    });
    recalc();
  }
  currencySelect.addEventListener('change', syncCurrency);

  // ---------- sliders ----------
  function bindSlider(rangeId, badgeId, suffix){
    const range = $(rangeId);
    const badge = $(badgeId);
    if(!range || !badge) return;

    const update = () => {
      badge.textContent = range.value + suffix;
      recalc();
    };

    range.addEventListener('input', update);
    update();
  }

  bindSlider('margin','marginBadge',' %');
  bindSlider('dailyHours','dailyHoursBadge',' h');
  bindSlider('repairPct','repairPctBadge',' %');

  // ---------- energy method panels ----------
  const energyMethod = $('energyMethod');
  const panels = {
    watts: $('panel-watts'),
    measured: $('panel-measured')
  };

  function updateEnergyPanels(){
    Object.values(panels).forEach(panel => panel && panel.classList.remove('active'));
    if(panels[energyMethod.value]) panels[energyMethod.value].classList.add('active');
    recalc();
  }
  energyMethod.addEventListener('change', updateEnergyPanels);

  // ---------- G-code upload + drag & drop ----------
  const fileInput = $('gcodeFile');
  const upload = document.querySelector('.upload');
  const uploadStatus = $('uploadStatus');

  function setUploadStatus(type, message){
    uploadStatus.className = 'upload-status' + (type ? ' ' + type : '');
    uploadStatus.textContent = message;
  }

  function isGcodeFile(file){
    if(!file) return false;
    const name = file.name.toLowerCase();
    return /\.(gcode|gco|g)$/.test(name) || file.type === 'text/plain' || file.type === '';
  }

  function loadGcodeFile(file){
    if(!file) return;

    if(!isGcodeFile(file)){
      setUploadStatus('err', 'Nieobsługiwany format. Wybierz plik .gcode, .gco lub .g.');
      return;
    }

    setUploadStatus('', 'Wczytywanie: ' + file.name + '…');

    const reader = new FileReader();
    reader.onload = function(evt){
      const result = parseGcode(String(evt.target.result || ''));
      const found = [];

      if(result.hours !== null){
        $('printH').value = result.hours;
        $('printM').value = result.minutes;
        found.push('czas druku');
      }

      if(result.weight !== null){
        $('filamentWeight').value = result.weight;
        found.push('wagę filamentu');
      }

      if(found.length){
        setUploadStatus('ok', file.name + ' — odczytano ' + found.join(' i ') + '.');
      } else {
        setUploadStatus('err', file.name + ' — nie rozpoznano czasu ani wagi. Uzupełnij pola ręcznie.');
      }
      recalc();
    };

    reader.onerror = function(){
      setUploadStatus('err', 'Nie udało się odczytać pliku — uzupełnij dane ręcznie.');
    };

    reader.readAsText(file);
  }

  fileInput.addEventListener('change', function(e){
    loadGcodeFile(e.target.files && e.target.files[0]);
  });

  if(upload){
    ['dragenter', 'dragover'].forEach(eventName => {
      upload.addEventListener(eventName, function(e){
        e.preventDefault();
        e.stopPropagation();
        upload.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      upload.addEventListener(eventName, function(e){
        e.preventDefault();
        e.stopPropagation();
        upload.classList.remove('dragover');
      });
    });

    upload.addEventListener('drop', function(e){
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      loadGcodeFile(file);
    });
  }

  function durationFromText(value){
    if(!value) return null;

    const h = /(?:^|\s)(\d+(?:[.,]\d+)?)\s*h/i.exec(value);
    const m = /(?:^|\s)(\d+(?:[.,]\d+)?)\s*m(?!m)/i.exec(value);
    const s = /(?:^|\s)(\d+(?:[.,]\d+)?)\s*s/i.exec(value);

    if(!h && !m && !s) return null;

    const totalSeconds =
      (h ? Number.parseFloat(h[1].replace(',','.')) * 3600 : 0) +
      (m ? Number.parseFloat(m[1].replace(',','.')) * 60 : 0) +
      (s ? Number.parseFloat(s[1].replace(',','.')) : 0);

    if(!Number.isFinite(totalSeconds)) return null;
    return totalSeconds;
  }

  function splitDuration(totalSeconds){
    const safeSeconds = Math.max(0, Math.round(totalSeconds));
    return {
      hours: Math.floor(safeSeconds / 3600),
      minutes: Math.floor((safeSeconds % 3600) / 60)
    };
  }

  function parseGcode(text){
    let totalSeconds = null;
    let weight = null;
    let match;

    const timePatterns = [
      /estimated printing time[^=\r\n]*=\s*([^\r\n]+)/i,
      /total estimated time[^:\r\n]*:\s*([^\r\n]+)/i,
      /estimated print time[^:\r\n]*:\s*([^\r\n]+)/i
    ];

    for(const pattern of timePatterns){
      match = text.match(pattern);
      if(match){
        totalSeconds = durationFromText(match[1]);
        if(totalSeconds !== null) break;
      }
    }

    if(totalSeconds === null){
      match = text.match(/(?:^|\n)\s*;?TIME\s*:\s*(\d+(?:\.\d+)?)/i);
      if(match) totalSeconds = Number.parseFloat(match[1]);
    }

    if(totalSeconds === null){
      match = text.match(/total estimated time[^:\r\n]*:\s*(\d+)\s*:\s*(\d+)\s*:\s*(\d+)/i);
      if(match){
        totalSeconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
      }
    }

    const weightPatterns = [
      /filament used\s*\[g\]\s*[=:]\s*([0-9]+(?:[.,][0-9]+)?)/i,
      /total filament weight\s*\[g\]\s*[=:]\s*([0-9]+(?:[.,][0-9]+)?)/i,
      /total filament used\s*\[g\]\s*[=:]\s*([0-9]+(?:[.,][0-9]+)?)/i,
      /filament weight\s*\[g\]\s*[=:]\s*([0-9]+(?:[.,][0-9]+)?)/i
    ];

    for(const pattern of weightPatterns){
      match = text.match(pattern);
      if(match){
        const parsed = Number.parseFloat(match[1].replace(',','.'));
        if(Number.isFinite(parsed)){
          weight = Math.round(parsed * 100) / 100;
          break;
        }
      }
    }

    if(totalSeconds === null){
      return {hours: null, minutes: null, weight};
    }

    const duration = splitDuration(totalSeconds);
    return {hours: duration.hours, minutes: duration.minutes, weight};
  }

  // ---------- other costs ----------
  const otherRows = $('otherRows');

  function addRow(name, value){
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
    valueInput.value = value || 0;
    valueWrap.append(prefix, valueInput);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'remove-row';
    removeButton.setAttribute('aria-label', 'Usuń pozycję');
    removeButton.textContent = '×';

    row.append(nameWrap, valueWrap, removeButton);
    otherRows.appendChild(row);

    nameInput.addEventListener('input', recalc);
    valueInput.addEventListener('input', recalc);
    removeButton.addEventListener('click', function(){
      row.remove();
      recalc();
    });
  }

  $('addRow').addEventListener('click', () => addRow('', 0));

  // ---------- master recalc ----------
  function hm(hId, mId){
    return numberValue(hId) + numberValue(mId) / 60;
  }

  function recalc(){
    document.querySelectorAll('.other-cur').forEach(el => {
      el.textContent = currencySelect.value;
    });

    const printHours = hm('printH','printM');
    const weight = numberValue('filamentWeight');

    // material: brak poprawnej wagi szpuli = 0 zamiast dzielenia przez sztuczną wartość
    const spoolPrice = numberValue('spoolPrice');
    const spoolWeight = numberValue('spoolWeight');
    const margin = numberValue('margin');
    const materialCost = spoolWeight > 0
      ? (weight / spoolWeight) * spoolPrice * (1 + margin / 100)
      : 0;

    $('materialCost').textContent = fmt(materialCost);
    $('bMaterial').textContent = fmt(materialCost);

    // energy
    let kWh = 0;
    let price = 0;

    if(energyMethod.value === 'watts'){
      kWh = (numberValue('wattage') / 1000) * printHours;
      price = numberValue('kwhPrice1');
    } else {
      kWh = numberValue('measuredKwh');
      price = numberValue('kwhPrice2');
    }

    const energyCost = kWh * price;
    $('energyCost').textContent = fmt(energyCost);
    $('bEnergy').textContent = fmt(energyCost);

    // labor
    const prepHours = hm('prepH','prepM');
    const postHours = hm('postH','postM');
    const laborCost = prepHours * numberValue('prepRate') + postHours * numberValue('postRate');

    $('laborCost').textContent = fmt(laborCost);
    $('bLabor').textContent = fmt(laborCost);

    // equipment: koszt liczony dopiero, gdy okres i dzienne użycie są większe od zera
    const printerPrice = numberValue('printerPrice');
    const roiYears = numberValue('roiYears');
    const dailyHours = numberValue('dailyHours');
    const repairPct = numberValue('repairPct');

    let equipmentCost = 0;
    if(printerPrice > 0 && roiYears > 0 && dailyHours > 0 && printHours > 0){
      const totalToRecover = printerPrice * (1 + repairPct / 100);
      const totalHoursPeriod = dailyHours * 365 * roiYears;
      equipmentCost = (totalToRecover / totalHoursPeriod) * printHours;
    }

    $('equipmentCost').textContent = fmt(equipmentCost);
    $('bEquipment').textContent = fmt(equipmentCost);

    // other
    let otherTotal = 0;
    document.querySelectorAll('.other-value').forEach(el => {
      const value = Number.parseFloat(el.value);
      if(Number.isFinite(value) && value > 0) otherTotal += value;
    });

    $('otherCost').textContent = fmt(otherTotal);
    $('bOther').textContent = fmt(otherTotal);

    // VAT + final
    const subtotal = materialCost + energyCost + laborCost + equipmentCost + otherTotal;
    const vatPct = Math.min(numberValue('vat'), 100);
    const vatAmount = subtotal * vatPct / 100;
    const final = subtotal + vatAmount;

    $('bVat').textContent = fmt(vatAmount);
    $('finalPrice').textContent = fmt(final);

    // printable receipt
    $('psMaterial').textContent = fmt(materialCost);
    $('psEnergy').textContent = fmt(energyCost);
    $('psLabor').textContent = fmt(laborCost);
    $('psEquipment').textContent = fmt(equipmentCost);
    $('psOther').textContent = fmt(otherTotal);
    $('psVat').textContent = fmt(vatAmount);
    $('psFinal').textContent = fmt(final);
  }

  [
    'printH','printM','filamentWeight','filamentType','spoolPrice','spoolWeight',
    'wattage','kwhPrice1','measuredKwh','kwhPrice2',
    'prepH','prepM','prepRate','postH','postM','postRate',
    'printerPrice','roiYears','vat'
  ].forEach(id => {
    const el = $(id);
    if(el) el.addEventListener('input', recalc);
  });

  function updateReceiptDate(){
    $('psDate').textContent = 'Wycena z dnia ' + new Date().toLocaleDateString('pl-PL');
  }

  updateEnergyPanels();
  syncCurrency();
  updateReceiptDate();

  // ---------- JPG export ----------
  $('downloadJpg').addEventListener('click', async function(){
    const button = this;
    const el = $('printSummary');

    if(typeof window.html2canvas !== 'function'){
      window.alert('Nie udało się załadować modułu eksportu JPG. Sprawdź połączenie z internetem i odśwież stronę.');
      return;
    }

    updateReceiptDate();
    const oldText = button.innerHTML;
    button.disabled = true;
    button.classList.add('is-loading');

    try{
      el.classList.add('exporting');
      const canvas = await window.html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: 3,
        useCORS: true,
        logging: false
      });

      const link = document.createElement('a');
      link.download = '3DForge-wycena.jpg';
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch(error){
      console.error('Błąd eksportu JPG:', error);
      window.alert('Nie udało się wygenerować JPG. Spróbuj ponownie po odświeżeniu strony.');
    } finally {
      el.classList.remove('exporting');
      button.disabled = false;
      button.innerHTML = oldText;
    }
  });

  // ---------- A6 print ----------
  $('printA6').addEventListener('click', function(){
    updateReceiptDate();
    window.print();
  });
})();
