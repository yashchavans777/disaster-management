import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Moon, Sun, X } from 'lucide-react';
import apiClient from '../api/apiClient';
import { getApiErrorMessage } from '../api/apiError';

export default function Chatbot({ isOpen = true, onClose }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hello! I am Logi-Assistant, your Logistics & Disaster Management AI. I can answer questions about real-time incident reports, weather risks, and optimal relief corridors in the North East Region.',
    },
  ]);
  const [isQuerying, setIsQuerying] = useState(false);
  const messagesEndRef = useRef(null);

  // Only scroll down on new messages — NO auto-trigger on component mount
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Explicit user-triggered send function with guard clause and True Streaming (SSE / Chunks)
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();

    const userInput = query;
    // Guard clause to prevent sending empty requests to the server
    if (!userInput.trim()) return;

    const question = userInput.trim();
    setQuery('');
    setIsQuerying(true);

    // 1. Append user's message, and initialize an empty assistant bubble for live streaming
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: question },
      {
        role: 'assistant',
        text: '',
        isStreaming: true,
        meta: '⚡ Groq (Llama-3-8b Streaming)',
      },
    ]);

    try {
      // Direct stream fetch to FastAPI with fallback to Node.js /api/ai/rag-query
      let response;
      const FASTAPI_URL = import.meta.env.VITE_FASTAPI_URL || 'http://localhost:8000';

      try {
        response = await fetch(`${FASTAPI_URL}/rag-query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        });
      } catch (directErr) {
        // Fallback to Node.js proxy endpoint which also pipes the stream
        response = await fetch('/api/ai/rag-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        });
      }

      if (!response.ok || !response.body) {
        throw new Error(`Service returned HTTP status ${response.status}`);
      }

      // 2. Consume streaming chunks via JavaScript Streams API reader and TextDecoder
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let streamedAnswer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        streamedAnswer += chunkText;

        // Continuously append new tokens to the assistant message in real-time
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              text: streamedAnswer,
              isStreaming: true,
            };
          }
          return updated;
        });
      }

      // Mark streaming complete
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
          updated[lastIdx] = {
            ...updated[lastIdx],
            isStreaming: false,
          };
        }
        return updated;
      });
    } catch (error) {
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
          updated[lastIdx] = {
            ...updated[lastIdx],
            text: updated[lastIdx].text || `⚠️ Error: ${error.message || 'Stream failed to connect.'}`,
            isError: true,
            isStreaming: false,
          };
        } else {
          updated.push({
            role: 'assistant',
            text: `⚠️ Error: ${error.message}`,
            isError: true,
          });
        }
        return updated;
      });
    } finally {
      setIsQuerying(false);
    }
  };

  const handleAsk = handleSendMessage;

  if (!isOpen) return null;

  // Container styling classes depending on isFullscreen and isDarkMode
  const containerClasses = isFullscreen
    ? `fixed inset-0 z-[9999] flex h-full w-full flex-col m-0 rounded-none shadow-2xl transition-all duration-200 ${
        isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-slate-900'
      }`
    : `fixed inset-y-0 right-0 z-[900] flex w-full max-w-sm sm:max-w-md flex-col border-l shadow-2xl transition-all duration-200 ${
        isDarkMode
          ? 'border-gray-800 bg-gray-900 text-white'
          : 'border-slate-200 bg-white text-slate-900'
      }`;

  // Header background
  const headerClasses = isDarkMode
    ? 'flex items-center justify-between border-b border-gray-800 bg-gray-950 px-4 py-3 text-white'
    : 'flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white';

  // Body container
  const bodyClasses = `flex-1 overflow-y-auto px-4 py-4 ${
    isDarkMode ? 'bg-gray-900' : 'bg-slate-50'
  }`;

  // Footer / form container
  const footerClasses = `border-t px-4 py-3 ${
    isDarkMode
      ? 'border-gray-800 bg-gray-950'
      : 'border-slate-200 bg-white'
  }`;

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className={headerClasses}>
        {/* Top-Left Theme Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDarkMode((d) => !d)}
            className={`inline-flex items-center justify-center rounded-lg p-1.5 transition ${
              isDarkMode
                ? 'bg-gray-800 text-amber-400 hover:bg-gray-700 focus:ring-2 focus:ring-amber-400/30'
                : 'bg-white/20 text-amber-200 hover:bg-white/30 focus:ring-2 focus:ring-white/40'
            }`}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle light or dark theme"
          >
            {isDarkMode ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          <div>
            <h2 className="text-sm font-semibold tracking-wide">
              🤖 Logi-Assistant AI
            </h2>
            <p
              className={`text-xs ${
                isDarkMode ? 'text-gray-400' : 'text-blue-100'
              }`}
            >
              {isFullscreen ? 'Full Screen Operational View' : 'RAG-powered Assistant'}
            </p>
          </div>
        </div>

        {/* Top-Right Controls: Full Screen & Close */}
        <div className="flex items-center gap-1.5">
          {/* Full Screen Toggle Button */}
          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            className={`inline-flex items-center justify-center rounded-lg p-1.5 transition ${
              isDarkMode
                ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                : 'text-blue-100 hover:bg-white/20 hover:text-white'
            }`}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            aria-label={isFullscreen ? 'Exit full screen mode' : 'Enter full screen mode'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>

          {/* Close button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={`inline-flex items-center justify-center rounded-lg p-1.5 transition ${
                isDarkMode
                  ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  : 'text-blue-100 hover:bg-white/20 hover:text-white'
              }`}
              title="Close Chatbot"
              aria-label="Close Chatbot"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className={bodyClasses}>
        <div
          className={`space-y-4 ${
            isFullscreen ? 'mx-auto max-w-4xl' : 'w-full'
          }`}
        >
          {messages.map((message, i) => (
            <div
              key={i}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`${
                  isFullscreen ? 'max-w-[80%]' : 'max-w-[90%]'
                } rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.isError
                      ? isDarkMode
                        ? 'border border-red-800 bg-red-950/80 text-red-200'
                        : 'border border-red-200 bg-red-50 text-red-700'
                      : isDarkMode
                        ? 'border border-gray-800 bg-gray-800 text-gray-100'
                        : 'border border-slate-200/80 bg-white text-slate-800'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.text}</p>
                {message.meta && (
                  <p
                    className={`mt-2 text-xs ${
                      isDarkMode ? 'text-gray-400' : 'text-slate-400'
                    }`}
                  >
                    {message.meta}
                  </p>
                )}
              </div>
            </div>
          ))}

          {isQuerying && (
            <div className="flex justify-start">
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm ${
                  isDarkMode
                    ? 'border border-gray-800 bg-gray-800 text-gray-400'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                <span className="animate-pulse">Logi-Assistant is thinking…</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Form Footer */}
      <form onSubmit={handleSendMessage} className={footerClasses}>
        <div
          className={`flex gap-2.5 ${
            isFullscreen ? 'mx-auto max-w-4xl' : 'w-full'
          }`}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about flood risks, landslides, routes, or relief logistics…"
            disabled={isQuerying}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm outline-none transition disabled:opacity-60 ${
              isDarkMode
                ? 'border border-gray-700 bg-gray-800 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                : 'border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
            }`}
          />
          <button
            type="submit"
            disabled={isQuerying || !query.trim()}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

export { Chatbot as AiAssistantPanel };
