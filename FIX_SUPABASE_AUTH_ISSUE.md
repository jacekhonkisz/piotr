# 🔧 Fix Supabase Authentication Issue

## ❌ Problem:
```
AuthApiError: Invalid API key
Failed to load resource: the server responded with a status of 401
```

## 🔍 Co oznacza ten błąd:
- Supabase API klucze są nieprawidłowe lub wygasłe
- URL Supabase może być nieprawidłowy
- Projekt Supabase może być wyłączony/zablokowany

## 🛠️ Rozwiązanie:

### 1. **Sprawdź status projektu Supabase**
1. Idź do: https://supabase.com/dashboard
2. Sprawdź czy projekt `xbklptrrfdspyvnjaojf` jest aktywny
3. Sprawdź czy nie ma alertów lub problemów z billing

### 2. **Zweryfikuj klucze API**
1. W Supabase Dashboard → Settings → API
2. Skopiuj aktualne klucze:
   - **Project URL**
   - **anon public** key
   - **service_role secret** key

### 3. **Porównaj z aktualnymi kluczami**

**Aktualne klucze w .env:**
```
NEXT_PUBLIC_SUPABASE_URL=https://xbklptrrfdspyvnjaojf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhia2xwdHJyZmRzcHl2bmphb2pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzEyODYsImV4cCI6MjA2ODk0NzI4Nn0.890DeNlTyqSGSqjb7LTRWTDVQ--Phj8ZrMmfOvYiYPI
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhia2xwdHJyZmRzcHl2bmphb2pmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzM3MTI4NiwiZXhwIjoyMDY4OTQ3Mjg2fQ.FsFNPzGfUNTkAB9M4tuz-iiF_L_n9oWrZZnoruR-w7U
```

### 4. **Jeśli klucze się różnią - zaktualizuj**

```bash
# Usuń stare klucze
vercel env rm NEXT_PUBLIC_SUPABASE_URL production
vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY production  
vercel env rm SUPABASE_SERVICE_ROLE_KEY production

# Dodaj nowe klucze
echo "NEW_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
echo "NEW_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
echo "NEW_SERVICE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Redeploy
vercel --prod
```

### 5. **Sprawdź konfigurację użytkowników**

Sprawdź czy użytkownik `admin@example.com` istnieje:
1. Supabase Dashboard → Authentication → Users
2. Jeśli nie ma - utwórz nowego użytkownika
3. Lub zmień email w kodzie na istniejący

### 6. **Test lokalnie**

```bash
# Test lokalnie z aktualnymi kluczami
npm run dev

# Jeśli działa lokalnie, problem jest w Vercel env vars
```

## 🔧 Szybka naprawa:

### Opcja A: Nowe klucze z Supabase
1. Skopiuj nowe klucze z Supabase Dashboard
2. Uruchom skrypt aktualizacji (poniżej)

### Opcja B: Nowy projekt Supabase  
1. Utwórz nowy projekt w Supabase
2. Skopiuj nowe klucze
3. Zaktualizuj environment variables

## 🚀 Skrypt szybkiej naprawy:

```bash
#!/bin/bash
echo "🔧 Fixing Supabase Auth Issue..."

echo "Please get the NEW keys from Supabase Dashboard and paste them:"
read -p "New SUPABASE_URL: " NEW_URL
read -p "New ANON_KEY: " NEW_ANON_KEY  
read -p "New SERVICE_KEY: " NEW_SERVICE_KEY

echo "Updating Vercel environment variables..."
echo "$NEW_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
echo "$NEW_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
echo "$NEW_SERVICE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY production

echo "Redeploying..."
vercel --prod

echo "✅ Fixed! Check your app in 2-3 minutes."
```

## ⚠️ Najczęstsze przyczyny:

1. **Wygasłe klucze** - Supabase może regenerować klucze
2. **Projekt wstrzymany** - Problem z płatnościami/billing
3. **Nieprawidłowy URL** - Literówka w URL projektu
4. **Brak użytkownika** - User `admin@example.com` nie istnieje

Sprawdź te punkty i daj mi znać co znalazłeś! 