// In-memory storage for demo purposes
// Data will be lost on server restart

export interface Location {
  user: string;
  lat: number;
  lng: number;
  timestamp: number;
  atRema: boolean;
}

export interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

class InMemoryStorage {
  private locations: Map<string, Location> = new Map();
  private messages: Message[] = [];
  private messageIdCounter = 0;

  // Location methods
  updateLocation(user: string, lat: number, lng: number, atRema: boolean) {
    this.locations.set(user, {
      user,
      lat,
      lng,
      timestamp: Date.now(),
      atRema,
    });
  }

  getLocations(): Location[] {
    return Array.from(this.locations.values());
  }

  getLocation(user: string): Location | undefined {
    return this.locations.get(user);
  }

  // Message methods
  addMessage(sender: string, text: string): Message {
    const message: Message = {
      id: `msg-${++this.messageIdCounter}`,
      sender,
      text,
      timestamp: Date.now(),
    };
    this.messages.push(message);

    // Keep only last 100 messages
    if (this.messages.length > 100) {
      this.messages.shift();
    }

    return message;
  }

  getMessages(since?: number): Message[] {
    if (since) {
      return this.messages.filter(m => m.timestamp > since);
    }
    return [...this.messages];
  }

  getRecentMessages(limit: number = 50): Message[] {
    return this.messages.slice(-limit);
  }
}

// Singleton instance
export const storage = new InMemoryStorage();
