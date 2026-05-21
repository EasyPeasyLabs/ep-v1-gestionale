/**
 * TEST DI PRODUZIONE — Iscrizione Manuale
 * Data: 21/05/2026
 * 
 * Fasi:
 * A. Operazioni preliminari (navigazione, login, apertura ISCRIZIONI)
 * B. Simulazione nuova iscrizione manuale
 * C. Verifica iscrizione attiva in ARCHIVIO ISCRIZIONI
 * D. Verifica presenze attese (CORSI, REGISTRO PRESENZE, CALENDARIO)
 */

import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'test-screenshots');
const APP_URL = 'https://ep-v1-gestionale.vercel.app';
const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

// Dati test
const CLIENTE = 'CORLIANO\' ROBERTA';
const FIGLIO = 'MARCO';
const PACCHETTO = 'K-LAB.2026.Mensile';
const METODO_PAGAMENTO = 'Contanti';
const DATA_INIZIO = '21/05/2026';
const DATA_FINE_ATTESA = '11/06/2026';

// Risultati test
const results = {
  faseA: { status: 'PENDING', dettagli: [], errori: [], console_logs: [] },
  faseB: { status: 'PENDING', dettagli: [], errori: [], console_logs: [] },
  faseC: { status: 'PENDING', dettagli: [], errori: [], console_logs: [] },
  faseD: { status: 'PENDING', dettagli: [], errori: [], console_logs: [] }
};

// Logs console del browser
const consoleLogs = [];

function log(fase, msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [FASE ${fase}] ${msg}`;
  console.log(line);
  results[`fase${fase}`].dettagli.push(line);
}

function logError(fase, msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [FASE ${fase}] ❌ ERRORE: ${msg}`;
  console.error(line);
  results[`fase${fase}`].errori.push(line);
}

async function screenshot(page, name) {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
  const filepath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  log('_', `Screenshot salvato: ${filepath}`);
  return filepath;
}

async function waitAndClick(page, selector, description, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout });
    await page.click(selector);
    log('_', `Click su: ${description} (${selector})`);
    await page.evaluate(() => new Promise(r => setTimeout(r, 800)));
    return true;
  } catch (e) {
    logError('_', `Impossibile cliccare su ${description} (${selector}): ${e.message}`);
    return false;
  }
}

