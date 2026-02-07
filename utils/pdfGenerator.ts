
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

const footerText = "Operazione effettuata ai sensi dell'articolo 1, commi da 54 a 89, della Legge n. 190/2014 (Regime Forfettario).\nImposta di bollo da 2€ assolta sull'originale per importi superiori a 77,47€ se dovuta.";

export const generateDocumentPDF = async (
    doc: Invoice | Quote,
    type: 'Fattura' | 'Preventivo',
    companyInfo?: CompanyInfo | null,
    client?: Client | undefined,
    previewMode: boolean = false
): Promise<string | void> => { 
    const docPdf = new jsPDF();
    
    // Colors Palette (Enterprise)
    const blackColor = [0, 0, 0] as [number, number, number]; // Pure Black for text
    const grayColor = [100, 100, 100] as [number, number, number]; // Secondary Text
    const lightGrayColor = [230, 230, 230] as [number, number, number]; // Borders
    const headerTableColor = [50, 50, 60] as [number, number, number]; // Dark Slate for main table header
    const blockHeaderColor = [100, 100, 100] as [number, number, number]; // Dark Gray for block headers

    // --- GRID LAYOUT CONSTANTS ---
    const marginX = 14;
    const pageWidth = docPdf.internal.pageSize.getWidth();
    const pageHeight = docPdf.internal.pageSize.height;
    const rightAlignX = pageWidth - marginX;
    const contentWidth = pageWidth - (marginX * 2);
    
    // Safety Limits
    const footerHeight = 25; // Space reserved for legal footer
    const safePageLimit = pageHeight - footerHeight;
    const pageTopMargin = 20;

    // Row Y Positions
    const row1Y = 10;       
    const dividerY = 40;    
    const row2Y = 45;       

    // ============================================================
    // HELPER: PAGE BREAK CHECKER
    // ============================================================
    let currentY = 0;

    const checkPageBreak = (neededHeight: number) => {
        if (currentY + neededHeight > safePageLimit) {
            docPdf.addPage();
            currentY = pageTopMargin;
            return true;
        }
        return false;
    };

    const drawBlockHeader = (label: string) => {
        docPdf.setFillColor(...blockHeaderColor);
        docPdf.rect(marginX, currentY, contentWidth, 5, 'F'); 
        docPdf.setTextColor(255, 255, 255);
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(9);
        docPdf.text(label.toUpperCase(), marginX + 2, currentY + 3.5);
        currentY += 5; // Advance cursor past header
    };

    // ============================================================
    // RIGA 1: HEADER
    // ============================================================
    
    // --- Logo ---
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
            docPdf.addImage(logoData, format, marginX, row1Y, 20, 20);
        }
    } catch (e) {
        console.warn("Logo processing error", e);
    }

    const col2X = marginX + 20 + 4; 

    // --- Dati Aziendali ---
    if (companyInfo) {
        docPdf.setTextColor(...blackColor);

        // Denominazione
        if (companyInfo.denomination) {
            docPdf.setFontSize(12); 
            docPdf.setFont("helvetica", "bold");
            docPdf.text(companyInfo.denomination.toUpperCase(), col2X, row1Y + 4);
        }
        
        // Nome
        docPdf.setFontSize(10);
        docPdf.setFont("helvetica", "normal");
        docPdf.text(companyInfo.name, col2X, row1Y + 10); 

        // Indirizzo
        docPdf.setFontSize(8);
        docPdf.setTextColor(...grayColor);
        
        let fullAddress = companyInfo.address;
        if (companyInfo.city || companyInfo.zipCode || companyInfo.province) {
            const zip = companyInfo.zipCode ? `${companyInfo.zipCode} ` : '';
            const prov = companyInfo.province ? ` (${companyInfo.province})` : '';
            const city = companyInfo.city || '';
            if (!fullAddress.includes(city)) {
                fullAddress = `${fullAddress}, ${zip}${city}${prov}`;
            }
        }

        docPdf.text(`${fullAddress} - P.IVA: ${companyInfo.vatNumber}`, col2X, row1Y + 15);
        docPdf.text(`${companyInfo.email} - ${companyInfo.phone}`, col2X, row1Y + 20);

    } else {
        docPdf.setFontSize(8);
        docPdf.setTextColor(...blackColor);
        docPdf.text("Dati Aziendali non configurati", col2X, row1Y + 5);
    }

    // --- Dati Documento (Right Aligned) ---
    docPdf.setFontSize(16);
    docPdf.setTextColor(...blackColor);
    docPdf.setFont("helvetica", "bold");
    const title = type === 'Fattura' && (doc as Invoice).isGhost ? 'FATTURA PRO-FORMA' : type.toUpperCase();
    docPdf.text(title, rightAlignX, row1Y + 8, { align: 'right' });

    let docDataY = row1Y + 14;
    const docNumber = type === 'Fattura' ? (doc as Invoice).invoiceNumber : (doc as Quote).quoteNumber;
    const issueDate = formatDate(doc.issueDate);
    
    docPdf.setFontSize(9);
    docPdf.setTextColor(...blackColor);
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
    
    // SDI
    if (type === 'Fattura' && (doc as Invoice).sdiCode) {
        docPdf.setFont("helvetica", "normal");
        docPdf.text(`SDI/PEC:`, rightAlignX - 35, docDataY, { align: 'left'});
        docPdf.text((doc as Invoice).sdiCode || '', rightAlignX, docDataY, { align: 'right' });
    }

    // Divisore
    docPdf.setDrawColor(...lightGrayColor);
    docPdf.setLineWidth(0.1);
    docPdf.line(marginX, dividerY, rightAlignX, dividerY);


    // ============================================================
    // RIGA 2: CLIENTE
    // ============================================================

    docPdf.setFontSize(7);
    docPdf.setTextColor(...grayColor);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("CLIENTE", marginX, row2Y); 

    let clientY = row2Y;
    docPdf.setFontSize(9);
    docPdf.setTextColor(...blackColor);
    
    if (client) {
        docPdf.setFont("helvetica", "bold");
        if (client.clientType === ClientType.Parent) {
            const p = client as ParentClient;
            docPdf.text(`${p.firstName} ${p.lastName}`, col2X, clientY);
            clientY += 6; 
            docPdf.setFont("helvetica", "normal");
            docPdf.text(p.address, col2X, clientY);
            clientY += 4;
            docPdf.text(`${p.zipCode} ${p.city} (${p.province})`, col2X, clientY);
            clientY += 4;
            docPdf.text(`CF: ${p.taxCode}`, col2X, clientY);
        } else {
            const i = client as InstitutionalClient;
            docPdf.text(i.companyName, col2X, clientY);
            clientY += 6; 
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
    
    currentY = 85; // Starting Y for table
    
    const tableColumn = ["Descrizione", "Quantità", "Prezzo Unit.", "Totale"];
    let tableRows: any[] = [];

    if (type === 'Fattura' && (doc as Invoice).relatedQuoteNumber) {
        tableRows.push([{
            content: `Rif. ns. documento ${(doc as Invoice).relatedQuoteNumber}`,
            colSpan: 4,
            styles: { fontStyle: 'italic', textColor: [100, 100, 100], fillColor: [250, 250, 250], halign: 'left' }
        }]);
    }

    let calculatedSubtotal = 0;

    const itemRows = doc.items.map((item: DocumentItem) => {
        const desc = item.notes ? `${item.description}\n${item.notes}` : item.description;
        const gross = item.quantity * item.price;
        let discountAmount = 0;
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
            formatCurrency(net)
        ];
    });

    tableRows = [...tableRows, ...itemRows];

    autoTable(docPdf, {
        startY: currentY,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { 
            fillColor: headerTableColor, 
            textColor: 255, 
            fontSize: 9,
            fontStyle: 'bold' 
        },
        bodyStyles: { 
            fontSize: 9, 
            textColor: [0, 0, 0], 
            cellPadding: 4 
        },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 30, halign: 'right' }
        },
        margin: { bottom: footerHeight + 10 } // Ensure table doesn't hit footer
    });

    currentY = (docPdf as any).lastAutoTable?.finalY || currentY;

    // ============================================================
    // SEZIONE TOTALI
    // ============================================================
    
    // Calcoli
    let globalDiscountVal = 0;
    if ('globalDiscount' in doc && doc.globalDiscount) {
        const inv = doc as Invoice;
        if (inv.globalDiscountType === 'percent') {
            globalDiscountVal = calculatedSubtotal * ((inv.globalDiscount || 0) / 100);
        } else {
            globalDiscountVal = inv.globalDiscount || 0;
        }
    }
    const taxable = calculatedSubtotal - globalDiscountVal;
    let stampDuty = 0;
    if (type === 'Preventivo' && 'installments' in doc && doc.installments && doc.installments.length > 0) {
        stampDuty = (doc as Quote).installments.reduce((sum, i) => sum + (i.hasStampDuty ? 2.00 : 0), 0);
    } else {
        stampDuty = (doc.hasStampDuty) ? 2.00 : 0;
    }
    const grandTotal = taxable + stampDuty;

    // STIMA ALTEZZA TOTALI: circa 35mm
    const totalsBlockHeight = 35;
    checkPageBreak(totalsBlockHeight);

    currentY += 5;
    
    docPdf.setFont("helvetica", "normal");
    docPdf.setFontSize(10);
    docPdf.setTextColor(...blackColor);
    const labelX = 135;

    // Subtotal / Discount
    if (globalDiscountVal > 0) {
        docPdf.text(`Imponibile Lordo:`, labelX, currentY + 5);
        docPdf.text(`${formatCurrency(calculatedSubtotal)}`, rightAlignX, currentY + 5, { align: 'right' });
        
        docPdf.setTextColor(200, 0, 0); 
        docPdf.text(`Sconto Globale:`, labelX, currentY + 10);
        docPdf.text(`-${formatCurrency(globalDiscountVal)}`, rightAlignX, currentY + 10, { align: 'right' });
        docPdf.setTextColor(...blackColor);
        currentY += 10;
    }

    docPdf.text(`Imponibile Netto:`, labelX, currentY + 5);
    docPdf.text(`${formatCurrency(taxable)}`, rightAlignX, currentY + 5, { align: 'right' });

    if (stampDuty > 0) {
        docPdf.text(`Bollo Virtuale:`, labelX, currentY + 10);
        docPdf.text(`${formatCurrency(stampDuty)}`, rightAlignX, currentY + 10, { align: 'right' });
        currentY += 5;
    }

    // Totale Line
    docPdf.setDrawColor(200, 200, 200);
    docPdf.line(labelX, currentY + 13, rightAlignX, currentY + 13);

    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(12);
    docPdf.text(`TOTALE:`, labelX, currentY + 20);
    docPdf.text(`${formatCurrency(grandTotal)}`, rightAlignX, currentY + 20, { align: 'right' });

    // Expiry
    docPdf.setFontSize(9);
    docPdf.setFont("helvetica", "normal");
    docPdf.setTextColor(...grayColor);
    const expiryDate = type === 'Fattura' ? formatDate((doc as Invoice).dueDate) : formatDate((doc as Quote).expiryDate);
    const deadlineLabel = type === 'Fattura' ? "Scadenza:" : "Valido fino al:";
    docPdf.text(`${deadlineLabel} ${expiryDate}`, rightAlignX, currentY + 26, { align: 'right' });

    currentY += 30; // Move past totals

    // ============================================================
    // FOOTER BLOCKS (Payment, Installments, Notes)
    // ============================================================
    
    // 1. PAYMENT METHOD
    if ('paymentMethod' in doc && doc.paymentMethod) {
        // Est: Header 5mm + Text 5mm + Padding 5mm
        const paymentBlockHeight = 15;
        checkPageBreak(paymentBlockHeight);
        
        drawBlockHeader("MODALITÀ E TERMINI DI PAGAMENTO");
        
        docPdf.setTextColor(0, 0, 0);
        docPdf.setFont("helvetica", "normal");
        docPdf.setFontSize(9);
        docPdf.text(doc.paymentMethod, marginX, currentY + 4);
        
        currentY += 8; // Spacing
    }

    // 2. INSTALLMENTS
    if ('installments' in doc && doc.installments && doc.installments.length > 0) {
        const rowsCount = (doc as Quote).installments.length;
        // Est: Header 5mm + Table (Rows * 7mm) + Header Table 7mm + Padding
        const estimatedTableHeight = 12 + (rowsCount * 7); 
        
        checkPageBreak(estimatedTableHeight);

        drawBlockHeader("PIANO RATEALE");

        const instRows = (doc as Quote).installments.map((inst: Installment) => [
            inst.description,
            formatDate(inst.dueDate), 
            inst.collectionDate ? formatDate(inst.collectionDate) : '-',
            formatCurrency(inst.amount),
            inst.isPaid ? 'Saldato' : 'Da Saldare'
        ]);

        autoTable(docPdf, {
            startY: currentY, // Start exactly where header ended
            head: [['Descrizione', 'Data FT', 'Data Pag.', 'Importo', 'Stato']],
            body: instRows,
            theme: 'plain',
            styles: { 
                fontSize: 8, 
                cellPadding: 2, 
                textColor: [0, 0, 0],
                valign: 'middle',
                lineWidth: { bottom: 0.1 },
                lineColor: [230, 230, 230]
            },
            headStyles: { 
                textColor: [0, 0, 0], 
                fontStyle: 'bold',
                fillColor: [255, 255, 255], 
                lineWidth: { bottom: 0.5 }, 
                lineColor: [100, 100, 100]
            },
            columnStyles: { 
                3: { halign: 'right', fontStyle: 'bold' },
                4: { halign: 'center' } 
            },
            margin: { left: marginX, right: marginX, bottom: footerHeight }
        });
        
        currentY = (docPdf as any).lastAutoTable?.finalY + 8;
    }

    // 3. NOTES
    if (doc.notes && doc.notes.trim().length > 0) {
        // Calculate needed height for notes
        docPdf.setFont("helvetica", "normal");
        docPdf.setFontSize(8);
        const splitNotes = docPdf.splitTextToSize(doc.notes, contentWidth);
        const notesTextHeight = (splitNotes.length * 3.5);
        const notesBlockHeight = 5 + notesTextHeight + 5; // Header + Text + Padding
        
        checkPageBreak(notesBlockHeight);

        drawBlockHeader("NOTE");

        docPdf.setTextColor(0, 0, 0);
        docPdf.setFont("helvetica", "normal");
        docPdf.setFontSize(8);
        docPdf.text(splitNotes, marginX, currentY + 3);
        
        currentY += notesTextHeight + 5;
    }

    // ============================================================
    // LEGAL FOOTER (Repeated on all pages if possible, here simple bottom)
    // ============================================================
    const pageCount = docPdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        docPdf.setPage(i);
        const splitFooter = docPdf.splitTextToSize(footerText, contentWidth);
        docPdf.setFontSize(7);
        docPdf.setTextColor(...grayColor);
        docPdf.text(splitFooter, marginX, pageHeight - 12);
        
        // Page Number
        docPdf.text(`Pagina ${i} di ${pageCount}`, rightAlignX, pageHeight - 12, { align: 'right' });
    }

    if (previewMode) {
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
