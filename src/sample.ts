export const SAMPLE_CSV = 'Location,Postal code,Account ID,Product code,Note\r\n' +
  'Fictional North,00604,12345678901234567,1E10,"Fictional sample — not customer data"\r\n' +
  'Fictional East,00123,0000000000000042,SKU-017,=1+1\r\n' +
  'Fictional West,09008,98765432109876543,2E3,"Line one\nLine two"\r\n' +
  'Fictional South,00501,10000000000000001,SKU-022,"  keep these spaces  "\r\n' +
  'Fictional Central,04001,12345098765432109,SKU-023,"Unicode: café · नमस्ते · 🌱"\r\n' +
  'Fictional Coastal,01010,77777777777777777,SKU-024,"Quoted ""text"", with a comma"\r\n';
export function sampleBytes(): Uint8Array { return new TextEncoder().encode(SAMPLE_CSV); }