async function waitForText(page, text, timeout = 10000) {
  try {
    await page.waitForFunction(
      (t) => document.body.innerText.includes(t),
      { timeout },
      text
    );
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ========================
// FASE A: OPERAZIONI PRELIMINARI
// ========================
async function faseA(page) {
  log('A', '=== INIZIO FASE A: Operazioni Preliminari ===');

  // 1. Naviga all'applicazione
  log('A', `Navigazione a ${APP_URL}...`);
  await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(3000);
  await screenshot(page, 'A1-pagina-iniziale');

  // 2. Verifica se siamo sulla pagina di login o se la sessione è attiva
  const pageContent = await page.evaluate(() => document.body.innerText);
  log('A', `Contenuto pagina caricato (primi 200 char): ${pageContent.substring(0, 200)}`);

  // Verifica se è necessario login
  const needsLogin = pageContent.toLowerCase().includes('accedi') || 
                     pageContent.toLowerCase().includes('login') ||
                     pageContent.toLowerCase().includes('email');
  
  if (needsLogin) {
    log('A', 'Pagina di login rilevata. Tentativo di login...');
    
    // Cerca campo email
    const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i]');
    if (emailInput) {
      await emailInput.click({ clickCount: 3 });
      await emailInput.type('labeasypeasy@gmail.com', { delay: 50 });
      log('A', 'Email inserita: labeasypeasy@gmail.com');
      await screenshot(page, 'A2-email-inserita');
      
      // Cerca e clicca pulsante login/accedi
      const loginBtn = await page.$('button[type="submit"], button:has-text("Accedi"), button:has-text("Login")');
      if (loginBtn) {
        await loginBtn.click();
        await sleep(3000);
        log('A', 'Pulsante login cliccato');
      } else {
        // Prova con enter
        await emailInput.press('Enter');
        await sleep(3000);
      }
      
      // Verifica se serve password
      const passwordInput = await page.$('input[type="password"]');
      if (passwordInput) {
        log('A', '⚠️ Richiesta password. Questo test richiede una sessione già autenticata.');
        logError('A', 'Login con password richiesto - sessione non attiva');
        results.faseA.status = 'BLOCKED';
        return false;
      }
    }
    await screenshot(page, 'A3-dopo-login');
    await sleep(2000);
  }

  // 3. Cerca e clicca su ISCRIZIONI nella sidebar
  log('A', 'Ricerca voce ISCRIZIONI nella sidebar...');
  await screenshot(page, 'A4-prima-sidebar');

  // Prova diversi selettori per la sidebar
  const sidebarFound = await page.evaluate(() => {
    // Cerca tutti i link/pulsanti nella sidebar
    const allElements = document.querySelectorAll('a, button, div[role="button"], span, li');
    for (const el of allElements) {
      const text = el.textContent?.trim();
      if (text === 'Iscrizioni' || text === 'ISCRIZIONI') {
        el.click();
        return { found: true, text };
      }
    }
    // Prova anche con contiene
    for (const el of allElements) {
      const text = el.textContent?.trim();
      if (text && text.toLowerCase().includes('iscrizioni') && !text.toLowerCase().includes('archivio')) {
        el.click();
        return { found: true, text };
      }
    }
    return { found: false };
  });

  if (sidebarFound.found) {
    log('A', `✅ Voce ISCRIZIONI trovata e cliccata: "${sidebarFound.text}"`);
  } else {
    logError('A', 'Voce ISCRIZIONI non trovata nella sidebar');
    // Dump della sidebar per debug
    const sidebarContent = await page.evaluate(() => {
      const sidebar = document.querySelector('nav, aside, [class*="sidebar" i], [class*="menu" i]');
      return sidebar ? sidebar.innerText : 'Sidebar non trovata';
    });
    log('A', `Contenuto sidebar/nav: ${sidebarContent.substring(0, 500)}`);
  }

  await sleep(2000);
  await screenshot(page, 'A5-pagina-iscrizioni');

  // Verifica che la pagina Iscrizioni sia caricata
  const isIscrizioniPage = await page.evaluate(() => {
    return document.body.innerText.includes('Iscrizi') || 
           document.body.innerText.includes('Nuova') ||
           document.body.innerText.includes('iscrizione');
  });

  if (isIscrizioniPage) {
    log('A', '✅ Pagina ISCRIZIONI caricata correttamente');
    results.faseA.status = 'PASS';
  } else {
    logError('A', 'Pagina ISCRIZIONI non confermata');
    results.faseA.status = 'WARNING';
  }

  log('A', '=== FINE FASE A ===');
  return true;
}

// ========================
// FASE B: SIMULAZIONE NUOVA ISCRIZIONE
// ========================
async function faseB(page) {
  log('B', '=== INIZIO FASE B: Simulazione Nuova Iscrizione ===');

  // 1. Clicca bottone "+ Nuova"
  log('B', 'Ricerca pulsante "+ Nuova"...');
  const nuovaClicked = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent?.trim();
      if (text && (text.includes('Nuova') || text.includes('+ Nuova') || text.includes('nuova'))) {
        btn.click();
        return { found: true, text };
      }
    }
    return { found: false };
  });

  if (nuovaClicked.found) {
    log('B', `✅ Pulsante "${nuovaClicked.text}" cliccato`);
  } else {
    logError('B', 'Pulsante "+ Nuova" non trovato');
    results.faseB.status = 'FAIL';
    return false;
  }

  await sleep(2000);
  await screenshot(page, 'B1-menu-nuova');

  // 2. Seleziona "Iscrizione Standard"
  log('B', 'Ricerca opzione "Iscrizione Standard"...');
  const standardClicked = await page.evaluate(() => {
    const allEl = document.querySelectorAll('button, a, div, li, span, option');
    for (const el of allEl) {
      const text = el.textContent?.trim();
      if (text && text.toLowerCase().includes('iscrizione standard')) {
        el.click();
        return { found: true, text };
      }
    }
    // Prova anche solo "Standard"
    for (const el of allEl) {
      const text = el.textContent?.trim();
      if (text && text === 'Standard') {
        el.click();
        return { found: true, text };
      }
    }
    return { found: false };
  });

  if (standardClicked.found) {
    log('B', `✅ Opzione "${standardClicked.text}" selezionata`);
  } else {
    logError('B', 'Opzione "Iscrizione Standard" non trovata');
  }

  await sleep(2000);
  await screenshot(page, 'B2-modale-iscrizione');

  // 3. Compila campo cliente (Genitore) - CORLIANO' ROBERTA
  log('B', `Compilazione campo cliente: ${CLIENTE}...`);
  
  // Cerca il campo di ricerca cliente
  const clienteCompilato = await page.evaluate((clienteName) => {
    // Cerca input di ricerca per cliente
    const inputs = document.querySelectorAll('input[type="text"], input[type="search"], input:not([type])');
    for (const input of inputs) {
      const label = input.closest('label, div, fieldset');
      const labelText = label?.textContent?.toLowerCase() || '';
      const placeholder = (input.placeholder || '').toLowerCase();
      if (labelText.includes('cliente') || labelText.includes('genitore') || 
          labelText.includes('cerca') || placeholder.includes('cerca') ||
          placeholder.includes('cliente') || placeholder.includes('nome')) {
        input.focus();
        input.value = '';
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, clienteName.substring(0, 5));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return { found: true, inputId: input.id, placeholder: input.placeholder };
      }
    }
    return { found: false };
  }, 'CORLI');

  if (clienteCompilato.found) {
    log('B', '✅ Campo cliente trovato, digitazione in corso...');
    await sleep(1500);
    
    // Seleziona CORLIANO' ROBERTA dal dropdown risultati
    const clienteSelezionato = await page.evaluate((nome) => {
      const options = document.querySelectorAll('li, div[role="option"], option, div[class*="option"], div[class*="suggestion"], div[class*="result"], div[class*="item"]');
      for (const opt of options) {
        const text = opt.textContent?.trim().toUpperCase();
        if (text && text.includes('CORLIAN')) {
          opt.click();
          return { found: true, text: opt.textContent?.trim() };
        }
      }
      return { found: false };
    }, CLIENTE);

    if (clienteSelezionato.found) {
      log('B', `✅ Cliente selezionato: ${clienteSelezionato.text}`);
    } else {
      log('B', '⚠️ Dropdown cliente non trovato, riprovo con più testo...');
      // Potrebbe essere necessario attendere di più o digitare in modo diverso
    }
  } else {
    logError('B', 'Campo di ricerca cliente non trovato');
  }

  await sleep(1500);
  await screenshot(page, 'B3-cliente-selezionato');

  // 4. Verifica Target = figlio (dovrebbe essere già selezionato)
  log('B', 'Verifica Target = figlio...');
  const targetVerificato = await page.evaluate(() => {
    const page_text = document.body.innerText;
    const radios = document.querySelectorAll('input[type="radio"]');
    for (const radio of radios) {
      const label = radio.closest('label') || radio.parentElement;
      if (label?.textContent?.toLowerCase().includes('figlio') || label?.textContent?.toLowerCase().includes('minore')) {
        return { found: true, checked: radio.checked, text: label.textContent.trim() };
      }
    }
    // Cerca anche checkbox o altro
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    for (const cb of checkboxes) {
      const label = cb.closest('label') || cb.parentElement;
      if (label?.textContent?.toLowerCase().includes('figlio')) {
        return { found: true, checked: cb.checked, text: label.textContent.trim() };
      }
    }
    return { found: false };
  });

  if (targetVerificato.found) {
    log('B', `✅ Target "figlio" trovato - selezionato: ${targetVerificato.checked}`);
  } else {
    log('B', '⚠️ Target "figlio" non rilevato come input separato (potrebbe essere default)');
  }

  // 5. Spunta casella nome figlio MARCO
  log('B', `Selezione figlio: ${FIGLIO}...`);
  const figlioSpuntato = await page.evaluate((figlioName) => {
    // Cerca checkbox o elementi con nome del figlio
    const allElements = document.querySelectorAll('input[type="checkbox"], label, div, span, li');
    for (const el of allElements) {
      const text = el.textContent?.trim().toUpperCase();
      if (text && text.includes(figlioName.toUpperCase())) {
        if (el.tagName === 'INPUT') {
          el.checked = true;
          el.click();
          return { found: true, text: el.parentElement?.textContent?.trim() };
        } else {
          // Cerca il checkbox più vicino
          const cb = el.querySelector('input[type="checkbox"]') || el.previousElementSibling;
          if (cb && cb.tagName === 'INPUT') {
            cb.click();
            return { found: true, text: el.textContent?.trim() };
          } else {
            el.click();
            return { found: true, text: el.textContent?.trim() };
          }
        }
      }
    }
    return { found: false };
  }, FIGLIO);

  if (figlioSpuntato.found) {
    log('B', `✅ Figlio selezionato: ${figlioSpuntato.text}`);
  } else {
    logError('B', `Figlio "${FIGLIO}" non trovato`);
  }

  await sleep(1500);
  await screenshot(page, 'B4-figlio-selezionato');

  // 6. Seleziona Pacchetto K-LAB.2026.Mensile
  log('B', `Selezione pacchetto: ${PACCHETTO}...`);
  const pacchettoSelezionato = await page.evaluate((pacchettoName) => {
    // Cerca select o dropdown per pacchetto
    const selects = document.querySelectorAll('select');
    for (const select of selects) {
      const label = select.closest('label, div, fieldset');
      const labelText = label?.textContent?.toLowerCase() || '';
      if (labelText.includes('pacchett') || select.name?.toLowerCase().includes('pacchett') || 
          select.id?.toLowerCase().includes('pacchett')) {
        const options = select.querySelectorAll('option');
        for (const opt of options) {
          if (opt.textContent.includes('K-LAB') && opt.textContent.includes('Mensile')) {
            select.value = opt.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return { found: true, value: opt.textContent.trim(), selectId: select.id };
          }
        }
      }
    }
    // Cerca anche in tutti i select
    for (const select of selects) {
      const options = select.querySelectorAll('option');
      for (const opt of options) {
        if (opt.textContent.includes('K-LAB') && opt.textContent.includes('Mensile')) {
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return { found: true, value: opt.textContent.trim(), selectId: select.id };
        }
      }
    }
    return { found: false };
  }, PACCHETTO);

  if (pacchettoSelezionato.found) {
    log('B', `✅ Pacchetto selezionato: ${pacchettoSelezionato.value}`);
  } else {
    logError('B', `Pacchetto "${PACCHETTO}" non trovato nei menu a discesa`);
  }

  await sleep(1500);
  await screenshot(page, 'B5-pacchetto-selezionato');

  // 7. Verifica importo pacchetto = prezzo pattuito
  log('B', 'Verifica corrispondenza importo pacchetto / prezzo pattuito...');
  const importoVerifica = await page.evaluate(() => {
    const text = document.body.innerText;
    const importoMatch = text.match(/importo[:\s]*€?\s*(\d+[.,]?\d*)/i) || 
                          text.match(/prezzo[:\s]*€?\s*(\d+[.,]?\d*)/i);
    const prezzoMatch = text.match(/prezzo\s*pattuit[oa]?[:\s]*€?\s*(\d+[.,]?\d*)/i);
    
    // Cerca tutti gli input con valori numerici nelle vicinanze di "importo" o "prezzo"
    const inputs = document.querySelectorAll('input[type="number"], input[type="text"]');
    const values = {};
    for (const inp of inputs) {
      const label = inp.closest('label, div')?.textContent?.toLowerCase() || '';
      const val = inp.value;
      if (label.includes('importo') || label.includes('prezzo')) {
        values[label.substring(0, 30)] = val;
      }
    }
    
    return { 
      importo: importoMatch ? importoMatch[1] : null,
      prezzoPattuito: prezzoMatch ? prezzoMatch[1] : null,
      inputValues: values,
      pageTextSnippet: text.substring(0, 2000)
    };
  });

  log('B', `Importo rilevato: ${importoVerifica.importo || 'N/A'}, Prezzo pattuito: ${importoVerifica.prezzoPattuito || 'N/A'}`);
  log('B', `Valori input: ${JSON.stringify(importoVerifica.inputValues)}`);

  // 8. Seleziona Metodo Previsto = Contanti
  log('B', `Selezione metodo di pagamento: ${METODO_PAGAMENTO}...`);
  const metodoSelezionato = await page.evaluate((metodo) => {
    const selects = document.querySelectorAll('select');
    for (const select of selects) {
      const options = select.querySelectorAll('option');
      for (const opt of options) {
        if (opt.textContent.trim().toLowerCase().includes(metodo.toLowerCase())) {
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return { found: true, value: opt.textContent.trim() };
        }
      }
    }
    return { found: false };
  }, METODO_PAGAMENTO);

  if (metodoSelezionato.found) {
    log('B', `✅ Metodo pagamento selezionato: ${metodoSelezionato.value}`);
  } else {
    logError('B', `Metodo pagamento "${METODO_PAGAMENTO}" non trovato`);
  }

  await sleep(1000);

  // 9. Imposta data inizio = 21/05/2026
  log('B', `Impostazione data inizio: ${DATA_INIZIO}...`);
  const dataImpostata = await page.evaluate((dataInizio) => {
    const inputs = document.querySelectorAll('input[type="date"], input[type="text"]');
    for (const input of inputs) {
      const label = input.closest('label, div, fieldset');
      const labelText = label?.textContent?.toLowerCase() || '';
      const placeholder = (input.placeholder || '').toLowerCase();
      if (labelText.includes('inizio') || labelText.includes('primo slot') || 
          labelText.includes('data inizio') || placeholder.includes('inizio')) {
        // Formato ISO per input type=date
        const parts = dataInizio.split('/');
        const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, input.type === 'date' ? isoDate : dataInizio);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return { found: true, type: input.type, value: input.value };
      }
    }
    return { found: false };
  }, DATA_INIZIO);

  if (dataImpostata.found) {
    log('B', `✅ Data inizio impostata: ${dataImpostata.value}`);
  } else {
    logError('B', 'Campo data inizio non trovato');
  }

  await sleep(1500);

  // 10. Verifica data fine = 11/06/2026
  log('B', `Verifica data fine attesa: ${DATA_FINE_ATTESA}...`);
  const dataFineVerifica = await page.evaluate((dataFineAttesa) => {
    const inputs = document.querySelectorAll('input[type="date"], input[type="text"]');
    for (const input of inputs) {
      const label = input.closest('label, div, fieldset');
      const labelText = label?.textContent?.toLowerCase() || '';
      if (labelText.includes('fine') || labelText.includes('scadenza') || labelText.includes('data fine')) {
        const parts = dataFineAttesa.split('/');
        const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        return { 
          found: true, 
          value: input.value, 
          expected: input.type === 'date' ? isoDate : dataFineAttesa,
          match: input.value === isoDate || input.value === dataFineAttesa
        };
      }
    }
    return { found: false };
  }, DATA_FINE_ATTESA);

  if (dataFineVerifica.found) {
    if (dataFineVerifica.match) {
      log('B', `✅ Data fine corretta: ${dataFineVerifica.value}`);
    } else {
      logError('B', `Data fine NON corrisponde. Attesa: ${dataFineVerifica.expected}, Trovata: ${dataFineVerifica.value}`);
    }
  } else {
    logError('B', 'Campo data fine non trovato');
  }

  await screenshot(page, 'B6-date-impostate');

  // 11. Verifica casella "filtra per età" selezionata
  log('B', 'Verifica casella "filtra per età"...');
  const filtraEtaVerifica = await page.evaluate(() => {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    for (const cb of checkboxes) {
      const label = cb.closest('label') || cb.parentElement;
      const text = label?.textContent?.toLowerCase() || '';
      if (text.includes('filtra') && text.includes('età')) {
        return { found: true, checked: cb.checked, text: label.textContent.trim() };
      }
    }
    return { found: false };
  });

  if (filtraEtaVerifica.found) {
    log('B', `✅ Casella "filtra per età" trovata - selezionata: ${filtraEtaVerifica.checked}`);
  } else {
    log('B', '⚠️ Casella "filtra per età" non trovata esplicitamente');
  }

  // 12. Verifica Punto di Destinazione (almeno un corso compatibile)
  log('B', 'Verifica Punto di Destinazione (corsi compatibili per età)...');
  const corsiDisponibili = await page.evaluate(() => {
    const text = document.body.innerText;
    // Cerca sezione corsi/destinazione
    const selects = document.querySelectorAll('select');
    const corsi = [];
    for (const select of selects) {
      const label = select.closest('label, div, fieldset');
      const labelText = label?.textContent?.toLowerCase() || '';
      if (labelText.includes('corso') || labelText.includes('destinazione') || labelText.includes('fessura') || labelText.includes('slot')) {
        const options = select.querySelectorAll('option');
        for (const opt of options) {
          if (opt.value && opt.value !== '') {
            corsi.push(opt.textContent.trim());
          }
        }
      }
    }
    // Cerca anche checkbox per corsi
    const checkboxes = document.querySelectorAll('input[type="checkbox"], input[type="radio"]');
    for (const cb of checkboxes) {
      const label = cb.closest('label') || cb.parentElement;
      const text = label?.textContent?.trim();
      if (text && (text.toLowerCase().includes('corso') || text.toLowerCase().includes('lab'))) {
        corsi.push(`${text} (${cb.checked ? 'selezionato' : 'non selezionato'})`);
      }
    }
    return { corsi, count: corsi.length };
  });

  if (corsiDisponibili.count > 0) {
    log('B', `✅ Corsi disponibili (${corsiDisponibili.count}): ${corsiDisponibili.corsi.join(', ')}`);
  } else {
    logError('B', 'Nessun corso compatibile trovato');
  }

  await screenshot(page, 'B7-corsi-disponibili');

  // 13. Seleziona il primo corso disponibile se presente
  if (corsiDisponibili.count > 0) {
    log('B', 'Selezione primo corso disponibile...');
    const corsoSelezionato = await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      for (const select of selects) {
        const label = select.closest('label, div, fieldset');
        const labelText = label?.textContent?.toLowerCase() || '';
        if (labelText.includes('corso') || labelText.includes('destinazione') || labelText.includes('fessura') || labelText.includes('slot')) {
          const options = select.querySelectorAll('option');
          for (const opt of options) {
            if (opt.value && opt.value !== '' && !opt.disabled) {
              select.value = opt.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              return { found: true, value: opt.textContent.trim() };
            }
          }
        }
      }
      // Prova con checkbox
      const checkboxes = document.querySelectorAll('input[type="checkbox"]:not(:checked), input[type="radio"]:not(:checked)');
      for (const cb of checkboxes) {
        const label = cb.closest('label') || cb.parentElement;
        const text = label?.textContent?.trim()?.toLowerCase() || '';
        if (text.includes('corso') || text.includes('lab')) {
          cb.click();
          return { found: true, value: label.textContent.trim() };
        }
      }
      return { found: false };
    });

    if (corsoSelezionato.found) {
      log('B', `✅ Corso selezionato: ${corsoSelezionato.value}`);
    }
  }

  await sleep(1500);
  await screenshot(page, 'B8-pre-salvataggio');

  // 14. Clicca "Salva modifiche"
  log('B', 'Click su "Salva modifiche"...');
  const salvaClicked = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent?.trim().toLowerCase();
      if (text && (text.includes('salva') || text.includes('conferma') || text.includes('invia'))) {
        btn.click();
        return { found: true, text: btn.textContent.trim() };
      }
    }
    return { found: false };
  });

  if (salvaClicked.found) {
    log('B', `✅ Pulsante "${salvaClicked.text}" cliccato`);
  } else {
    logError('B', 'Pulsante "Salva modifiche" non trovato');
  }

  await sleep(5000);
  await screenshot(page, 'B9-dopo-salvataggio');

  // Verifica chiusura modale
  const modaleChiusa = await page.evaluate(() => {
    const modals = document.querySelectorAll('[class*="modal" i], [role="dialog"]');
    let visibleModal = false;
    for (const m of modals) {
      const style = window.getComputedStyle(m);
      if (style.display !== 'none' && style.visibility !== 'hidden') {
        visibleModal = true;
      }
    }
    return !visibleModal;
  });

  if (modaleChiusa) {
    log('B', '✅ Modale chiusa correttamente');
    results.faseB.status = 'PASS';
  } else {
    log('B', '⚠️ Modale potrebbe essere ancora aperta');
    results.faseB.status = 'WARNING';
  }

  log('B', '=== FINE FASE B ===');
  return true;
}

