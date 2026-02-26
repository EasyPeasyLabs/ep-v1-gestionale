# Configurazione CORS per Firebase Storage

Il problema "Max retry time for operation exceeded" durante l'upload dei file è causato dalla mancanza di configurazione CORS (Cross-Origin Resource Sharing) sul bucket di Firebase Storage. Il browser blocca l'upload perché il server non risponde correttamente alle richieste pre-flight.

Per risolvere, segui questi passaggi:

1.  Vai sulla **Google Cloud Console**: https://console.cloud.google.com/
2.  Assicurati di aver selezionato il progetto corretto: **ep-gestionale-v1**
3.  Clicca sull'icona **"Attiva Cloud Shell"** in alto a destra (sembra un terminale >_).
4.  Quando il terminale si apre in basso, clicca sull'icona a forma di matita ("Open Editor") per aprire l'editor di testo della Cloud Shell, oppure usa il comando `nano cors.json` direttamente nel terminale.
5.  Incolla il seguente contenuto nel file `cors.json` e salva (se usi nano: CTRL+O, Invio, CTRL+X):

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "maxAgeSeconds": 3600
  }
]
```

6.  Esegui il seguente comando nel terminale della Cloud Shell per applicare la configurazione al tuo bucket:

```bash
gsutil cors set cors.json gs://ep-gestionale-v1.appspot.com
```

*(Nota: Se il nome del tuo bucket è diverso da `ep-gestionale-v1.appspot.com`, sostituiscilo con quello corretto che trovi nella sezione Storage di Firebase).*

7.  Attendi qualche secondo e riprova l'upload dall'applicazione. Il problema dovrebbe essere risolto.
