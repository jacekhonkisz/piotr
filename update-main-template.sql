-- Update main template with full structure matching calendar preview
-- Run this in Supabase SQL Editor

UPDATE email_templates
SET html_template = '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Podsumowanie miesiąca</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif;
      line-height: 1.6; 
      color: #333; 
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f7fa;
    }
    .container { 
      background: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .greeting {
      font-size: 16px; 
      margin-bottom: 20px;
    }
    .section {
      margin: 25px 0;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #3b82f6;
    }
    .metrics {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 6px;
      margin: 10px 0;
    }
    .metric-line {
      padding: 4px 0;
      display: flex;
      justify-content: space-between;
    }
    .metric-label {
      color: #666;
    }
    .metric-value {
      font-weight: 600;
      color: #1a1a1a;
    }
    .summary {
      background: #e3f2fd;
      padding: 20px;
      border-radius: 6px;
      border-left: 4px solid #3b82f6;
      margin: 20px 0;
    }
    .link {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 500;
    }
    .footer { 
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="greeting">Dzień dobry,</div>
    
    <p>poniżej przesyłam podsumowanie najważniejszych danych z poprzedniego miesiąca.</p>
    
    <p>Szczegółowe raporty za działania znajdą Państwo w panelu klienta - <a href="https://yourapp.com/dashboard" class="link">TUTAJ</a></p>
    
    <p>W załączniku przesyłam też szczegółowy raport PDF.</p>
    
    <div class="section">
      <div class="section-title">1. Google Ads</div>
      <div class="metrics">
        <div class="metric-line"><span class="metric-label">Wydana kwota:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">Wyświetlenia:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">Kliknięcia:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">CPC:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">CTR:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">Wysłanie formularza:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">Kliknięcia w adres e-mail:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">Kliknięcia w numer telefonu:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">Booking Engine krok 1:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">Booking Engine krok 2:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">Booking Engine krok 3:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">Rezerwacje:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">Wartość rezerwacji:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">ROAS:</span> <span class="metric-value">[DANE]</span></div>
      </div>
    </div>
    
    <div class="section">
      <div class="section-title">2. Meta Ads</div>
      <div class="metrics">
        <div class="metric-line"><span class="metric-label">Wydana kwota:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">Wyświetlenia:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">Kliknięcia linku:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">Wysłanie formularza:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">Kliknięcia w adres e-mail:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">Kliknięcia w numer telefonu:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">Rezerwacje:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">Wartość rezerwacji:</span> <span class="metric-value">[DANE]</span></div>
        <div class="metric-line"><span class="metric-label">ROAS:</span> <span class="metric-value">[DANE]</span></div>
      </div>
    </div>
    
    <div class="summary">
      <strong>Podsumowanie ogólne</strong><br><br>
      Poprzedni miesiąc przyniósł nam łącznie [X] rezerwacji online o łącznej wartości ponad [Y] tys. zł.<br>
      Koszt pozyskania rezerwacji online zatem wyniósł: [Z]%.<br><br>
      
      Dodatkowo pozyskaliśmy też [A] mikro konwersji (telefonów, email i formularzy), które z pewnością przyczyniły się do pozyskania dodatkowych rezerwacji offline. 
      Nawet jeśli tylko 20% z nich zakończyło się rezerwacją, to pozyskaliśmy [B] rezerwacji i dodatkowe ok. [C] tys. zł tą drogą.<br><br>
      
      Dodając te potencjalne rezerwacje do rezerwacji online, to koszt pozyskania rezerwacji spada do poziomu ok. [D]%.<br><br>
      
      <strong>Zatem suma wartości rezerwacji za [miesiąc] [rok] (online + offline) wynosi około: [E] tys. zł.</strong>
    </div>
    
    <div class="footer">
      <p>W razie pytań proszę o kontakt.</p>
      <p>Pozdrawiam<br><strong>Piotr</strong></p>
    </div>
  </div>
</body>
</html>',
  updated_at = NOW()
WHERE client_id IS NULL 
  AND template_type = 'monthly_report'
  AND is_active = true;

-- Verify the update
SELECT 
  id,
  template_name,
  LENGTH(html_template) as template_size,
  updated_at
FROM email_templates
WHERE client_id IS NULL;
