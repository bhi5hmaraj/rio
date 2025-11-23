/**
 * Core types for Rio extension
 * Based on ADR-001 data model
 */

// --- Annotation Types ---

export interface TextQuoteSelector {
  type: 'TextQuoteSelector';
  exact: string;      // The highlighted text
  prefix?: string;    // 20 chars before
  suffix?: string;    // 20 chars after
}

export interface Annotation {
  id: string;                    // UUID
  conversationId: string;        // From URL
  conversationUrl: string;       // Full URL for reference
  messageIndex: number;          // Which message (0-indexed)

  // Text selection
  selector: TextQuoteSelector;

  // Classification
  category: string;              // 'factuality' | 'critique' | 'sycophancy' | 'bias' | custom
  strength?: number;             // 1-10 (AI annotations only)
  note: string;                  // The critique/note

  // Metadata
  source: 'ai' | 'manual';
  provider?: string;             // 'gemini' | 'openai' | 'claude'
  model?: string;                // e.g., 'gemini-2.5-flash'
  createdAt: number;             // Timestamp
  updatedAt?: number;            // For edits
}

// --- Category Types ---

export interface Category {
  id: string;
  name: string;
  color: string;
  preset: boolean;  // true for built-in, false for user-created
}

export const PRESET_CATEGORIES: Category[] = [
  { id: 'factuality', name: 'Factuality', color: '#00c65e', preset: true },
  { id: 'critique', name: 'Critique', color: '#007bff', preset: true },
  { id: 'sycophancy', name: 'Sycophancy', color: '#ffa500', preset: true },
  { id: 'bias', name: 'Bias', color: '#dc3545', preset: true },
];

// --- AI Configuration ---

export type AIProvider = 'openai' | 'gemini' | 'claude' | 'custom';

export interface AIConfig {
  litellmEndpoint: string;  // e.g., "http://localhost:4000"
  provider: AIProvider;
  apiKey: string;           // Encrypted in chrome.storage
  model?: string;           // e.g., "gemini-2.5-flash"
}

// --- Settings ---

export interface UserPreferences {
  autoFactCheck: boolean;
  showHUD: boolean;
  highlightStyle: 'underline' | 'background' | 'border';
}

export interface RioSettings {
  aiConfig: AIConfig;
  preferences: UserPreferences;
}

// --- Message Types (for Chrome Extension messaging) ---

export type MessageType =
  | 'SCRAPE_CONVERSATION'
  | 'RUN_FACT_CHECK'
  | 'ADD_ANNOTATION'
  | 'HIGHLIGHT_TEXT'
  | 'OPEN_SIDE_PANEL'
  | 'EXPORT_CHAT'
  | 'UPDATE_SETTINGS';

export interface BaseMessage {
  type: MessageType;
  payload?: unknown;
}

export interface ScrapeConversationMessage extends BaseMessage {
  type: 'SCRAPE_CONVERSATION';
  payload: undefined;
}

export interface RunFactCheckMessage extends BaseMessage {
  type: 'RUN_FACT_CHECK';
  payload: {
    conversationId: string;
    messages: ChatMessage[];
  };
}

export interface AddAnnotationMessage extends BaseMessage {
  type: 'ADD_ANNOTATION';
  payload: {
    annotation: Annotation;
  };
}

export type RioMessage =
  | ScrapeConversationMessage
  | RunFactCheckMessage
  | AddAnnotationMessage
  | BaseMessage;

// --- Chat Message Types ---

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  messageIndex: number;
  timestamp?: number;
}

export interface ConversationExport {
  conversationId: string;
  conversationUrl: string;
  messages: ChatMessage[];
  annotations: Annotation[];
  exportedAt: number;
}

// --- Storage Schema ---

export interface StorageSchema {
  // Map of conversationId -> Annotation[]
  annotations: Record<string, Annotation[]>;

  // Custom categories (presets are always available)
  customCategories: Category[];

  // Settings
  settings: RioSettings;
}
