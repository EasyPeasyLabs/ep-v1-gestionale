
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { Invoice, Quote, CompanyInfo, Client, DocumentItem, ParentClient, InstitutionalClient, ClientType, PaymentMethod, Installment } from '../types';

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
    companyInfo: CompanyInfo | null,
    client: Client | undefined
) => {
    const docPdf = new jsPDF();
    
    // Colors
    const primaryColor = [63, 81, 181] as [number, number, number]; // Indigo
    const grayColor = [117, 117, 117] as [number, number, number];

    // --- HEADER SECTION ---
    
    // 1. Logo (Top Left)
    try {
        // Usiamo window.location.origin per costruire un URL assoluto.
        // Questo è fondamentale perché se l'utente si trova in una rotta come /clients/detail,
        // un percorso relativo "./logo.png" cercherebbe in /clients/logo.png (che non esiste).
        const logoUrl = `${window.location.origin}/lemon_logo_150px.png`;
        const logoBase64 = await loadImage(logoUrl);
        if (logoBase64) {
            // x=14, y=10, width=25, height=33 (Richiesta Utente)
            docPdf.addImage(logoBase64, 'PNG', 14, 10, 25, 33);
        }
    } catch (e) {
        console.warn("Logo processing error", e);
    }

    // 2. Company Info (Top Left - Next to Logo)
    const infoX = 45; // 14 (margin) + 25 (logo) + 6 (gap)
    const infoStartYs = 18;

    docPdf.setFontSize(10);
    docPdf.setTextColor(0, 0, 0);
    
    if (companyInfo) {
        let currentY = infoStartYs;

        // Denominazione (Bold)
        if (companyInfo.denomination) {
            docPdf.setFont("helvetica", "bold");
            docPdf.text(companyInfo.denomination, infoX, currentY);
            currentY += 7; // 5 standard + 2 extra point spacing
        }
        
        // Ragione Sociale (Normal style)
        docPdf.setFont("helvetica", "normal");
        docPdf.text(companyInfo.name, infoX, currentY);
        currentY += 5;

        docPdf.setFontSize(9);
        docPdf.text(companyInfo.address, infoX, currentY);
        currentY += 5;
        docPdf.text(`P.IVA: ${companyInfo.vatNumber}`, infoX, currentY);
        currentY += 5;
        docPdf.text(`Email: ${companyInfo.email}`, infoX, currentY);
        currentY += 5;
        docPdf.text(`Tel: ${companyInfo.phone}`, infoX, currentY);
        
    } else {
        docPdf.text("Dati Aziendali non configurati", infoX, infoStartYs);
    }

    // 3. Document Title (Top Right)
    docPdf.setFontSize(20);
    docPdf.setTextColor(...primaryColor);
    docPdf.setFont("helvetica", "bold");
    const title = type === 'Fattura' && (doc as Invoice).isProForma ? 'FATTURA PRO-FORMA' : type.toUpperCase();
    // Right align title at x=195
    docPdf.text(title, 195, 22, { align: 'right' });

    // 4. Document Details (Top Right - Below Title)
    const docNumber = type === 'Fattura' ? (doc as Invoice).invoiceNumber : (doc as Quote).quoteNumber;
    const issueDate = formatDate(doc.issueDate);
    const expiryDate = type === 'Fattura' ? formatDate((doc as Invoice).dueDate) : formatDate((doc as Quote).expiryDate);
    
    docPdf.setFontSize(10);
    docPdf.setTextColor(0, 0, 0);
    docPdf.setFont("helvetica", "normal");
    
    docPdf.text(`Numero: ${docNumber}`, 195, 35, { align: 'right' });
    docPdf.text(`Data: ${issueDate}`, 195, 40, { align: 'right' });
    
    if (type === 'Fattura' && (doc as Invoice).sdiCode) {
        docPdf.text(`SDI/PEC: ${(doc as Invoice).sdiCode}`, 195, 45, { align: 'right' });
    }

    // 5. Client Info (Right - Below Doc Details)
    const clientY = 60;
    docPdf.setFont("helvetica", "bold");
    docPdf.text("Intestato a:", 120, clientY);
    docPdf.setFont("helvetica", "normal");
    
    if (client) {
        if (client.clientType === ClientType.Parent) {
            const p = client as ParentClient;
            docPdf.text(`${p.firstName} ${p.lastName}`, 120, clientY + 5);
            docPdf.text(p.address, 120, clientY + 10);
            docPdf.text(`${p.zipCode} ${p.city} (${p.province})`, 120, clientY + 15);
            docPdf.text(`CF: ${p.taxCode}`, 120, clientY + 20);
        } else {
            const i = client as InstitutionalClient;
            docPdf.text(i.companyName, 120, clientY + 5);
            docPdf.text(i.address, 120, clientY + 10);
            docPdf.text(`${i.zipCode} ${i.city} (${i.province})`, 120, clientY + 15);
            docPdf.text(`P.IVA: ${i.vatNumber}`, 120, clientY + 20);
        }
    } else {
        docPdf.text(doc.clientName, 120, clientY + 5);
    }

    // --- TABLE SECTION ---
    const tableColumn = ["Descrizione", "Quantità", "Prezzo Unit.", "Totale"];
    
    // Costruzione righe tabella
    let tableRows: any[] = [];

    // Se esiste un riferimento al documento originale, aggiungilo come prima riga (speciale)
    if (type === 'Fattura' && (doc as Invoice).relatedQuoteNumber) {
        tableRows.push([{
            content: `Rif. ns. documento ${(doc as Invoice).relatedQuoteNumber}`,
            colSpan: 4,
            styles: { fontStyle: 'italic', textColor: [100, 100, 100], fillColor: [248, 248, 248], halign: 'left' }
        }]);
    }

    const itemRows = doc.items.map((item: DocumentItem) => {
        // Se c'è una nota, la aggiungiamo alla descrizione
        const desc = item.notes ? `${item.description}\n${item.notes}` : item.description;
        return [
            desc,
            item.quantity,
            formatCurrency(item.price),
            formatCurrency(item.quantity * item.price)
        ];
    });

    tableRows = [...tableRows, ...itemRows];

    autoTable(docPdf, {
        startY: 95,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: 255 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 30, halign: 'right' }
        },
    });

    // --- TOTALS SECTION ---
    let finalY = (docPdf as any).lastAutoTable?.finalY || 95;
    
    const subtotal = doc.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const stampDuty = doc.hasStampDuty ? 2.00 : 0;
    const grandTotal = subtotal + stampDuty;

    docPdf.setFont("helvetica", "normal");
    docPdf.text(`Imponibile:`, 140, finalY + 10);
    docPdf.text(`${formatCurrency(subtotal)}`, 195, finalY + 10, { align: 'right' });

    if (doc.hasStampDuty) {
        docPdf.text(`Bollo Virtuale:`, 140, finalY + 16);
        docPdf.text(`${formatCurrency(stampDuty)}`, 195, finalY + 16, { align: 'right' });
        finalY += 6;
    }

    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(12);
    docPdf.text(`TOTALE:`, 140, finalY + 18);
    docPdf.text(`${formatCurrency(grandTotal)}`, 195, finalY + 18, { align: 'right' });

    // --- PAYMENT DEADLINE (Bold, under total) ---
    docPdf.setFontSize(10);
    const deadlineLabel = type === 'Fattura' ? "Da pagare entro il" : "Validità offerta fino al";
    
    docPdf.text(`${deadlineLabel} ${expiryDate}`, 195, finalY + 24, { align: 'right' });


    // --- FOOTER INFO ---
    finalY += 36; 
    docPdf.setFontSize(10);
    
    // Payment Method
    docPdf.setFont("helvetica", "bold");
    docPdf.text("Modalità di Pagamento:", 14, finalY);
    docPdf.setFont("helvetica", "normal");
    docPdf.text(`${doc.paymentMethod || 'Non specificato'}`, 60, finalY);

    // Installments Table (if any)
    if (doc.installments && doc.installments.length > 0) {
        finalY += 8;
        docPdf.setFont("helvetica", "bold");
        docPdf.text("Scadenze Pagamenti", 14, finalY);
        
        const instRows = doc.installments.map((inst: Installment) => [
            inst.description,
            formatDate(inst.dueDate),
            formatCurrency(inst.amount),
            inst.isPaid ? 'Pagato' : 'Da Pagare'
        ]);

        autoTable(docPdf, {
            startY: finalY + 4,
            head: [['Descrizione', 'Scadenza', 'Importo', 'Stato']],
            body: instRows,
            theme: 'striped',
            headStyles: { fillColor: grayColor, textColor: 255, fontSize: 9 },
            bodyStyles: { fontSize: 9 },
            columnStyles: {
                2: { halign: 'right' }
            },
            margin: { left: 14, right: 100 } // Compact table on left
        });
        finalY = (docPdf as any).lastAutoTable?.finalY || finalY;
    }

    // --- NOTES BOX ---
    if (doc.notes && doc.notes.trim().length > 0) {
        finalY += 10;
        
        if (finalY > 250) {
            docPdf.addPage();
            finalY = 20;
        }

        // Box Background
        docPdf.setDrawColor(200, 200, 200);
        docPdf.setFillColor(245, 245, 245); // Very light gray
        docPdf.rect(14, finalY, 180, 25, 'FD'); // Fill and Draw

        docPdf.setFont("helvetica", "bold");
        docPdf.setTextColor(0, 0, 0);
        docPdf.text("Note:", 16, finalY + 6);
        
        docPdf.setFont("helvetica", "normal");
        docPdf.setFontSize(9);
        
        const splitNotes = docPdf.splitTextToSize(doc.notes, 175);
        docPdf.text(splitNotes, 16, finalY + 11);
        
        finalY += 30;
    }


    // Legal Footer (Regime Forfettario)
    const footerText = "Operazione senza applicazione dell’IVA ai sensi dell’art. 1, commi da 54 a 89, Legge n. 190/2014.\nOperazione non soggetta a ritenuta alla fonte a titolo di acconto ai sensi dell’art. 1, comma 67, Legge n. 190/2014.";
    
    const pageHeight = docPdf.internal.pageSize.height;
    if (finalY > pageHeight - 30) {
        docPdf.addPage();
    }

    docPdf.setFontSize(7);
    docPdf.setTextColor(...grayColor);
    
    const splitFooter = docPdf.splitTextToSize(footerText, 180);
    docPdf.text(splitFooter, 14, pageHeight - 20);
    
    docPdf.text("Grazie per la preferenza.", 14, pageHeight - 10);

    // Filename Construction
    let filename = "";
    if (type === 'Fattura') {
        const numParts = docNumber.split('-');
        const shortNum = numParts.length > 0 ? numParts[numParts.length - 1] : docNumber;
        const dateStr = formatDateForFilename(doc.issueDate);
        const prefix = "FT";
        filename = `${prefix}${shortNum}_${dateStr}`;
        if ((doc as Invoice).isProForma) {
            filename += "_PROFORMA";
        }
    } else {
        filename = docNumber; 
    }

    docPdf.save(`${filename}.pdf`);
};
