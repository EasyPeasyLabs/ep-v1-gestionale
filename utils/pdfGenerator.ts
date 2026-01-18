
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { Invoice, Quote, CompanyInfo, Client, DocumentItem, ParentClient, InstitutionalClient, ClientType, Installment } from '../types';

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT');
};

const formatDateForFilename = (dateString: string) => {
    const d = new Date(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
};

// Helper to load image from URL to Base64 using fetch (more robust than canvas)
const loadImage = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.warn("Impossibile caricare il logo:", error);
        return '';
    }
};

export const generateDocumentPDF = async (
    doc: Invoice | Quote,
    type: 'Fattura' | 'Preventivo',
    // FIX: Explicitly marked as optional with ? to resolve call site mismatches where only 2-3 args might be expected
    companyInfo?: CompanyInfo | null,
    client?: Client | undefined,
    previewMode: boolean = false // New Parameter
): Promise<string | void> => { // Returns string (URL) if previewMode is true
    const docPdf = new jsPDF();
    
    // Colors
    const primaryColor = [63, 81, 181] as [number, number, number]; // Indigo
    const grayColor = [117, 117, 117] as [number, number, number];
    const lightGrayColor = [220, 220, 220] as [number, number, number];
    const labelColor = [100, 100, 100] as [number, number, number]; // Grigio scuro per etichette

    // --- GRID LAYOUT CONSTANTS (Compact 2x5) ---
    const marginX = 14;
    const pageWidth = docPdf.internal.pageSize.getWidth();
    const rightAlignX = pageWidth - marginX;
    
    // Column X positions
    // Col 1: Logo / Label (Starts at marginX = 14)
    // Col 2: Data (Starts after logo width + gap)
    const logoSize = 20;
    const col2X = marginX + logoSize + 4; // 14 + 20 + 4 = 38
    
    // Row Y Positions
    const row1Y = 10;       // Top Row (Logo Start)
    // Spostiamo la linea divisoria più in basso per farci stare i dati del documento
    const dividerY = 40;    
    const row2Y = 45;       // Second Row (Client Data)

    // ============================================================
    // RIGA 1
    // Col 1: Logo (20x20)
    // Col 2: Dati Aziendali
    // Col 5: Nome Documento + Dati (Right Aligned)
    // ============================================================
    
    // --- Col 1: Logo ---
    try {
        let logoData = '';
        if (companyInfo?.logoBase64) {
            logoData = companyInfo.logoBase64;
        } else {
            const logoUrl = `${window.location.origin}/lemon_logo_150px.png`;
            logoData = await loadImage(logoUrl);
        }

        if (logoData) {
            const isJpeg = logoData.substring(0, 30).includes('image/jpeg');
            const format = isJpeg ? 'JPEG' : 'PNG';
            docPdf.addImage(logoData, format, marginX, row1Y, logoSize, logoSize);
        }
    } catch (e) {
        console.warn("Logo processing error", e);
    }

    // --- Col 2: Dati Aziendali (Custom Layout) ---
    // Logo Y range: 10 (Top) to 30 (Bottom)
    
    if (companyInfo) {
        docPdf.setTextColor(0, 0, 0);

        // 1. Denominazione (Allineata in alto col logo)
        // Font Size 12 fa sì che la baseline a row1Y + 4 (14) porti il "tetto" delle maiuscole a circa 10 (Top Logo)
        if (companyInfo.denomination) {
            docPdf.setFontSize(12); 
            docPdf.setFont("helvetica", "bold");
            docPdf.text(companyInfo.denomination.toUpperCase(), col2X, row1Y + 4);
        }
        
        // 2. Nome (Spaziato dalla denominazione)
        // Baseline a 20. Grande gap rispetto alla riga sopra.
        docPdf.setFontSize(10);
        docPdf.setFont("helvetica", "normal");
        docPdf.text(companyInfo.name, col2X, row1Y + 10); 

        // 3. Indirizzo (Intermedio)
        // Baseline a 25.
        docPdf.setFontSize(8);
        docPdf.setTextColor(...grayColor);
        
        let fullAddress = companyInfo.address;
        if (companyInfo.city || companyInfo.zipCode || companyInfo.province) {
            const zip = companyInfo.zipCode ? `${companyInfo.zipCode} ` : '';
            const prov = companyInfo.province ? ` (${companyInfo.province})` : '';
            const city = companyInfo.city || '';
            // If address doesn't contain city info already, append it
            if (!fullAddress.includes(city)) {
                fullAddress = `${fullAddress}, ${zip}${city}${prov}`;
            }
        }

        docPdf.text(`${fullAddress} - P.IVA: ${companyInfo.vatNumber}`, col2X, row1Y + 15);
        
        // 4. Contatti (Allineati col bordo basso del logo)
        // Baseline a 30 (row1Y + logoSize).
        docPdf.text(`${companyInfo.email} - ${companyInfo.phone}`, col2X, row1Y + 20);

    } else {
        docPdf.setFontSize(8);
        docPdf.text("Dati Aziendali non configurati", col2X, row1Y + 5);
    }

    // --- Col 5: Dati Documento (Right Aligned) ---
    // TITOLO
    docPdf.setFontSize(16);
    docPdf.setTextColor(...primaryColor);
    docPdf.setFont("helvetica", "bold");
    const title = type === 'Fattura' && (doc as Invoice).isGhost ? 'FATTURA PRO-FORMA' : type.toUpperCase();
    docPdf.text(title, rightAlignX, row1Y + 8, { align: 'right' });

    // DETTAGLI (Sotto il titolo, sopra la linea)
    let docDataY = row1Y + 14;
    const docNumber = type === 'Fattura' ? (doc as Invoice).invoiceNumber : (doc as Quote).quoteNumber;
    const issueDate = formatDate(doc.issueDate);
    
    docPdf.setFontSize(9);
    docPdf.setTextColor(0, 0, 0);
    docPdf.setFont("helvetica", "normal");

    // Numero
    docPdf.text(`Numero:`, rightAlignX - 35, docDataY, { align: 'left'});
    docPdf.setFont("helvetica", "bold");
    docPdf.text(docNumber, rightAlignX, docDataY, { align: 'right' });
    docDataY += 4;

    // Data
    docPdf.setFont("helvetica", "normal");
    docPdf.text(`Data:`, rightAlignX - 35, docDataY, { align: 'left'});
    docPdf.setFont("helvetica", "bold");
    docPdf.text(issueDate, rightAlignX, docDataY, { align: 'right' });
    docDataY += 4;
    
    // SDI (Solo Fatture)
    if (type === 'Fattura' && (doc as Invoice).sdiCode) {
        docPdf.setFont("helvetica", "normal");
        docPdf.text(`SDI/PEC:`, rightAlignX - 35, docDataY, { align: 'left'});
        docPdf.text((doc as Invoice).sdiCode || '', rightAlignX, docDataY, { align: 'right' });
    }


    // ============================================================
    // DIVISORE (Sottile)
    // ============================================================
    docPdf.setDrawColor(...lightGrayColor);
    docPdf.setLineWidth(0.1);
    docPdf.line(marginX, dividerY, rightAlignX, dividerY);


    // ============================================================
    // RIGA 2
    // Col 1: Etichetta "CLIENTE" (Grigio, Small, Bold)
    // Col 2: Dati Cliente
    // ============================================================

    // --- Col 1: Etichetta ---
    docPdf.setFontSize(7);
    docPdf.setTextColor(...labelColor);
    docPdf.setFont("helvetica", "bold");
    // Determina etichetta corretta
    const labelText = "CLIENTE"; 
    docPdf.text(labelText, marginX, row2Y); // Allineato alla baseline del nome

    // --- Col 2: Dati Cliente ---
    let clientY = row2Y;
    docPdf.setFontSize(9);
    docPdf.setTextColor(0, 0, 0);
    
    if (client) {
        docPdf.setFont("helvetica", "bold");
        if (client.clientType === ClientType.Parent) {
            const p = client as ParentClient;
            docPdf.text(`${p.firstName} ${p.lastName}`, col2X, clientY); // Nome
            clientY += 6; // Maggiore spazio dopo il nome
            docPdf.setFont("helvetica", "normal");
            docPdf.text(p.address, col2X, clientY);
            clientY += 4;
            docPdf.text(`${p.zipCode} ${p.city} (${p.province})`, col2X, clientY);
            clientY += 4;
            docPdf.text(`CF: ${p.taxCode}`, col2X, clientY);
        } else {
            const i = client as InstitutionalClient;
            docPdf.text(i.companyName, col2X, clientY);
            clientY += 6; // Maggiore spazio dopo la ragione sociale
            docPdf.setFont("helvetica", "normal");
            docPdf.text(i.address, col2X, clientY);
            clientY += 4;
            docPdf.text(`${i.zipCode} ${i.city} (${i.province})`, col2X, clientY);
            clientY += 4;
            docPdf.text(`P.IVA: ${i.vatNumber}`, col2X, clientY);
        }
    } else {
        docPdf.setFont("helvetica", "bold");
        docPdf.text(doc.clientName, col2X, clientY);
    }


    // ============================================================
    // TABELLA ARTICOLI
    // ============================================================
    
    const tableStartY = 85; // Start closer to header

    // NOTE: Updated PDF logic to reflect row discounts if present
    const tableColumn = ["Descrizione", "Quantità", "Prezzo Unit.", "Totale"];
    let tableRows: any[] = [];

    if (type === 'Fattura' && (doc as Invoice).relatedQuoteNumber) {
        tableRows.push([{
            content: `Rif. ns. documento ${(doc as Invoice).relatedQuoteNumber}`,
            colSpan: 4,
            styles: { fontStyle: 'italic', textColor: [100, 100, 100], fillColor: [248, 248, 248], halign: 'left' }
        }]);
    }

    let calculatedSubtotal = 0;

    const itemRows = doc.items.map((item: DocumentItem) => {
        const desc = item.notes ? `${item.description}\n${item.notes}` : item.description;
        
        const gross = item.quantity * item.price;
        let discountAmount = 0;
        
        // Calculate Discount logic for PDF view
        if (item.discount) {
            if (item.discountType === 'percent') {
                discountAmount = gross * (item.discount / 100);
            } else {
                discountAmount = item.discount;
            }
        }
        const net = gross - discountAmount;
        calculatedSubtotal += net;

        return [
            desc,
            item.quantity,
            formatCurrency(item.price),
            formatCurrency(net) // Show net total
        ];
    });

    tableRows = [...tableRows, ...itemRows];

    autoTable(docPdf, {
        startY: tableStartY,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 30, halign: 'right' }
        },
    });

    // --- TOTALS SECTION ---
    let finalY = (docPdf as any).lastAutoTable?.finalY || tableStartY;
    
    // Apply Global Discount
    let globalDiscountVal = 0;
    if ('globalDiscount' in doc && doc.globalDiscount) {
        const inv = doc as Invoice;
        if (inv.globalDiscountType === 'percent') {
            // FIX TS18048: Handle possible undefined
            globalDiscountVal = calculatedSubtotal * ((inv.globalDiscount || 0) / 100);
        } else {
            globalDiscountVal = inv.globalDiscount || 0;
        }
    }

    const taxable = calculatedSubtotal - globalDiscountVal;
    const stampDuty = (type === 'Fattura' && (doc as Invoice).hasStampDuty) ? 2.00 : 0;
    const grandTotal = taxable + stampDuty;

    // Spacing before totals
    finalY += 5;

    docPdf.setFont("helvetica", "normal");
    docPdf.setFontSize(10);
    
    // Show Subtotal if discounts applied
    if (globalDiscountVal > 0) {
        docPdf.text(`Imponibile Lordo:`, 140, finalY + 5);
        docPdf.text(`${formatCurrency(calculatedSubtotal)}`, rightAlignX, finalY + 5, { align: 'right' });
        
        docPdf.setTextColor(200, 0, 0); // Red for discount
        docPdf.text(`Sconto Globale:`, 140, finalY + 10);
        docPdf.text(`-${formatCurrency(globalDiscountVal)}`, rightAlignX, finalY + 10, { align: 'right' });
        docPdf.setTextColor(0, 0, 0);
        finalY += 10;
    }

    docPdf.text(`Imponibile Netto:`, 140, finalY + 5);
    docPdf.text(`${formatCurrency(taxable)}`, rightAlignX, finalY + 5, { align: 'right' });

    if (type === 'Fattura' && (doc as Invoice).hasStampDuty) {
        docPdf.text(`Bollo Virtuale:`, 140, finalY + 10);
        docPdf.text(`${formatCurrency(stampDuty)}`, rightAlignX, finalY + 10, { align: 'right' });
        finalY += 5;
    }

    // Divider line for Total
    docPdf.setDrawColor(200, 200, 200);
    docPdf.line(140, finalY + 13, rightAlignX, finalY + 13);

    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(12);
    docPdf.text(`TOTALE:`, 140, finalY + 20);
    docPdf.text(`${formatCurrency(grandTotal)}`, rightAlignX, finalY + 20, { align: 'right' });

    // --- PAYMENT DEADLINE ---
    docPdf.setFontSize(9);
    docPdf.setFont("helvetica", "normal");
    docPdf.setTextColor(...grayColor);
    const expiryDate = type === 'Fattura' ? formatDate((doc as Invoice).dueDate) : formatDate((doc as Quote).expiryDate);
    const deadlineLabel = type === 'Fattura' ? "Scadenza:" : "Valido fino al:";
    docPdf.text(`${deadlineLabel} ${expiryDate}`, rightAlignX, finalY + 26, { align: 'right' });

    // --- FOOTER INFO (Payment & Notes) ---
    finalY += 35; 
    
    // Check page break for footer
    if (finalY > docPdf.internal.pageSize.height - 50) {
        docPdf.addPage();
        finalY = 20;
    }

    docPdf.setTextColor(0, 0, 0);
    docPdf.setFontSize(10);
    
    // Payment Method
    if ('paymentMethod' in doc && doc.paymentMethod) {
        docPdf.setFont("helvetica", "bold");
        docPdf.text("Modalità di Pagamento:", marginX, finalY);
        docPdf.setFont("helvetica", "normal");
        docPdf.text(`${doc.paymentMethod}`, marginX + 45, finalY);
    }

    // Installments Table
    if ('installments' in doc && doc.installments && doc.installments.length > 0) {
        finalY += 8;
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(9);
        docPdf.text("Piano Rateale", marginX, finalY);
        
        const quoteDoc = doc as Quote;
        const instRows = quoteDoc.installments.map((inst: Installment) => [
            inst.description,
            formatDate(inst.dueDate),
            formatCurrency(inst.amount),
            inst.isPaid ? 'Saldato' : 'Da Saldare'
        ]);

        autoTable(docPdf, {
            startY: finalY + 2,
            head: [['Descrizione', 'Scadenza', 'Importo', 'Stato']],
            body: instRows,
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 1 },
            headStyles: { fontStyle: 'bold', textColor: [100,100,100] },
            columnStyles: { 2: { halign: 'right' } },
            margin: { left: marginX, right: 120 } // Keep it compact on left
        });
        finalY = (docPdf as any).lastAutoTable?.finalY || finalY;
    }

    // --- NOTES BOX ---
    if (doc.notes && doc.notes.trim().length > 0) {
        finalY += 10;
        if (finalY > docPdf.internal.pageSize.height - 40) {
            docPdf.addPage();
            finalY = 20;
        }

        // Light background box for notes
        docPdf.setFillColor(250, 250, 250); 
        docPdf.setDrawColor(230, 230, 230);
        docPdf.rect(marginX, finalY, 180, 20, 'FD');

        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(8);
        docPdf.setTextColor(80, 80, 80);
        docPdf.text("NOTE:", marginX + 2, finalY + 5);
        
        docPdf.setFont("helvetica", "normal");
        docPdf.setTextColor(0, 0, 0);
        const splitNotes = docPdf.splitTextToSize(doc.notes, 175);
        docPdf.text(splitNotes, marginX + 2, finalY + 10);
        
        finalY += 25;
    }

    // Legal Footer
    // (Testo già presente nei PDF, ma ridondante se presente nelle note. Lo lasciamo come fallback)
    const footerText = "Operazione senza applicazione dell’IVA ai sensi dell’art. 1, commi da 54 a 89, Legge n. 190/2014.\nOperazione non soggetta a ritenuta alla fonte a titolo di acconto ai sensi dell’art. 1, comma 67, Legge n. 190/2014.";
    
    const pageHeight = docPdf.internal.pageSize.height;
    
    // Ensure footer is at bottom
    docPdf.setFontSize(7);
    docPdf.setTextColor(...grayColor);
    const splitFooter = docPdf.splitTextToSize(footerText, 180);
    docPdf.text(splitFooter, marginX, pageHeight - 15);

    if (previewMode) {
        // FIX TS2322: output('bloburl') might return URL type in recent definitions, cast to string
        return String(docPdf.output('bloburl'));
    }

    // Filename
    let filename = "";
    if (type === 'Fattura') {
        const numParts = docNumber.split('-');
        const shortNum = numParts.length > 0 ? numParts[numParts.length - 1] : docNumber;
        const dateStr = formatDateForFilename(doc.issueDate);
        const prefix = "FT";
        filename = `${prefix}${shortNum}_${dateStr}`;
        if ((doc as Invoice).isGhost) filename += "_PROFORMA";
    } else {
        filename = docNumber; 
    }

    docPdf.save(`${filename}.pdf`);
};
