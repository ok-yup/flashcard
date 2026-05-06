// ================================================
//  FlashLearn — script.js
//  Architecture:
//    - Google Form  → user inputs new vocabulary
//    - Google Sheet → database (Form responses go here)
//    - This page    → reads Sheet CSV → Flashcards
// ================================================

// ---- State ----
let cards = [];
let deck = [];
let currentIndex = 0;
let sheetId = '';
let formUrl = '';
let currentHeaderWord = 'คำศัพท์';
let currentHeaderMeaning = 'ความหมาย';

// ... (existing code omitted for brevity in instruction, but implementation will follow)

// ---- DOM ----
const setupScreen    = document.getElementById('setupScreen');
const appScreen      = document.getElementById('appScreen');
const loadingOverlay = document.getElementById('loadingOverlay');
const flashcard      = document.getElementById('flashcard');
const cardWord       = document.getElementById('cardWord');
const cardMeaning    = document.getElementById('cardMeaning');
const progressFill   = document.getElementById('progressFill');
const cardCounter    = document.getElementById('cardCounter');
const emptyState     = document.getElementById('emptyState');
const actionRow      = document.getElementById('actionRow');
const completionPanel = document.getElementById('completionPanel');
const cardCountBadge = document.getElementById('cardCountBadge');

// ================================================
//  INIT & PERSISTENCE
// ================================================

document.addEventListener('DOMContentLoaded', () => {
  const savedForm = localStorage.getItem('flashLearnFormUrl');
  const savedSheet = localStorage.getItem('flashLearnSheetUrl');
  
  if (savedForm) document.getElementById('formUrl').value = savedForm;
  if (savedSheet) document.getElementById('sheetUrl').value = savedSheet;
});

// ================================================
//  SETUP
// ================================================

function connectAll() {
  const rawForm  = document.getElementById('formUrl').value.trim();
  const rawSheet = document.getElementById('sheetUrl').value.trim();

  // Validate Sheet URL
  const sheetMatch = rawSheet.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!sheetMatch) return showSetupError('ลิ้ง Google Sheet ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');

  // Validate Form URL (basic)
  if (!rawForm.includes('docs.google.com/forms')) return showSetupError('ลิ้ง Google Form ไม่ถูกต้อง');

  sheetId = sheetMatch[1];
  formUrl = rawForm;

  // Save to local storage
  localStorage.setItem('flashLearnFormUrl', rawForm);
  localStorage.setItem('flashLearnSheetUrl', rawSheet);

  // Setup Form iframe
  // Ensure we use /viewform URL (not edit)
  const embedFormUrl = rawForm.replace(/\/viewform.*$/, '/viewform') + '?embedded=true';
  document.getElementById('formIframe').src = embedFormUrl;

  // Show App
  setupScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');

  // Load cards and metadata
  loadCards();
  loadSheetMetadata();
}

