# Rema Tracker PWA

En Progressive Web App (PWA) for å spore besøk til Rema 1000 Solsiden.

## Funksjoner

- 📍 GPS-tracking av lokasjoner
- 🛒 Varsling når noen er på Rema 1000 Solsiden
- 💬 Chat-funksjonalitet mellom Tomas og Catrine
- 📱 Installerbar som app på Android
- 🔔 Push-notifikasjoner

## Installasjon

```bash
npm install
```

## Kjør lokalt

```bash
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000) i nettleseren din.

## Deploy til Vercel

1. Push koden til GitHub
2. Gå til [vercel.com](https://vercel.com)
3. Importer prosjektet
4. Deploy!

## Bruk

1. Åpne appen på telefonen din
2. Velg ditt navn (Tomas eller Catrine)
3. Tillat GPS og notifikasjoner
4. Klikk på "Installer App" for å legge den til hjemmeskjermen
5. Nå vil du få varsler når den andre er på Rema 1000 Solsiden!

## Teknologi

- Next.js med TypeScript
- GPS Geolocation API
- Notifications API
- PWA (Service Worker + Manifest)
- In-memory storage for demo
