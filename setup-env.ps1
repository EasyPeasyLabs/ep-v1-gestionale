# =============================================================================
# VERCEL ENVIRONMENT VARIABLES SETUP SCRIPT (V2)
# =============================================================================
# Questo script aggiunge automaticamente tutte le environment variables a Vercel
# 
# PREREQUISITI:
# 1. Vercel CLI installato: npm install -g vercel
# 2. Loggato a Vercel: vercel login
# 3. Progetto linkato: vercel link (lo script lo farà automaticamente)
#
# UTILIZZO:
# .\setup-env.ps1
#
# =============================================================================

Write-Host "================================" -ForegroundColor Cyan
Write-Host "VERCEL ENV VARIABLES SETUP V2" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Controlla se Vercel CLI è installato
Write-Host "Verificando Vercel CLI..." -ForegroundColor Yellow
$vercelCheck = vercel --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERRORE: Vercel CLI non trovato" -ForegroundColor Red
    Write-Host "Installa con: npm install -g vercel" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Vercel CLI trovato: $vercelCheck" -ForegroundColor Green
Write-Host ""

# Controlla se sei loggato
Write-Host "Verificando login Vercel..." -ForegroundColor Yellow
$loginCheck = vercel whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERRORE: Non sei loggato a Vercel" -ForegroundColor Red
    Write-Host "Effettua il login con: vercel login" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Loggato come: $loginCheck" -ForegroundColor Green
Write-Host ""

# Controlla se il progetto è linkato
Write-Host "Verificando link progetto..." -ForegroundColor Yellow
if (-not (Test-Path ".vercel")) {
    Write-Host "⚠️  Progetto non linkato. Eseguo: vercel link" -ForegroundColor Yellow
    vercel link --project ep-v1-gestionale --yes
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Link fallito, continuo comunque..." -ForegroundColor Yellow
    }
}
Write-Host "✅ Progetto pronto" -ForegroundColor Green
Write-Host ""

# Array di variabili da aggiungere
$envVariables = @(
    @{ Name = "VITE_FIREBASE_API_KEY"; Value = "AIzaSyDON9vmJzNvYH7Eqw3c2KlpgOjr3ToIJhM" },
    @{ Name = "VITE_FIREBASE_AUTH_DOMAIN"; Value = "ep-gestionale-v1.firebaseapp.com" },
    @{ Name = "VITE_FIREBASE_PROJECT_ID"; Value = "ep-gestionale-v1" },
    @{ Name = "VITE_FIREBASE_STORAGE_BUCKET"; Value = "ep-gestionale-v1.firebasestorage.app" },
    @{ Name = "VITE_FIREBASE_MESSAGING_SENDER_ID"; Value = "332612800443" },
    @{ Name = "VITE_FIREBASE_APP_ID"; Value = "1:332612800443:web:d5d434d38a78020dd57e9e" }
)

Write-Host "Aggiungo variabili a Vercel..." -ForegroundColor Yellow
Write-Host "Ambienti: production, preview, development" -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($env in $envVariables) {
    Write-Host "→ Aggiungendo: $($env.Name)" -ForegroundColor Cyan
    
    # Aggiungi per production
    $result = Write-Output "$($env.Value)" | vercel env add "$($env.Name)" production 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Production" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Production: $result" -ForegroundColor Yellow
    }
    
    # Aggiungi per preview
    $result = Write-Output "$($env.Value)" | vercel env add "$($env.Name)" preview 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Preview" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Preview: $result" -ForegroundColor Yellow
    }
    
    # Aggiungi per development
    $result = Write-Output "$($env.Value)" | vercel env add "$($env.Name)" development 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Development" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "  ⚠️  Development: $result" -ForegroundColor Yellow
        $failCount++
    }
    
    Start-Sleep -Milliseconds 300
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "VERIFICA VARIABILI:" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

vercel env list

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "PROSSIMI STEP:" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "1. Vai su: https://vercel.com/easypeasylabs/ep-v1-gestionale/deployments" -ForegroundColor Cyan
Write-Host "2. Clicca sul deployment fallito (in rosso)" -ForegroundColor Cyan
Write-Host "3. Clicca 'Redeploy'" -ForegroundColor Cyan
Write-Host "4. Aspetta che finisca (30-60 secondi)" -ForegroundColor Cyan
Write-Host "5. L'app sarà live su: https://ep-v1-gestionale.vercel.app" -ForegroundColor Cyan
Write-Host ""

