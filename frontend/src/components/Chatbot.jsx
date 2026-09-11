import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Moon, Sun, X } from 'lucide-react';
import apiClient from '../api/apiClient';
import { getApiErrorMessage } from '../api/apiError';

export default function Chatbot({ isOpen = true, onClose }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      role: 'assistant',
      text: 'Hello! I am Logi-Assistant, your Logistics & Disaster Management AI. I can answer questions about real-time incident reports, weather risks, and optimal relief corridors in the North East Region.',
    },
  ]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef(null);

  // Only scroll down on new messages — NO auto-trigger on component mount
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Robust streaming send handler with state compatibility & strict object structure
  const handleSendMessage = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    // 1. State Compatibility: safely read input (fallback between userInput and query)
    const rawInput =
      typeof userInput !== 'undefined'
        ? userInput
        : typeof query !== 'undefined'
        ? query
        : '';

    // Guard clause: prevent sending empty requests or double submissions
    if (!rawInput || !rawInput.trim() || isQuerying || isStreaming) return;

    const textToSend = rawInput.trim();

    // Safely clear input state
    if (typeof setUserInput === 'function') setUserInput('');
    if (typeof setQuery === 'function') setQuery('');

    if (typeof setIsQuerying === 'function') setIsQuerying(true);
    if (typeof setIsStreaming === 'function') setIsStreaming(true);

    const userMessageId = Date.now();
    const botMessageId = userMessageId + 1;

    // 2. Exact Object Structure: push user message and assistant placeholder
    setMessages((prev) => [
      ...prev,
      { id: userMessageId, sender: 'user', role: 'user', text: textToSend },
      {
        id: botMessageId,
        sender: 'bot',
        role: 'assistant',
        text: '',
        meta: '⚡ Groq (Qwen 3.8 Streaming)',
        isStreaming: true,
      },
    ]);

    try {
      // 3. API Fallback Payload: send both question and query to http://127.0.0.1:8000/rag-query
      let response;
      const requestPayload = { question: textToSend, query: textToSend };

      try {
        console.log('Attempting direct connection to http://127.0.0.1:8000/rag-query...');
        response = await fetch('http://127.0.0.1:8000/rag-query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
          body: JSON.stringify(requestPayload),
        });
        console.log('FastAPI direct response status:', response.status);
      } catch (directErr) {
        console.warn('Direct FastAPI connection failed, attempting proxy fallback /api/ai/rag-query:', directErr.message);
        try {
          response = await fetch('/api/ai/rag-query', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
            },
            body: JSON.stringify(requestPayload),
          });
          console.log('Proxy response status:', response.status, 'Content-Type:', response.headers.get('content-type'));
        } catch (proxyErr) {
          console.error('Fallback proxy /api/ai/rag-query also failed:', proxyErr.message);
          throw new Error(`AI service connection failed (Direct: ${directErr.message} | Proxy: ${proxyErr.message})`);
        }
      }

      if (!response.ok) {
        throw new Error(`Service returned HTTP status ${response.status}`);
      }

      // Proxy Fallback Warning: verify stream body is available
      if (!response.body) {
        throw new Error('No stream body available from server response');
      }

      const contentType = response.headers.get('content-type') || '';
      console.log('Response content-type:', contentType);

      // Check if proxy returned a standard non-streamed JSON response
      if (contentType.includes('application/json')) {
        console.warn('Warning: Server returned JSON instead of text/plain stream. Parsing JSON body...');
        const jsonData = await response.json();
        const finalAnswer =
          jsonData.data?.answer ||
          jsonData.answer ||
          jsonData.message ||
          JSON.stringify(jsonData);

        setMessages((prev) => {
          if (!prev || prev.length === 0) return prev;
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          updated[lastIdx] = {
            ...updated[lastIdx],
            text: finalAnswer,
            isStreaming: false,
          };
          return updated;
        });
      } else {
        // 4. Stream Consumption via native fetch Streams API and TextDecoder
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulatedText = '';

        // 5. Debug & Append: loop chunks and force-append to the last index of messages
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('DEBUG-STREAM-DONE. Total characters accumulated:', accumulatedText.length);
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          console.log('DEBUG-CHUNK:', chunk);

          if (chunk) {
            accumulatedText += chunk;

            setMessages((prev) => {
              if (!prev || prev.length === 0) return prev;
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              updated[lastIdx] = {
                ...updated[lastIdx],
                text: accumulatedText,
                isStreaming: true,
              };
              return updated;
            });
          }
        }
      }
    } catch (error) {
      console.error('Streaming error in Chatbot:', error);
      setMessages((prev) => {
        if (!prev || prev.length === 0) return prev;
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        updated[lastIdx] = {
          ...updated[lastIdx],
          text:
            updated[lastIdx].text ||
            `⚠️ Error: ${error.message || 'Stream connection failed.'}`,
          isError: true,
          isStreaming: false,
        };
        return updated;
      });
    } finally {
      // 6. Cleanup: safely toggle all loading & streaming flags to false
      if (typeof setIsQuerying === 'function') setIsQuerying(false);
      if (typeof setIsStreaming === 'function') setIsStreaming(false);

      setMessages((prev) => {
        if (!prev || prev.length === 0) return prev;
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]) {
          updated[lastIdx] = {
            ...updated[lastIdx],
            isStreaming: false,
          };
        }
        return updated;
      });
    }
  };

  const handleAsk = handleSendMessage;

  if (!isOpen) return null;

  // Container styling classes depending on isFullscreen and isDarkMode.
  // Floating widget mode: anchored bottom-right, hard-capped at 85vh, flex
  // column with hidden outer overflow — so the header can never be pushed
  // off-screen when the messages area grows (only the inner body scrolls).
  const containerClasses = isFullscreen
    ? `fixed inset-0 z-[9999] flex h-full w-full flex-col m-0 overflow-hidden rounded-none shadow-2xl transition-all duration-200 ${
        isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-slate-900'
      }`
    : `fixed bottom-4 right-4 top-auto z-[1050] flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border shadow-2xl transition-all duration-200 sm:max-w-md ${
        isDarkMode
          ? 'border-gray-800 bg-gray-900 text-white'
          : 'border-slate-200 bg-white text-slate-900'
      }`;

  // Header background — shrink-0 keeps the header pinned at the top of the
  // flex column; the flex container can never squish or push it out of view.
  const headerClasses = isDarkMode
    ? 'flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-950 px-4 py-3 text-white'
    : 'flex shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white';

  // Body container — flex-1 + min-h-0 (flexbox min-size safety) + vertical
  // scroll: the messages area takes the remaining space and scrolls inside.
  const bodyClasses = `min-h-0 flex-1 overflow-y-auto px-4 py-4 ${
    isDarkMode ? 'bg-gray-900' : 'bg-slate-50'
  }`;

  // Footer / form container — shrink-0 keeps the input row fixed at the bottom.
  const footerClasses = `shrink-0 border-t px-4 py-3 ${
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
          {messages.map((message, i) => {
            const isUser = message.sender === 'user' || message.role === 'user';
            return (
              <div
                key={message.id || i}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`${
                    isFullscreen ? 'max-w-[80%]' : 'max-w-[90%]'
                  } rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
                    isUser
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
                  {!isUser && message.isStreaming && !message.text && (
                    <span className="inline-flex space-x-1 items-center py-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-300"></span>
                    </span>
                  )}
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
            );
          })}

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
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
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
            disabled={isQuerying || !userInput.trim()}
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