function showSetupError(msg) {
  const el = document.getElementById('setupError');
  el.textContent = '⚠️ ' + msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

function goBack() {
  appScreen.classList.add('hidden');
  setupScreen.classList.remove('hidden');
}

// ================================================
//  LOAD SHEET METADATA
// ================================================

async function loadSheetMetadata() {
  if (!sheetId) return;
  const metaContainer = document.getElementById('sheetMetadata');
  const metaFileName = document.getElementById('metaFileName');
  const metaSheetName = document.getElementById('metaSheetName');
  
  metaContainer.classList.remove('hidden');
  metaFileName.textContent = 'กำลังอ่านชื่อไฟล์...';
  metaSheetName.textContent = '';
  
  try {
    // ใช้บริการ allorigins ในการดึง HTML ของ Sheet เพื่อเอา <title> โดยไม่ต้องล็อกอิน
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/view`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Cannot fetch metadata');
    
    const html = await response.text();
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    
    if (titleMatch && titleMatch[1]) {
      // ปกติชื่อจะมาในรูปแบบ "ชื่อไฟล์ - ชื่อแผ่นงาน - Google Sheets"
      let fullTitle = titleMatch[1].replace(' - Google Sheets', '').trim();
      let parts = fullTitle.split(' - ');
      
      if (parts.length >= 2) {
        metaSheetName.textContent = `แผ่นงาน: ${parts.pop()}`; // ส่วนสุดท้ายคือชื่อชีต
        metaFileName.textContent = `📁 ไฟล์: ${parts.join(' - ')}`; // ที่เหลือคือชื่อไฟล์
      } else {
        metaFileName.textContent = `📁 ไฟล์: ${fullTitle}`;
        metaSheetName.textContent = '';
      }
    } else {
      metaFileName.textContent = 'อ่านชื่อไฟล์ไม่ได้';
    }
  } catch (err) {
    console.error('Error loading metadata:', err);
    metaFileName.textContent = '';
  }
}

// ================================================
//  LOAD CARDS FROM SHEET
// ================================================

async function loadCards() {
  if (!sheetId) return;

  showLoading(true, 'กำลังโหลดคำศัพท์จาก Sheet...');

  try {
    // Use Google Sheets CSV export (works when shared as "Anyone can view")
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
    const resp = await fetch(url);

    if (!resp.ok) throw new Error('ดึงข้อมูลไม่ได้');

    const csv = await resp.text();
    parseCSV(csv);

  } catch (err) {
    alert('ไม่สามารถโหลดข้อมูลได้\nตรวจสอบว่า Sheet แชร์เป็น "Anyone with the link" แล้วหรือยัง?');
  } finally {
    showLoading(false);
  }
}

function parseCSV(csv) {
  const lines = csv.split('\n');
  cards = [];

  if (lines.length === 0) return;

  const headerParts = parseCSVLine(lines[0]);
  let wIdx = 1; // Default to Column 2
  let mIdx = 2; // Default to Column 3
  let tIdx = 0; // Default to Column 1 (Time)

  // Store custom header names
  currentHeaderWord = headerParts[wIdx] || 'คำศัพท์';
  currentHeaderMeaning = headerParts[mIdx] || 'ความหมาย';

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = parseCSVLine(line);

    if (parts.length > Math.max(wIdx, mIdx)) {
      const word    = parts[wIdx].trim();
      const meaning = parts[mIdx].trim();
      const time    = parts[tIdx] ? parts[tIdx].trim() : '';
      
      if (word && meaning) {
        cards.push({ word, meaning, time });
      }
    }
  }

  cardCountBadge.textContent = `🃏 ${cards.length} ใบ`;

  if (cards.length === 0) {
    emptyState.classList.remove('hidden');
    actionRow.classList.add('hidden');
    cardWord.textContent = '—';
    cardMeaning.textContent = '—';
  } else {
    emptyState.classList.add('hidden');
    actionRow.classList.remove('hidden');
    resetStudy();
  }
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ================================================
//  FLASHCARD LOGIC
// ================================================

function resetStudy() {
  deck = [...cards];
  
  // สุ่มคำศัพท์อัตโนมัติทุกครั้งที่เริ่มเรียน
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  currentIndex = 0;
  completionPanel.classList.add('hidden');
  emptyState.classList.add('hidden');
  if (deck.length > 0) actionRow.classList.remove('hidden');
  updateDisplay();
}

function updateDisplay() {
  if (deck.length === 0) return;

  const card = deck[currentIndex];
  cardWord.textContent    = card.word;
  cardMeaning.textContent = card.meaning;
  
  // แสดงชื่อหัวข้อตามที่ตั้งใน Sheet
  document.getElementById('labelFront').textContent = currentHeaderWord;
  document.getElementById('labelBack').textContent = currentHeaderMeaning;
  
  // แสดงเวลา
  document.getElementById('cardTime').textContent = card.time || '';

  // Reset flip
  flashcard.classList.remove('flipped');

  // Update counter
  cardCounter.textContent  = `${currentIndex + 1} / ${deck.length}`;

  // Progress bar
  const pct = ((currentIndex) / deck.length) * 100;
  progressFill.style.width = pct + '%';
}

function flipCard() {
  flashcard.classList.toggle('flipped');
}

function nextCard() {
  if (currentIndex < deck.length - 1) {
    currentIndex++;
    updateDisplay();
  } else {
    showCompletion();
  }
}

function prevCard() {
  if (currentIndex > 0) {
    currentIndex--;
    updateDisplay();
  }
}

function shuffleCards() {
  resetStudy(); // ใช้ resetStudy เลยเพราะมันสุ่มให้อยู่แล้ว
}

function showCompletion() {
  completionPanel.classList.remove('hidden');
}

// ================================================
//  TAB SWITCHING
// ================================================

function switchTab(tab) {
  // Update tab buttons
  document.getElementById('tabStudy').classList.toggle('active', tab === 'study');
  document.getElementById('tabAdd').classList.toggle('active',   tab === 'add');

  // Update panels
  document.getElementById('panelStudy').classList.toggle('hidden', tab !== 'study');
  document.getElementById('panelAdd').classList.toggle('hidden',   tab !== 'add');

  // ซ่อนหน้าจอป๊อปอัปเมื่อมีการสลับหน้า
  completionPanel.classList.add('hidden');

  // Auto-fetch data if switching back to study
  if (tab === 'study' && sheetId) {
    loadCards();
  }
}

// ================================================
//  DEMO MODE
// ================================================

function loadDemo() {
  // Pre-fill with demo data (we simulate it locally)
  document.getElementById('formUrl').value  = 'https://docs.google.com/forms/d/e/1FAIpQLSfSampleFormId/viewform';
  document.getElementById('sheetUrl').value = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

  // Load with sample data directly
  cards = [
    { word: 'Apple',      meaning: 'แอปเปิ้ล' },
    { word: 'Banana',     meaning: 'กล้วย' },
    { word: 'Computer',   meaning: 'คอมพิวเตอร์' },
    { word: 'Mountain',   meaning: 'ภูเขา' },
    { word: 'Ocean',      meaning: 'มหาสมุทร' },
    { word: 'Knowledge',  meaning: 'ความรู้' },
    { word: 'Persevere',  meaning: 'อดทน / มุ่งมั่น' },
    { word: 'Ephemeral',  meaning: 'ชั่วคราว / ไม่ยั่งยืน' },
  ];

  cardCountBadge.textContent = `🃏 ${cards.length} ใบ`;
  document.getElementById('formIframe').src = 'about:blank';

  setupScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');

  emptyState.classList.add('hidden');
  actionRow.classList.remove('hidden');
  resetStudy();
}

// ================================================
//  HELPERS
// ================================================

function showLoading(show, text) {
  loadingOverlay.classList.toggle('hidden', !show);
  document.getElementById('loadingText').textContent = text || '';
}
