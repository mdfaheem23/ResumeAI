import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { PromptInputBox } from '../components/ui/ai-prompt-box';
import './Tool.css';

const API_BASE = '/api';

const TIPS = [
  'Reformat my resume to FAANG standard',
  'Find software engineer jobs in San Francisco',
  'Tailor my resume for a product manager role',
  'Find remote data scientist positions',
];

function MessageBubble({ msg }) {
  return (
    <div className={`msg-row ${msg.role === 'user' ? 'msg-row-user' : 'msg-row-ai'}`}>
      {msg.role === 'ai' && (
        <div className="msg-avatar" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        </div>
      )}
      <div className="msg-bubble">
        {msg.text.split('\n').map((line, i) => (
          <span key={i}>{line}{i < msg.text.split('\n').length - 1 && <br />}</span>
        ))}
        {msg.pdf && (
          <a href={msg.pdf.url} download={msg.pdf.name} className="pdf-download-btn" target="_blank" rel="noopener noreferrer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Resume PDF
          </a>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="msg-row msg-row-ai">
      <div className="msg-avatar" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
        </svg>
      </div>
      <div className="msg-bubble typing-bubble" aria-label="AI is typing">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}

async function readApiResponse(res) {
  const raw = await res.text();

  try {
    return JSON.parse(raw);
  } catch {
    if (!res.ok) {
      throw new Error(raw || `Request failed with status ${res.status}`);
    }
    throw new Error('Server returned an invalid response.');
  }
}

export default function Tool() {
  const location = useLocation();
  const [messages, setMessages] = useState([{
    id: 'welcome',
    role: 'ai',
    text: 'Hi! I can help you build a FAANG-standard resume or search LinkedIn jobs.\n\nYou can:\n• Paste your resume text and ask me to reformat it\n• Upload a resume PDF using the clip icon\n• Ask me to find jobs (e.g. "Find Python developer jobs in NYC")'
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const handledInitialStateRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const historyForApi = messages
    .filter(m => m.id !== 'welcome')
    .map(m => [m.role === 'user' ? m.text : null, m.role === 'ai' ? m.text : null]);

  const sendMessage = useCallback(async (text, files) => {
    const selectedFile = files?.[0] || pdfFile;
    const trimmed = text.trim();
    const finalMessage = trimmed || (selectedFile ? 'Use the uploaded resume to create or improve my resume.' : '');
    if (!finalMessage || isLoading) return;

    setError(null);
    const userMsg = { id: crypto.randomUUID(), role: 'user', text: finalMessage };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('message', finalMessage);
      formData.append('history', JSON.stringify(historyForApi));
      formData.append('sessionId', sessionId);
      if (selectedFile) {
        formData.append('resume', selectedFile);
        setPdfFile(null);
      }

      const res = await fetch(`${API_BASE}/chat`, { method: 'POST', body: formData });
      const data = await readApiResponse(res);

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'ai',
        text: data.reply,
        pdf: data.pdf || null
      }]);
    } catch (err) {
      setError(err.message);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'ai',
        text: `Sorry, there was an error: ${err.message}`
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [isLoading, pdfFile, historyForApi, sessionId]);

  useEffect(() => {
    if (handledInitialStateRef.current) return;
    if (!location.state?.initialMessage) return;

    handledInitialStateRef.current = true;
    sendMessage(location.state.initialMessage, location.state?.files);
  }, [location.state, sendMessage]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPdfFile(file);
      sendMessage('Use the uploaded resume to create or improve my resume.', [file]);
    }
    e.target.value = '';
  };

  return (
    <div className="tool-page">
      <Navbar />

      <div className="tool-layout">
        {/* Sidebar */}
        <aside className="tool-sidebar" aria-label="Instructions">
          <div className="sidebar-section">
            <h2 className="sidebar-title">Resume Builder</h2>
            <p className="sidebar-desc">
              Chat with AI to build a FAANG-standard resume or search LinkedIn jobs.
            </p>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-label">Try these prompts</h3>
            <div className="tips-list">
              {TIPS.map(tip => (
                <button key={tip} className="tip-chip" onClick={() => sendMessage(tip)} disabled={isLoading}>
                  {tip}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-label">What you can do</h3>
            <ul className="sidebar-features">
              <li>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                Upload resume PDF
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                FAANG-format restructure
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                LinkedIn job search
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                Download resume as PDF
              </li>
            </ul>
          </div>

          <div className="sidebar-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p>First response may take ~60s while the AI wakes up.</p>
          </div>
        </aside>

        {/* Chat area */}
        <main className="tool-main" aria-label="Chat interface">
          <div className="messages-area" role="log" aria-live="polite">
            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {pdfFile && (
            <div className="pdf-preview">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>{pdfFile.name}</span>
              <button className="pdf-remove" onClick={() => setPdfFile(null)} aria-label="Remove PDF">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          <div className="input-area">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={handleFileChange}
              aria-label="Upload resume PDF"
            />
            <PromptInputBox
              onSend={(message, files) => sendMessage(message, files)}
              isLoading={isLoading}
              placeholder="Ask me to reformat your resume or search jobs..."
              autoSubmitPdf
              pdfAutoSubmitMessage="Use the uploaded resume to create or improve my resume."
            />
            <button
              type="button"
              className="pdf-attach-trigger"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              Attach PDF resume
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