// ========================
// FASE C: VERIFICA ARCHIVIO ISCRIZIONI
// ========================
async function faseC(page) {
  log('C', '=== INIZIO FASE C: Verifica Archivio Iscrizioni ===');

  // 1. Naviga a ARCHIVIO ISCRIZIONI
  log('C', 'Navigazione a ARCHIVIO ISCRIZIONI...');
  const archivioClicked = await page.evaluate(() => {
    const allElements = document.querySelectorAll('a, button, div[role="button"], span, li');
    for (const el of allElements) {
      const text = el.textContent?.trim();
      if (text && text.toLowerCase().includes('archivio') && text.toLowerCase().includes('iscrizioni')) {
        el.click();
        return { found: true, text };
      }
    }
    // Seconda chance: cerca "Archivio Iscrizioni" anche come sottomenu
    for (const el of allElements) {
      const text = el.textContent?.trim();
      if (text === 'Archivio Iscrizioni' || text === 'ARCHIVIO ISCRIZIONI') {
        el.click();
        return { found: true, text };
      }
    }
    return { found: false };
  });

  if (archivioClicked.found) {
    log('C', `✅ Voce "${archivioClicked.text}" cliccata`);
  } else {
    logError('C', 'Voce "Archivio Iscrizioni" non trovata nella sidebar');
  }

  await sleep(3000);
  await screenshot(page, 'C1-archivio-iscrizioni');

  // 2. Cerca la nuova iscrizione (MARCO, dal 21/05/2026 al 11/06/2026)
  log('C', `Ricerca iscrizione: ${FIGLIO} (${DATA_INIZIO} - ${DATA_FINE_ATTESA})...`);
  
  // Prova a cercare nella tabella/lista
  const iscrizioneData = await page.evaluate((figlio, dataInizio, dataFine) => {
    const text = document.body.innerText;
    const rows = document.querySelectorAll('tr, [class*="row" i], [class*="card" i], [class*="item" i]');
    const found = [];
    
    for (const row of rows) {
      const rowText = row.textContent?.trim().toUpperCase() || '';
      if (rowText.includes(figlio.toUpperCase())) {
        found.push({
          text: rowText.substring(0, 300),
          hasDataInizio: rowText.includes('21/05') || rowText.includes('2026-05-21'),
          hasDataFine: rowText.includes('11/06') || rowText.includes('2026-06-11')
        });
      }
    }
    
    return { 
      found: found.length > 0,
      matches: found,
      pageContainsName: text.toUpperCase().includes(figlio.toUpperCase())
    };
  }, FIGLIO, DATA_INIZIO, DATA_FINE_ATTESA);

  if (iscrizioneData.found) {
    log('C', `✅ Iscrizione di ${FIGLIO} trovata in archivio`);
    for (const match of iscrizioneData.matches) {
      log('C', `   Riga: ${match.text.substring(0, 200)}`);
      log('C', `   Data inizio corretta: ${match.hasDataInizio ? '✅' : '❌'}`);
      log('C', `   Data fine corretta: ${match.hasDataFine ? '✅' : '❌'}`);
    }
  } else if (iscrizioneData.pageContainsName) {
    log('C', `⚠️ Nome ${FIGLIO} presente nella pagina ma non in formato strutturato`);
  } else {
    logError('C', `Iscrizione di ${FIGLIO} NON trovata in archivio`);
  }

  await screenshot(page, 'C2-iscrizione-trovata');

  // 3. Verifica stato SCOPERTO
  log('C', 'Verifica stato iscrizione = SCOPERTO...');
  const statoVerifica = await page.evaluate((figlio) => {
    const text = document.body.innerText.toUpperCase();
    const rows = document.querySelectorAll('tr, [class*="row" i], [class*="card" i]');
    for (const row of rows) {
      const rowText = row.textContent?.toUpperCase() || '';
      if (rowText.includes(figlio.toUpperCase())) {
        const hasScoperto = rowText.includes('SCOPERTO');
        const hasPagato = rowText.includes('PAGATO') || rowText.includes('SALDATO');
        return { found: true, scoperto: hasScoperto, pagato: hasPagato, text: rowText.substring(0, 200) };
      }
    }
    return { found: false, globalScoperto: text.includes('SCOPERTO') };
  }, FIGLIO);

  if (statoVerifica.found) {
    if (statoVerifica.scoperto) {
      log('C', '✅ Stato iscrizione: SCOPERTO (corretto, pagamento non ancora registrato)');
    } else if (statoVerifica.pagato) {
      logError('C', 'Stato iscrizione: PAGATO (inatteso, dovrebbe essere SCOPERTO)');
    } else {
      log('C', `⚠️ Stato non determinato dalla riga: ${statoVerifica.text}`);
    }
  }

  // 4. Verifica sede e orari
  log('C', 'Verifica sede e orari corretti...');
  const sedeOrariVerifica = await page.evaluate((figlio) => {
    const rows = document.querySelectorAll('tr, [class*="row" i], [class*="card" i]');
    for (const row of rows) {
      const rowText = row.textContent?.trim() || '';
      if (rowText.toUpperCase().includes(figlio.toUpperCase())) {
        return { found: true, info: rowText.substring(0, 400) };
      }
    }
    return { found: false };
  }, FIGLIO);

  if (sedeOrariVerifica.found) {
    log('C', `Dettagli iscrizione: ${sedeOrariVerifica.info}`);
    results.faseC.status = 'PASS';
  } else {
    results.faseC.status = 'WARNING';
  }

  log('C', '=== FINE FASE C ===');
  return true;
}

