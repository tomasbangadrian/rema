import Head from 'next/head';
import { useEffect, useState } from 'react';

export default function Home() {
  const [user, setUser] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [atRema, setAtRema] = useState(false);
  const [otherUserAtRema, setOtherUserAtRema] = useState(false);
  const [lastMessageCheck, setLastMessageCheck] = useState(0);

  // Rema 1000 Solsiden coordinates
  const REMA_LAT = 63.4305;
  const REMA_LNG = 10.3951;
  const REMA_RADIUS = 100; // meters

  useEffect(() => {
    // Check if user is logged in
    const savedUser = localStorage.getItem('remaUser');
    if (savedUser) {
      setUser(savedUser);
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

  useEffect(() => {
    if (!user) return;

    // Start GPS tracking
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const distance = calculateDistance(latitude, longitude, REMA_LAT, REMA_LNG);
        const isAtRema = distance <= REMA_RADIUS;

        if (isAtRema !== atRema) {
          setAtRema(isAtRema);
          if (isAtRema) {
            showNotification(`${user} er nå på Rema 1000 Solsiden!`);
          }
        }

        // Update location on server
        await fetch('/api/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user, lat: latitude, lng: longitude, atRema: isAtRema }),
        });
      },
      (error) => console.error('GPS error:', error),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    // Poll for other user's location
    const locationInterval = setInterval(async () => {
      const response = await fetch('/api/location');
      const locations = await response.json();

      const otherUser = locations.find((loc: any) => loc.user !== user);
      if (otherUser && otherUser.atRema && !otherUserAtRema) {
        setOtherUserAtRema(true);
        showNotification(`${otherUser.user} er på Rema 1000 Solsiden!`);
      } else if (otherUser && !otherUser.atRema) {
        setOtherUserAtRema(false);
      }
    }, 5000);

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

  const handleLogin = (name: string) => {
    localStorage.setItem('remaUser', name);
    setUser(name);

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
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
      </Head>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Rema Tracker</h1>
          <p style={styles.userText}>Logget inn som: {user}</p>
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
        </div>

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
