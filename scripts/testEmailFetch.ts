async function run() {
    const pdfBase64 = "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nDPQM1Qo5yVQUMhPU0jOSCxKTQVKuoZ7Bjv4hoR7BfuGuwEAyP4IkwplbmRzdHJlYW0KZW5kb2JqCjMgMCBvYmoKMzEKZW5kb2JqCjEgMCBvYmoKPDwvVHlwZS9QYWdlL01lZGlhQm94WzAgMCA1OTUgODQyXS9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNCAwIFI+Pj4+L0NvbnRlbnRzIDIgMCBSL1BhcmVudCA1IDAgUj4+CmVuZG9iago0IDAgb2JqCjw8L1R5cGUvRm9udC9TdWJ0eXBlL1R5cGUxL0Jhc2VGb250L0hlbHZldGljYT4+CmVuZG9iago1IDAgb2JqCjw8L1R5cGUvUGFnZXMvQ291bnQgMS9LaWRzWzEgMCBSXT4+CmVuZG9iago2IDAgb2JqCjw8L1R5cGUvQ2F0YWxvZy9QYWdlcyA1IDAgUj4+CmVuZG9iago3IDAgb2JqCjw8L1Byb2R1Y2VyKHBGREopL0NyZWF0b3IoUGRmU2NyaXB0KzopPj4KZW5kb2JqCnhyZWYKMCA4CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDEyNSAwMDAwMCBuIAowMDAwMDAwMDE5IDAwMDAwIG4gCjAwMDAwMDAxMDUgMDAwMDAgbiAKMDAwMDAwMDIyMiAwMDAwMCBuIAowMDAwMDAwMzEwIDAwMDAwIG4gCjAwMDAwMDAzNjcgMDAwMDAgbiAKMDAwMDAwMDQxNiAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgOC9Sb290IDYgMCBSL0luZm8gNyAwIFI+PgpzdGFydHhyZWYKNDg2CiUlRU9GCg==";

    const data = {
        data: {
            to: "vitoloiudice@gmail.com",
            subject: "Test - CRM Email File Allegati",
            html: "<p>Invio tramite applicazione test (CRM modale).</p>"
        }
    };

    const res = await fetch("https://europe-west1-ep-gestionale-v1.cloudfunctions.net/sendEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
}

run();
