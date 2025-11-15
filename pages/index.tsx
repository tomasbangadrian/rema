import Head from 'next/head';
import { useEffect, useState, useRef } from 'react';

export default function Home() {
  const [user, setUser] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [atRema, setAtRema] = useState(false);
  const [otherUserAtRema, setOtherUserAtRema] = useState(false);
  const [lastMessageCheck, setLastMessageCheck] = useState(0);
  const [allLocations, setAllLocations] = useState<any[]>([]);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());

  // Rema 1000 Solsiden coordinates (CORRECTED!)
  const REMA_LAT = 63.436466;
  const REMA_LNG = 10.41653;
  const REMA_RADIUS = 100; // meters

  // Helper function for push subscription
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeToPush = async (userName: string) => {
    try {
      // Check if service worker is supported
      if (!('serviceWorker' in navigator)) {
        console.log('Service Worker not supported');
        return;
      }

      if (!('PushManager' in window)) {
        console.log('Push notifications not supported');
        return;
      }

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      const vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDjrwCh0l52wWJN9RCa5LcYYhYt7VKL9p0PcHkCqJq8A';

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      console.log('Push subscription created:', subscription);

      // Send subscription to server
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: userName,
          subscription: subscription.toJSON(),
        }),
      });

      console.log('Push subscription saved to server');
    } catch (error) {
      console.error('Error subscribing to push:', error);
    }
  };

  useEffect(() => {
    // Check if user is logged in
    const savedUser = localStorage.getItem('remaUser');
    if (savedUser) {
      setUser(savedUser);
      // Re-subscribe to push notifications on reload
      setTimeout(() => subscribeToPush(savedUser), 1000);
    }

    // PWA install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstall(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!user || typeof window === 'undefined') return;

    // Load Leaflet dynamically
    const initMap = async () => {
      // @ts-ignore
      const L = window.L;
      if (!L || mapRef.current) return;

      const map = L.map('map').setView([REMA_LAT, REMA_LNG], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      // Add Rema marker
      const remaIcon = L.divIcon({
        html: '<div style="background: #ed1c24; color: white; padding: 8px; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold;">🛒</div>',
        className: 'rema-marker',
        iconSize: [40, 40],
      });
      L.marker([REMA_LAT, REMA_LNG], { icon: remaIcon })
        .addTo(map)
        .bindPopup('Rema 1000 Solsiden');

      // Add circle for radius
      L.circle([REMA_LAT, REMA_LNG], {
        color: '#ed1c24',
        fillColor: '#ed1c24',
        fillOpacity: 0.1,
        radius: REMA_RADIUS,
      }).addTo(map);

      mapRef.current = map;
    };

    setTimeout(initMap, 500);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Start GPS tracking
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setMyLocation({ lat: latitude, lng: longitude });

        const distance = calculateDistance(latitude, longitude, REMA_LAT, REMA_LNG);
        const isAtRema = distance <= REMA_RADIUS;

        console.log('GPS Update:', { latitude, longitude, distance, isAtRema });

        if (isAtRema !== atRema) {
          setAtRema(isAtRema);
          if (isAtRema) {
            showNotification(`${user} er nå på Rema 1000 Solsiden!`);
            alert(`${user} er på Rema! Avstand: ${Math.round(distance)}m`);
          }
        }

        // Update location on server
        await fetch('/api/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user, lat: latitude, lng: longitude, atRema: isAtRema }),
        });
      },
      (error) => {
        console.error('GPS error:', error);
        alert('GPS feil: ' + error.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    // Poll for other user's location
    const locationInterval = setInterval(async () => {
      const response = await fetch('/api/location');
      const locations = await response.json();
      setAllLocations(locations);

      const otherUser = locations.find((loc: any) => loc.user !== user);
      if (otherUser && otherUser.atRema && !otherUserAtRema) {
        setOtherUserAtRema(true);
        showNotification(`${otherUser.user} er på Rema 1000 Solsiden!`);
      } else if (otherUser && !otherUser.atRema) {
        setOtherUserAtRema(false);
      }
    }, 3000);

    // Poll for new messages
    const messageInterval = setInterval(async () => {
      const response = await fetch(`/api/messages?since=${lastMessageCheck}`);
      const newMessages = await response.json();

      if (newMessages.length > 0) {
        setMessages((prev) => [...prev, ...newMessages]);
        setLastMessageCheck(Date.now());

        // Show notification for messages from other user
        newMessages.forEach((msg: any) => {
          if (msg.sender !== user) {
            showNotification(`${msg.sender}: ${msg.text}`);
          }
        });
      }
    }, 3000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(locationInterval);
      clearInterval(messageInterval);
    };
  }, [user, atRema, otherUserAtRema, lastMessageCheck]);

  useEffect(() => {
    if (user) {
      // Load initial messages
      fetch('/api/messages')
        .then((res) => res.json())
        .then((data) => {
          setMessages(data);
          setLastMessageCheck(Date.now());
        });
    }
  }, [user]);

  // Update map markers
  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return;
    // @ts-ignore
    const L = window.L;
    if (!L) return;

    // Update markers for all locations
    allLocations.forEach((loc) => {
      const existingMarker = markersRef.current.get(loc.user);

      const isMe = loc.user === user;
      const color = isMe ? '#4CAF50' : '#2196F3';
      const emoji = isMe ? '🧑' : '👤';

      const userIcon = L.divIcon({
        html: `<div style="background: ${color}; color: white; padding: 5px; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 18px;">${emoji}</div>`,
        className: 'user-marker',
        iconSize: [30, 30],
      });

      if (existingMarker) {
        existingMarker.setLatLng([loc.lat, loc.lng]);
        existingMarker.setIcon(userIcon);
      } else {
        const marker = L.marker([loc.lat, loc.lng], { icon: userIcon })
          .addTo(mapRef.current)
          .bindPopup(loc.user);
        markersRef.current.set(loc.user, marker);
      }
    });

    // Center map on my location if available
    if (myLocation && mapRef.current) {
      mapRef.current.setView([myLocation.lat, myLocation.lng], mapRef.current.getZoom());
    }
  }, [allLocations, myLocation, user]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const showNotification = (message: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Rema Tracker', { body: message });
    }
  };

  const handleLogin = async (name: string) => {
    localStorage.setItem('remaUser', name);
    setUser(name);

    // Subscribe to push notifications
    await subscribeToPush(name);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowInstall(false);
    }

    setDeferredPrompt(null);
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: user, text: newMessage }),
    });

    setNewMessage('');
  };

  const handleLogout = () => {
    localStorage.removeItem('remaUser');
    setUser(null);
    setMessages([]);
    setAtRema(false);
    setOtherUserAtRema(false);
    setAllLocations([]);
    setMyLocation(null);
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    markersRef.current.clear();
  };

  if (!user) {
    return (
      <>
        <Head>
          <title>Rema Tracker</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#ed1c24" />
        </Head>
        <div style={styles.container}>
          <h1 style={styles.title}>Rema Tracker</h1>
          <p style={styles.subtitle}>Hvem er du?</p>
          <button style={styles.button} onClick={() => handleLogin('Tomas')}>
            Tomas
          </button>
          <button style={styles.button} onClick={() => handleLogin('Catrine')}>
            Catrine
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Rema Tracker - {user}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ed1c24" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <script
          src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
          crossOrigin=""
        ></script>
      </Head>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Rema Tracker</h1>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={styles.userText}>Logget inn som: {user}</p>
            <button style={styles.logoutButton} onClick={handleLogout}>
              Logg ut
            </button>
          </div>
        </div>

        {showInstall && (
          <button style={styles.installButton} onClick={handleInstall}>
            Installer App
          </button>
        )}

        <div style={styles.status}>
          {atRema && <p style={styles.atRema}>Du er på Rema! 🛒</p>}
          {otherUserAtRema && (
            <p style={styles.otherAtRema}>
              {user === 'Tomas' ? 'Catrine' : 'Tomas'} er på Rema! 🛒
            </p>
          )}
          {myLocation && (
            <p style={styles.debugInfo}>
              Din posisjon: {myLocation.lat.toFixed(5)}, {myLocation.lng.toFixed(5)}
              {' | Avstand til Rema: '}
              {Math.round(calculateDistance(myLocation.lat, myLocation.lng, REMA_LAT, REMA_LNG))}m
            </p>
          )}
        </div>

        <div id="map" style={styles.map}></div>

        <div style={styles.chatContainer}>
          <h2 style={styles.chatTitle}>Meldinger</h2>
          <div style={styles.messages}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  ...styles.message,
                  ...(msg.sender === user ? styles.myMessage : styles.theirMessage),
                }}
              >
                <strong>{msg.sender}:</strong> {msg.text}
              </div>
            ))}
          </div>
          <div style={styles.inputContainer}>
            <input
              style={styles.input}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Skriv en melding..."
            />
            <button style={styles.sendButton} onClick={sendMessage}>
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  } as React.CSSProperties,
  header: {
    textAlign: 'center',
    marginBottom: '20px',
  } as React.CSSProperties,
  title: {
    color: '#ed1c24',
    fontSize: '32px',
    margin: '0 0 10px 0',
  } as React.CSSProperties,
  subtitle: {
    fontSize: '18px',
    color: '#333',
    marginBottom: '20px',
  } as React.CSSProperties,
  userText: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
  } as React.CSSProperties,
  logoutButton: {
    padding: '8px 16px',
    fontSize: '14px',
    backgroundColor: '#666',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  } as React.CSSProperties,
  debugInfo: {
    fontSize: '12px',
    color: '#666',
    backgroundColor: '#fff',
    padding: '8px',
    borderRadius: '4px',
    marginTop: '10px',
    fontFamily: 'monospace',
  } as React.CSSProperties,
  map: {
    width: '100%',
    height: '300px',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '2px solid #ed1c24',
  } as React.CSSProperties,
  button: {
    display: 'block',
    width: '100%',
    padding: '15px',
    margin: '10px 0',
    fontSize: '18px',
    backgroundColor: '#ed1c24',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  } as React.CSSProperties,
  installButton: {
    width: '100%',
    padding: '12px',
    margin: '0 0 20px 0',
    fontSize: '16px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  } as React.CSSProperties,
  status: {
    marginBottom: '20px',
  } as React.CSSProperties,
  atRema: {
    padding: '10px',
    backgroundColor: '#4CAF50',
    color: 'white',
    borderRadius: '8px',
    textAlign: 'center',
    marginBottom: '10px',
  } as React.CSSProperties,
  otherAtRema: {
    padding: '10px',
    backgroundColor: '#2196F3',
    color: 'white',
    borderRadius: '8px',
    textAlign: 'center',
  } as React.CSSProperties,
  chatContainer: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '15px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  } as React.CSSProperties,
  chatTitle: {
    fontSize: '20px',
    margin: '0 0 15px 0',
    color: '#333',
  } as React.CSSProperties,
  messages: {
    height: '400px',
    overflowY: 'auto',
    marginBottom: '15px',
    padding: '10px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
  } as React.CSSProperties,
  message: {
    padding: '8px 12px',
    marginBottom: '8px',
    borderRadius: '8px',
    wordWrap: 'break-word',
  } as React.CSSProperties,
  myMessage: {
    backgroundColor: '#e3f2fd',
    textAlign: 'right',
  } as React.CSSProperties,
  theirMessage: {
    backgroundColor: '#fff3e0',
    textAlign: 'left',
  } as React.CSSProperties,
  inputContainer: {
    display: 'flex',
    gap: '10px',
  } as React.CSSProperties,
  input: {
    flex: 1,
    padding: '10px',
    fontSize: '16px',
    border: '1px solid #ddd',
    borderRadius: '8px',
  } as React.CSSProperties,
  sendButton: {
    padding: '10px 20px',
    fontSize: '16px',
    backgroundColor: '#ed1c24',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  } as React.CSSProperties,
};
