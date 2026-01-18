import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return () => this.off(event, listener);
  }

  off(event, listenerToRemove) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(listener => listener !== listenerToRemove);
  }

  emit(event, ...args) {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(...args));
  }
}

export const appEvents = new EventEmitter();

const DEBUG_LOGS_KEY = 'debug_logs_v1';
const DEBUG_LOGS_MAX = 400;
const DEBUG_LOGS_TEXT_MAX = 140000;

let inMemoryLogs = null;
let loadPromise = null;
let pendingLogs = [];
let flushTimer = null;

function truncateString(value, maxLen) {
  if (!value) return '';
  const str = String(value);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}

function normalizeError(err) {
  if (!err) return null;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: truncateString(err.stack, 8000),
    };
  }
  if (typeof err === 'object') {
    const name = typeof err.name === 'string' ? err.name : undefined;
    const message = typeof err.message === 'string' ? err.message : undefined;
    const stack = typeof err.stack === 'string' ? truncateString(err.stack, 8000) : undefined;
    return { ...err, name, message, stack };
  }
  return { message: String(err) };
}

function safeJsonStringify(value, maxLen) {
  const normalized = value instanceof Error ? normalizeError(value) : value;
  try {
    const seen = new WeakSet();
    const str = JSON.stringify(normalized, (k, v) => {
      if (v instanceof Error) return normalizeError(v);
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[Circular]';
        seen.add(v);
      }
      if (typeof v === 'string') return truncateString(v, 4000);
      return v;
    });
    return truncateString(str, maxLen);
  } catch {
    try {
      return truncateString(String(normalized), maxLen);
    } catch {
      return '';
    }
  }
}

async function ensureLogsLoaded() {
  if (inMemoryLogs) return inMemoryLogs;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(DEBUG_LOGS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      inMemoryLogs = Array.isArray(parsed) ? parsed : [];
    } catch {
      inMemoryLogs = [];
    } finally {
      loadPromise = null;
    }
    return inMemoryLogs;
  })();
  return loadPromise;
}

async function flushPending() {
  if (pendingLogs.length === 0) return;
  const base = await ensureLogsLoaded();
  const merged = base.concat(pendingLogs);
  pendingLogs = [];

  let sliced = merged;
  if (sliced.length > DEBUG_LOGS_MAX) {
    sliced = sliced.slice(sliced.length - DEBUG_LOGS_MAX);
  }

  try {
    let serialized = JSON.stringify(sliced);
    while (serialized.length > DEBUG_LOGS_TEXT_MAX && sliced.length > 20) {
      sliced = sliced.slice(Math.floor(sliced.length / 3));
      serialized = JSON.stringify(sliced);
    }
    inMemoryLogs = sliced;
    await AsyncStorage.setItem(DEBUG_LOGS_KEY, serialized);
  } catch {}
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushPending();
  }, 600);
}

export function debugLog(tag, message, data, level = 'info') {
  const entry = {
    ts: Date.now(),
    level,
    tag: truncateString(tag, 60),
    message: truncateString(message, 240),
    data: safeJsonStringify(data, 6000),
    platform: Platform.OS,
  };

  try {
    appEvents.emit('debug_log', entry);
  } catch {}

  pendingLogs.push(entry);
  scheduleFlush();
  return entry;
}

export async function getDebugLogs() {
  const base = await ensureLogsLoaded();
  return Array.isArray(base) ? base.slice() : [];
}

export async function clearDebugLogs() {
  pendingLogs = [];
  inMemoryLogs = [];
  try {
    await AsyncStorage.removeItem(DEBUG_LOGS_KEY);
  } catch {}
  try {
    appEvents.emit('debug_log_cleared');
  } catch {}
}