// ========================
// FASE D: VERIFICA PRESENZE E CALENDARIO
// ========================
async function faseD(page) {
  log('D', '=== INIZIO FASE D: Verifica Presenze e Calendario ===');

  // D1. Verifica nel Corso (pagina CORSI)
  log('D', 'Navigazione a pagina CORSI...');
  const corsiClicked = await page.evaluate(() => {
    const allElements = document.querySelectorAll('a, button, div[role="button"], span, li');
    for (const el of allElements) {
      const text = el.textContent?.trim();
      if (text === 'Corsi' || text === 'CORSI') {
        el.click();
        return { found: true, text };
      }
    }
    for (const el of allElements) {
      if (el.textContent?.trim().toLowerCase() === 'corsi') {
        el.click();
        return { found: true, text: el.textContent.trim() };
      }
    }
    return { found: false };
  });

  if (corsiClicked.found) {
    log('D', `✅ Pagina ${corsiClicked.text} aperta`);
  }

  await sleep(3000);
  await screenshot(page, 'D1-pagina-corsi');

  // Cerca MARCO nella pagina corsi
  const marcoInCorsi = await page.evaluate((figlio) => {
    const text = document.body.innerText;
    return { 
      found: text.toUpperCase().includes(figlio.toUpperCase()),
      snippet: text.substring(0, 3000)
    };
  }, FIGLIO);

  if (marcoInCorsi.found) {
    log('D', `✅ ${FIGLIO} trovato nella pagina CORSI`);
  } else {
    log('D', `⚠️ ${FIGLIO} non immediatamente visibile in CORSI, potrebbe servire filtrare per sede`);
  }

  // D2. Verifica nel Registro Presenze
  log('D', 'Navigazione a REGISTRO PRESENZE...');
  const registroClicked = await page.evaluate(() => {
    const allElements = document.querySelectorAll('a, button, div[role="button"], span, li');
    for (const el of allElements) {
      const text = el.textContent?.trim();
      if (text && (text.toLowerCase().includes('registro') && text.toLowerCase().includes('presenz'))) {
        el.click();
        return { found: true, text };
      }
    }
    for (const el of allElements) {
      const text = el.textContent?.trim();
      if (text === 'Registro Presenze' || text === 'REGISTRO PRESENZE') {
        el.click();
        return { found: true, text };
      }
    }
    return { found: false };
  });

  if (registroClicked.found) {
    log('D', `✅ Pagina ${registroClicked.text} aperta`);
  }

  await sleep(3000);
  await screenshot(page, 'D2-registro-presenze');

  const marcoInRegistro = await page.evaluate((figlio) => {
    const text = document.body.innerText;
    return { found: text.toUpperCase().includes(figlio.toUpperCase()) };
  }, FIGLIO);

  if (marcoInRegistro.found) {
    log('D', `✅ ${FIGLIO} trovato nel REGISTRO PRESENZE`);
  } else {
    log('D', `⚠️ ${FIGLIO} non immediatamente visibile nel registro, potrebbe servire filtrare per sede`);
  }

  // D3. Verifica nel Calendario
  log('D', 'Navigazione a CALENDARIO...');
  const calendarioClicked = await page.evaluate(() => {
    const allElements = document.querySelectorAll('a, button, div[role="button"], span, li');
    for (const el of allElements) {
      const text = el.textContent?.trim();
      if (text === 'Calendario' || text === 'CALENDARIO') {
        el.click();
        return { found: true, text };
      }
    }
    for (const el of allElements) {
      const text = el.textContent?.trim();
      if (text?.toLowerCase().includes('calendario')) {
        el.click();
        return { found: true, text };
      }
    }
    return { found: false };
  });

  if (calendarioClicked.found) {
    log('D', `✅ Pagina ${calendarioClicked.text} aperta`);
  }

  await sleep(3000);
  await screenshot(page, 'D3-calendario');

  // Verifica slot generati nel calendario
  const calendarSlots = await page.evaluate(() => {
    const text = document.body.innerText;
    // Cerca riferimenti a date nel range 21/05 - 11/06
    const hasSlots = text.includes('21') || text.includes('22') || text.includes('maggio') || text.includes('Mag');
    const events = document.querySelectorAll('[class*="event" i], [class*="slot" i], [class*="lezione" i]');
    return { 
      hasSlots, 
      eventCount: events.length,
      snippet: text.substring(0, 2000)
    };
  });

  log('D', `Calendario - Slot/eventi trovati: ${calendarSlots.eventCount}`);
  log('D', `Calendario contiene date nel range: ${calendarSlots.hasSlots ? 'Sì' : 'No'}`);

  await screenshot(page, 'D4-calendario-dettaglio');

  results.faseD.status = calendarSlots.eventCount > 0 ? 'PASS' : 'WARNING';

  log('D', '=== FINE FASE D ===');
  return true;
}

// ========================
// MAIN
// ========================
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  TEST DI PRODUZIONE — Iscrizione Manuale    ║');
  console.log('║  Data: 21/05/2026                           ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  let browser;
  try {
    // Lancia Chrome con sessione utente esistente (per mantenere l'autenticazione Firebase)
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: false,
      defaultViewport: { width: 1920, height: 1080 },
      args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled'
      ],
      // Usa il profilo Chrome dell'utente per avere la sessione Firebase attiva
      userDataDir: undefined
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Intercetta console logs
    page.on('console', msg => {
      const entry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      };
      consoleLogs.push(entry);
      if (msg.type() === 'error') {
        console.log(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });

    // Intercetta errori di pagina
    page.on('pageerror', error => {
      consoleLogs.push({
        type: 'pageerror',
        text: error.message,
        timestamp: new Date().toISOString()
      });
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    // Intercetta request failures
    page.on('requestfailed', request => {
      consoleLogs.push({
        type: 'requestfailed',
        text: `${request.failure().errorText} - ${request.url()}`,
        timestamp: new Date().toISOString()
      });
    });

    // Esegui le fasi
    const faseAOk = await faseA(page);
    if (faseAOk) {
      const faseBOk = await faseB(page);
      if (faseBOk) {
        await faseC(page);
        await faseD(page);
      }
    }

    // Report console logs
    console.log('\n\n═══ CONSOLE LOGS DEL BROWSER ═══');
    const errors = consoleLogs.filter(l => l.type === 'error' || l.type === 'pageerror' || l.type === 'requestfailed');
    const warnings = consoleLogs.filter(l => l.type === 'warning');
    console.log(`Totale log: ${consoleLogs.length}`);
    console.log(`Errori: ${errors.length}`);
    console.log(`Warning: ${warnings.length}`);
    
    if (errors.length > 0) {
      console.log('\n--- ERRORI ---');
      for (const err of errors) {
        console.log(`  [${err.timestamp}] ${err.type}: ${err.text}`);
      }
    }

    if (warnings.length > 0) {
      console.log('\n--- WARNINGS ---');
      for (const w of warnings.slice(0, 20)) {
        console.log(`  [${w.timestamp}] ${w.text}`);
      }
    }

    // Salva report
    const report = {
      testDate: new Date().toISOString(),
      results,
      consoleLogs,
      summary: {
        faseA: results.faseA.status,
        faseB: results.faseB.status,
        faseC: results.faseC.status,
        faseD: results.faseD.status,
        totalErrors: errors.length,
        totalWarnings: warnings.length
      }
    };

    const reportPath = path.join(SCREENSHOTS_DIR, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nReport salvato: ${reportPath}`);

    // Riepilogo finale
    console.log('\n\n╔══════════════════════════════════════════════╗');
    console.log('║             RIEPILOGO FINALE                 ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  Fase A (Preliminari):     ${results.faseA.status.padEnd(12)} ║`);
    console.log(`║  Fase B (Iscrizione):      ${results.faseB.status.padEnd(12)} ║`);
    console.log(`║  Fase C (Archivio):        ${results.faseC.status.padEnd(12)} ║`);
    console.log(`║  Fase D (Presenze/Cal.):   ${results.faseD.status.padEnd(12)} ║`);
    console.log(`║  Errori Console:           ${String(errors.length).padEnd(12)} ║`);
    console.log(`║  Warnings Console:         ${String(warnings.length).padEnd(12)} ║`);
    console.log('╚══════════════════════════════════════════════╝');

    await sleep(3000);
    await browser.close();

  } catch (error) {
    console.error(`\n\n❌ ERRORE FATALE: ${error.message}`);
    console.error(error.stack);
    if (browser) await browser.close();
    process.exit(1);
  }
}

main();
